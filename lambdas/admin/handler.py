"""admin Lambda (role ADM only): users, institutions, departments, specialties, overview.

Every operation with x-lambda admin in docs/openapi.yaml. No Scan: GetItem and Query only.

Users list access paths (schema.md section 5), exactly one per request:
  email                 Reference GetItem (EMAIL) -> Users GetItem
  role + etab           Users.byEtabRole  (etab = :e AND role = :r)
  role                  Users.byRole      (newest first)
  etab                  Users.byEtabRole  (partition only)
  none                  Users.allByCreatedAt (gsiAll = "ALL", newest first)
"""
import base64
import datetime
import json
import os
import re
from decimal import Decimal
from urllib.parse import unquote

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from common import auth as authlib
from common.config_health import list_open_issues, run_config_health
from common.db import new_id, now_iso, table
from common.enums import ROLES
from common.errors import BadRequest, Conflict, Forbidden, NotFound
from common.notify import notify_admins
from common.response import Router
from common.users import create_user_item, public_user
from common.validate import as_enum, as_str, as_str_list, normalize

router = Router()
ADM = ("ADM",)

DEFAULT_LIMIT = 20
MAX_LIMIT = 100  # openapi components.parameters.Limit (maximum: 100)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
RECENT_DAYS = 7

ETAB_REQUIRED = ("ETU", "ENS", "RESP")
NO_ETAB = ("ENT", "ADM")
BASE_CREATE = {"email", "password", "role", "firstName", "lastName"}
CREATE_FIELDS = {
    "ETU": BASE_CREATE | {"etab", "department", "specialty", "gouvernorat", "skills"},
    "ENS": BASE_CREATE | {"etab", "expertise"},
    "RESP": BASE_CREATE | {"etab"},
    "ENT": BASE_CREATE | {"companyName"},
    "ADM": BASE_CREATE,
}
PATCH_FIELDS = {"role", "etab", "firstName", "lastName", "department", "specialty",
                "gouvernorat", "companyName"}
PROFILE_KEYS = ("etab", "department", "specialty", "gouvernorat", "companyName")


# ------------------------------------------------------------------ helpers
def _reject_unknown(values, allowed, what="fields"):
    unknown = sorted(set(values) - set(allowed))
    if unknown:
        raise BadRequest(f"Unknown {what}", details={"unknown": unknown})


def _query_str(query, name, max_len=100):
    value = query.get(name)
    if value is None or value == "":
        return None
    if len(value) > max_len:
        raise BadRequest(f"{name} is too long", details={"field": name})
    return value.strip() or None


def _limit(query):
    raw = query.get("limit")
    if raw in (None, ""):
        return DEFAULT_LIMIT
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise BadRequest("limit must be an integer", details={"field": "limit"})
    if not 1 <= value <= MAX_LIMIT:
        raise BadRequest(f"limit must be between 1 and {MAX_LIMIT}", details={"field": "limit"})
    return value


def _email(value, field="email"):
    if not isinstance(value, str) or len(value.strip()) > 254:
        raise BadRequest(f"{field} is not valid", details={"field": field})
    email = value.strip().lower()
    if not EMAIL_RE.match(email):
        raise BadRequest(f"{field} is not valid", details={"field": field})
    return email


def _code(body, field):
    """SHORT department / specialty code: never the id (ETAB1#INFO) and never a name with '#'."""
    value = as_str(body, field, 1, 100)
    if "#" in value:
        raise BadRequest(f"{field} must be the SHORT code, not the id",
                         details={"field": field})
    return value


def _normalized_list(body, field):
    values = as_str_list(body, field, required=False)
    if values is None:
        return None
    return sorted({n for n in (normalize(v) for v in values) if n})


def _json_default(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    raise TypeError(f"Cannot serialize {type(value)}")


def _encode_cursor(fingerprint, key):
    raw = json.dumps({"f": fingerprint, "k": key}, default=_json_default, separators=(",", ":"))
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor, fingerprint):
    """Cursor = base64 of {"f": filter fingerprint, "k": LastEvaluatedKey}. The fingerprint
    rejects a cursor produced by another filter combination (400, as the contract says)."""
    try:
        data = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
        key, found = data["k"], data["f"]
    except Exception:
        raise BadRequest("cursor is not valid", details={"field": "cursor"})
    if found != fingerprint or not isinstance(key, dict) or not key:
        raise BadRequest("cursor is not valid", details={"field": "cursor"})
    return key


def _page(tbl, fingerprint, kwargs, limit, cursor, convert):
    kwargs = {**kwargs, "Limit": limit}
    if cursor:
        kwargs["ExclusiveStartKey"] = _decode_cursor(cursor, fingerprint)
    try:
        res = tbl.query(**kwargs)
    except ClientError as err:
        if cursor and err.response["Error"]["Code"] == "ValidationException":
            raise BadRequest("cursor is not valid", details={"field": "cursor"})
        raise
    last = res.get("LastEvaluatedKey")
    return {"items": [convert(i) for i in res.get("Items", [])],
            "nextCursor": _encode_cursor(fingerprint, last) if last else None}


def _query_all(tbl, **kwargs):
    while True:
        res = tbl.query(**kwargs)
        yield from res.get("Items", [])
        last = res.get("LastEvaluatedKey")
        if not last:
            return
        kwargs["ExclusiveStartKey"] = last


def _count(tbl, **kwargs):
    total = 0
    while True:
        res = tbl.query(Select="COUNT", **kwargs)
        total += res.get("Count", 0)
        last = res.get("LastEvaluatedKey")
        if not last:
            return total
        kwargs["ExclusiveStartKey"] = last


def _get_user(user_id):
    item = table("users").get_item(Key={"userId": user_id}, ConsistentRead=True).get("Item")
    if not item:
        raise NotFound("User not found")
    return item


def _path_id(req):
    return unquote(req.path_params.get("id") or "")


def _notify_admins(req, type_, title, body, ref_id, exclude):
    """Best effort: the account change is already committed, a failed fan-out only gets logged."""
    try:
        return notify_admins(type_, title, body, "USER", ref_id, "INFO", exclude_user_id=exclude)
    except Exception as exc:
        req.log.error("admin_notify_failed", type=type_, error=str(exc))
        return []


def _recheck(req, reason):
    """Re-run the configuration check after a change (schema.md 4.9.1).

    Deployed: invokes the config_health Lambda asynchronously (CONFIG_HEALTH_FUNCTION is set by
    deploy.py). Without that variable (tests, local runs) the check runs inline. Never fails the
    request: the daily check will catch up.
    """
    function = os.environ.get("CONFIG_HEALTH_FUNCTION")
    try:
        if function:
            boto3.client("lambda").invoke(
                FunctionName=function, InvocationType="Event",
                Payload=json.dumps({"source": "admin", "reason": reason}).encode())
        else:
            run_config_health()
    except Exception as exc:
        req.log.error("config_health_trigger_failed", reason=reason, error=str(exc))


# ------------------------------------------------- per-role validation (users)
def _check_references(role, fields):
    """etab, department and specialty must exist in Reference (400, as signup does)."""
    if role not in ETAB_REQUIRED:
        return
    reference = table("reference")
    etab = fields["etab"]
    if not reference.get_item(Key={"type": "ETAB", "id": etab}, ConsistentRead=True).get("Item"):
        raise BadRequest("Unknown institution", details={"field": "etab"})
    if role != "ETU":
        return
    dept_id = f"{etab}#{fields['department']}"
    if not reference.get_item(Key={"type": "DEPARTMENT", "id": dept_id},
                              ConsistentRead=True).get("Item"):
        raise BadRequest("Unknown department for this institution", details={"field": "department"})
    spec_id = f"{dept_id}#{fields['specialty']}"
    if not reference.get_item(Key={"type": "SPECIALTY", "id": spec_id},
                              ConsistentRead=True).get("Item"):
        raise BadRequest("Unknown specialty for this department", details={"field": "specialty"})


def _validate_profile(role, fields, check_references=True):
    """Required fields per role (openapi AdminUserCreate): etab for ETU, ENS, RESP; department,
    specialty and gouvernorat for ETU; companyName for ENT; nothing for ADM."""
    missing = []
    if role in ETAB_REQUIRED and not fields.get("etab"):
        missing.append("etab")
    if role == "ETU":
        missing += [k for k in ("department", "specialty", "gouvernorat") if not fields.get(k)]
    if role == "ENT" and not fields.get("companyName"):
        missing.append("companyName")
    if missing:
        raise BadRequest("Missing required fields", details={"missing": missing})
    if check_references:
        _check_references(role, fields)


# ------------------------------------------------------------------- users
@router.route("GET /v1/admin/users", roles=ADM)
def list_users(req):
    query = req.query
    _reject_unknown(query, {"role", "etab", "email", "limit", "cursor"}, "query parameters")
    role = _query_str(query, "role")
    if role:
        as_enum(role, "role", ROLES)
    etab = _query_str(query, "etab")
    email = _query_str(query, "email", 254)

    if email:  # exact lookup; limit and cursor are ignored
        email = _email(email)
        ref = table("reference").get_item(
            Key={"type": "EMAIL", "id": email}, ConsistentRead=True).get("Item")
        user = None
        if ref:
            user = table("users").get_item(
                Key={"userId": ref["userId"]}, ConsistentRead=True).get("Item")
        if user and (role and user.get("role") != role or etab and user.get("etab") != etab):
            user = None
        return {"items": [public_user(user)] if user else [], "nextCursor": None}

    limit = _limit(query)
    cursor = query.get("cursor") or None
    if role == "ADM" and etab:  # administrators have no etab
        return {"items": [], "nextCursor": None}

    if etab:
        index, path = "byEtabRole", "etab+role" if role else "etab"
        condition = Key("etab").eq(etab)
        if role:
            condition = condition & Key("role").eq(role)
        kwargs = {"IndexName": index, "KeyConditionExpression": condition}
    elif role:
        path = "role"
        kwargs = {"IndexName": "byRole", "KeyConditionExpression": Key("role").eq(role),
                  "ScanIndexForward": False}
    else:
        path = "all"
        kwargs = {"IndexName": "allByCreatedAt", "KeyConditionExpression": Key("gsiAll").eq("ALL"),
                  "ScanIndexForward": False}
    fingerprint = f"users|{path}|{role or ''}|{etab or ''}"
    return _page(table("users"), fingerprint, kwargs, limit, cursor, public_user)


@router.route("POST /v1/admin/users", roles=ADM)
def create_user(req):
    body = req.json_body()
    role = as_enum(body.get("role"), "role", ROLES)
    _reject_unknown(body, CREATE_FIELDS[role])

    email = _email(body.get("email"))
    as_str(body, "password", 8, 128)
    item = {
        "userId": new_id(),
        "email": email,
        "passwordHash": authlib.hash_password(body["password"]),  # the password is never kept
        "role": role,
        "createdAt": now_iso(),
        "gsiAll": "ALL",  # constant partition key of the allByCreatedAt index
    }
    for field in ("firstName", "lastName"):
        value = as_str(body, field, 1, 100, required=False)
        if value:
            item[field] = value

    fields = {}
    if "etab" in body:
        fields["etab"] = as_str(body, "etab", 1, 100)
    if role == "ETU":
        for field in ("department", "specialty"):
            if field in body:
                fields[field] = _code(body, field)
        if "gouvernorat" in body:
            fields["gouvernorat"] = as_str(body, "gouvernorat", 1, 100)
    if role == "ENT" and "companyName" in body:
        fields["companyName"] = as_str(body, "companyName", 1, 200)
    _validate_profile(role, fields)
    item.update(fields)

    if role == "ETU":
        skills = _normalized_list(body, "skills")
        if skills:
            item["skills"] = set(skills)
        item["activeCount"] = 0
        item["sansStageEtab"] = item["etab"]  # sparse, same as signup: no internship yet
    elif role == "ENS":
        expertise = _normalized_list(body, "expertise")
        if expertise:
            item["expertise"] = set(expertise)

    create_user_item(item)
    req.log.info("admin_create_user", userId=item["userId"], role=role, by=req.user_id)

    if role == "ADM":
        _notify_admins(
            req, "ADMIN_ACCOUNT_CREATED", "Nouveau compte administrateur",
            f"Un compte administrateur a été créé pour {email}.",
            item["userId"], exclude={req.user_id, item["userId"]})
    elif role == "RESP":
        _recheck(req, "resp_created")
    return 201, public_user(item)


def _update_user(user_id, sets, removes):
    names, values, set_parts, rem_parts = {"#uid": "userId"}, {}, [], []
    for i, (field, value) in enumerate(sets.items()):
        names[f"#f{i}"] = field
        values[f":v{i}"] = value
        set_parts.append(f"#f{i} = :v{i}")
    for i, field in enumerate(removes):
        names[f"#r{i}"] = field
        rem_parts.append(f"#r{i}")
    expr = ""
    if set_parts:
        expr += "SET " + ", ".join(set_parts)
    if rem_parts:
        expr += (" " if expr else "") + "REMOVE " + ", ".join(rem_parts)
    kwargs = {"ExpressionAttributeValues": values} if values else {}
    try:
        res = table("users").update_item(
            Key={"userId": user_id}, UpdateExpression=expr,
            ConditionExpression="attribute_exists(#uid)",
            ExpressionAttributeNames=names, ReturnValues="ALL_NEW", **kwargs)
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise NotFound("User not found")
        raise
    return res["Attributes"]


@router.route("PATCH /v1/admin/users/{id}", roles=ADM)
def update_user(req):
    target_id = _path_id(req)
    body = req.json_body()
    _reject_unknown(body, PATCH_FIELDS)
    if not body:
        raise BadRequest("No fields to update")
    user = _get_user(target_id)  # 404

    old_role = user["role"]
    new_role = as_enum(body["role"], "role", ROLES) if "role" in body else old_role
    if new_role != old_role and target_id == req.user_id:
        raise Forbidden("You cannot change your own role", code="CANNOT_CHANGE_OWN_ROLE")

    sets = {}
    if new_role != old_role:
        sets["role"] = new_role
    for field in ("firstName", "lastName"):
        if field in body:
            sets[field] = as_str(body, field, 1, 100)
    if "etab" in body:
        if new_role in NO_ETAB:
            raise BadRequest(f"etab is not allowed for {new_role}", details={"field": "etab"})
        sets["etab"] = as_str(body, "etab", 1, 100)
    for field in ("department", "specialty", "gouvernorat"):
        if field in body:
            if new_role != "ETU":
                raise BadRequest(f"{field} only applies to ETU", details={"field": field})
            sets[field] = (_code(body, field) if field != "gouvernorat"
                           else as_str(body, "gouvernorat", 1, 100))
    if "companyName" in body:
        if new_role != "ENT":
            raise BadRequest("companyName only applies to ENT", details={"field": "companyName"})
        sets["companyName"] = as_str(body, "companyName", 1, 200)

    # Role rules on the state AFTER the patch. ENT and ADM have no etab: it is removed (it is an
    # index key). The student's sparse attributes (sansStageEtab, stageEtab, lastJournal,
    # activeCount) are never touched here.
    final = {k: user[k] for k in PROFILE_KEYS if k in user}
    final.update({k: v for k, v in sets.items() if k in PROFILE_KEYS})
    removes = []
    if new_role in NO_ETAB:
        final.pop("etab", None)
        if "etab" in user:
            removes.append("etab")
    references_changed = new_role != old_role or any(
        k in body for k in ("etab", "department", "specialty"))
    _validate_profile(new_role, final, check_references=references_changed)

    if not sets and not removes:  # e.g. the same role sent again: accepted as a no-op
        return public_user(user)
    updated = _update_user(target_id, sets, removes)
    req.log.info("admin_update_user", userId=target_id, by=req.user_id, fields=sorted(sets))

    if new_role == "ADM" and old_role != "ADM":
        _notify_admins(
            req, "ADMIN_ROLE_GRANTED", "Rôle administrateur accordé",
            f"Le compte {updated['email']} a reçu le rôle administrateur.",
            target_id, exclude={req.user_id, target_id})
    etab_moved = "etab" in sets and sets["etab"] != user.get("etab")
    if "RESP" in (old_role, new_role) and (new_role != old_role or etab_moved):
        _recheck(req, "resp_changed")
    return public_user(updated)


# ---------------------------------------------- institutions, departments, specialties
def _name_key(name):
    return " ".join(normalize(name).split())


def _ensure_unique_name(siblings, name, own_id=None):
    """Names are unique within their parent (409). Check-then-write: two concurrent creations
    of the same name can both pass; the ids are still protected by a conditional put."""
    wanted = _name_key(name)
    for item in siblings:
        if item["id"] != own_id and _name_key(item.get("name", "")) == wanted:
            raise Conflict("Name already used in this parent", details={"field": "name"})


def _slug(name):
    slug = re.sub(r"[^a-z0-9]+", "-", normalize(name)).strip("-").upper()
    if not slug:
        raise BadRequest("name must contain letters or digits", details={"field": "name"})
    return slug


def _put_new(item):
    """Conditional put on the Reference key. Returns False when the id already exists."""
    try:
        table("reference").put_item(
            Item=item, ConditionExpression="attribute_not_exists(#t) AND attribute_not_exists(#i)",
            ExpressionAttributeNames={"#t": "type", "#i": "id"})
        return True
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def _update_reference(type_, item_id, sets, removes=()):
    names, values, set_parts, rem_parts = {"#t": "type"}, {}, [], []
    for i, (field, value) in enumerate(sets.items()):
        names[f"#f{i}"] = field
        values[f":v{i}"] = value
        set_parts.append(f"#f{i} = :v{i}")
    for i, field in enumerate(removes):
        names[f"#r{i}"] = field
        rem_parts.append(f"#r{i}")
    expr = ("SET " + ", ".join(set_parts) if set_parts else "")
    if rem_parts:
        expr += (" " if expr else "") + "REMOVE " + ", ".join(rem_parts)
    kwargs = {"ExpressionAttributeValues": values} if values else {}
    try:
        return table("reference").update_item(
            Key={"type": type_, "id": item_id}, UpdateExpression=expr,
            ConditionExpression="attribute_exists(#t)", ExpressionAttributeNames=names,
            ReturnValues="ALL_NEW", **kwargs)["Attributes"]
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise NotFound(f"{type_.title()} not found")
        raise


def _get_reference(type_, item_id, label):
    item = table("reference").get_item(
        Key={"type": type_, "id": item_id}, ConsistentRead=True).get("Item")
    if not item:
        raise NotFound(f"{label} not found")
    return item


def _institution(item):
    return {"id": item["id"], "name": item.get("name", "")}


def _department(item):
    return {"id": item["id"], "etab": item["id"].split("#", 1)[0], "name": item.get("name", "")}


def _specialty(item):
    out = {"id": item["id"], "department": item["id"].rsplit("#", 1)[0],
           "name": item.get("name", "")}
    if item.get("compatibleWith"):
        out["compatibleWith"] = sorted(item["compatibleWith"])
    return out


def _list_reference(req, type_, convert, prefix=None, extra_allowed=()):
    _reject_unknown(req.query, {"limit", "cursor", *extra_allowed}, "query parameters")
    condition = Key("type").eq(type_)
    if prefix:
        condition = condition & Key("id").begins_with(prefix)
    fingerprint = f"reference|{type_}|{prefix or ''}"
    return _page(table("reference"), fingerprint,
                 {"KeyConditionExpression": condition, "ConsistentRead": True},
                 _limit(req.query), req.query.get("cursor") or None, convert)


# --- institutions
@router.route("GET /v1/admin/institutions", roles=ADM)
def list_institutions(req):
    return _list_reference(req, "ETAB", _institution)


@router.route("POST /v1/admin/institutions", roles=ADM)
def create_institution(req):
    body = req.json_body()
    _reject_unknown(body, {"name"})
    name = as_str(body, "name", 1, 200)
    for _ in range(5):  # a concurrent creation can take the same number: re-read and retry
        existing = list(_query_all(table("reference"), ConsistentRead=True,
                                   KeyConditionExpression=Key("type").eq("ETAB")))
        _ensure_unique_name(existing, name)
        numbers = [int(m.group(1)) for i in existing if (m := re.fullmatch(r"ETAB(\d+)", i["id"]))]
        item = {"type": "ETAB", "id": f"ETAB{max(numbers, default=0) + 1}", "name": name}
        if _put_new(item):
            req.log.info("admin_create_institution", id=item["id"], by=req.user_id)
            _recheck(req, "institution_created")  # a new institution has no RESP yet
            return 201, _institution(item)
    raise Conflict("Could not allocate an institution id, retry")


@router.route("PATCH /v1/admin/institutions/{id}", roles=ADM)
def update_institution(req):
    etab_id = _path_id(req)
    body = req.json_body()
    _reject_unknown(body, {"name"})
    name = as_str(body, "name", 1, 200)
    _get_reference("ETAB", etab_id, "Institution")
    siblings = _query_all(table("reference"), ConsistentRead=True,
                          KeyConditionExpression=Key("type").eq("ETAB"))
    _ensure_unique_name(siblings, name, own_id=etab_id)
    return _institution(_update_reference("ETAB", etab_id, {"name": name}))


# --- departments
@router.route("GET /v1/admin/departments", roles=ADM)
def list_departments(req):
    etab = _query_str(req.query, "etab")
    return _list_reference(req, "DEPARTMENT", _department,
                           prefix=f"{etab}#" if etab else None, extra_allowed=("etab",))


@router.route("POST /v1/admin/departments", roles=ADM)
def create_department(req):
    body = req.json_body()
    _reject_unknown(body, {"etab", "name"})
    etab = as_str(body, "etab", 1, 100)  # required on creation (400)
    name = as_str(body, "name", 1, 200)
    slug = _slug(name)
    _get_reference("ETAB", etab, "Institution")  # unknown parent: 404
    siblings = _query_all(table("reference"), ConsistentRead=True,
                          KeyConditionExpression=Key("type").eq("DEPARTMENT")
                          & Key("id").begins_with(f"{etab}#"))
    _ensure_unique_name(siblings, name)
    item = {"type": "DEPARTMENT", "id": f"{etab}#{slug}", "name": name}
    if not _put_new(item):
        raise Conflict("A department with the same code already exists", details={"id": item["id"]})
    req.log.info("admin_create_department", id=item["id"], by=req.user_id)
    _recheck(req, "department_created")  # a new department has no specialty yet
    return 201, _department(item)


@router.route("PATCH /v1/admin/departments/{id}", roles=ADM)
def update_department(req):
    dept_id = _path_id(req)
    body = req.json_body()
    _reject_unknown(body, {"etab", "name"})
    name = as_str(body, "name", 1, 200)
    _get_reference("DEPARTMENT", dept_id, "Department")
    etab = dept_id.split("#", 1)[0]
    if "etab" in body and as_str(body, "etab", 1, 100) != etab:
        raise BadRequest("A department cannot change institution", details={"field": "etab"})
    siblings = _query_all(table("reference"), ConsistentRead=True,
                          KeyConditionExpression=Key("type").eq("DEPARTMENT")
                          & Key("id").begins_with(f"{etab}#"))
    _ensure_unique_name(siblings, name, own_id=dept_id)
    return _department(_update_reference("DEPARTMENT", dept_id, {"name": name}))


# --- specialties
@router.route("GET /v1/admin/specialties", roles=ADM)
def list_specialties(req):
    department = _query_str(req.query, "department")
    return _list_reference(req, "SPECIALTY", _specialty,
                           prefix=f"{department}#" if department else None,
                           extra_allowed=("department",))


@router.route("POST /v1/admin/specialties", roles=ADM)
def create_specialty(req):
    body = req.json_body()
    _reject_unknown(body, {"department", "name", "compatibleWith"})
    department = as_str(body, "department", 1, 200)  # required on creation (400)
    name = as_str(body, "name", 1, 200)
    compatible = as_str_list(body, "compatibleWith", required=False)
    slug = _slug(name)
    _get_reference("DEPARTMENT", department, "Department")  # unknown parent: 404
    siblings = _query_all(table("reference"), ConsistentRead=True,
                          KeyConditionExpression=Key("type").eq("SPECIALTY")
                          & Key("id").begins_with(f"{department}#"))
    _ensure_unique_name(siblings, name)
    item = {"type": "SPECIALTY", "id": f"{department}#{slug}", "name": name}
    if compatible:
        item["compatibleWith"] = set(compatible)
    if not _put_new(item):
        raise Conflict("A specialty with the same code already exists", details={"id": item["id"]})
    req.log.info("admin_create_specialty", id=item["id"], by=req.user_id)
    _recheck(req, "specialty_created")  # may close DEPARTMENT_WITHOUT_SPECIALTY
    return 201, _specialty(item)


@router.route("PATCH /v1/admin/specialties/{id}", roles=ADM)
def update_specialty(req):
    spec_id = _path_id(req)
    body = req.json_body()
    _reject_unknown(body, {"department", "name", "compatibleWith"})
    if "name" not in body and "compatibleWith" not in body:
        raise BadRequest("No fields to update")
    _get_reference("SPECIALTY", spec_id, "Specialty")
    department = spec_id.rsplit("#", 1)[0]
    if "department" in body and as_str(body, "department", 1, 200) != department:
        raise BadRequest("A specialty cannot change department", details={"field": "department"})
    sets, removes = {}, []
    if "name" in body:
        name = as_str(body, "name", 1, 200)
        siblings = _query_all(table("reference"), ConsistentRead=True,
                              KeyConditionExpression=Key("type").eq("SPECIALTY")
                              & Key("id").begins_with(f"{department}#"))
        _ensure_unique_name(siblings, name, own_id=spec_id)
        sets["name"] = name
    if "compatibleWith" in body:
        compatible = as_str_list(body, "compatibleWith")
        if compatible:
            sets["compatibleWith"] = set(compatible)
        else:
            removes.append("compatibleWith")  # DynamoDB cannot store an empty set
    return _specialty(_update_reference("SPECIALTY", spec_id, sets, removes))


# ---------------------------------------------------------------- overview
@router.route("GET /v1/admin/overview", roles=ADM)
def overview(req):
    users = table("users")
    by_role = {role: _count(users, IndexName="byRole", KeyConditionExpression=Key("role").eq(role))
               for role in ROLES}
    cutoff = (datetime.datetime.now(datetime.timezone.utc)
              - datetime.timedelta(days=RECENT_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    recent = _count(users, IndexName="allByCreatedAt",
                    KeyConditionExpression=Key("gsiAll").eq("ALL") & Key("createdAt").gte(cutoff))
    return {"usersByRole": by_role, "recentUsersCount": recent, **list_open_issues()}


handler = router.handle
