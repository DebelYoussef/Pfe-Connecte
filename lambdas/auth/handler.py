"""auth Lambda: signup, login, /me, CV upload URL, teacher expertise."""
import os
import re
from decimal import Decimal

import boto3
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

from common import auth as authlib
from common.db import client, new_id, now_iso, table, table_name
from common.errors import BadRequest, Conflict, NotFound, Unauthorized
from common.response import Router
from common.validate import as_enum, as_str, as_str_list, normalize

router = Router()

PUBLIC_ROLES = ("ETU", "ENT", "ENS")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TOKEN_TTL = 3600
CV_MAX_BYTES = 5 * 1024 * 1024
CV_EXPIRES_IN = 300

BASE_SIGNUP = {"email", "password", "role", "firstName", "lastName"}
SIGNUP_FIELDS = {
    "ETU": BASE_SIGNUP | {"etab", "department", "specialty", "skills", "gouvernorat"},
    "ENT": BASE_SIGNUP | {"companyName"},
    "ENS": BASE_SIGNUP | {"etab", "expertise"},
}
PROFILE_FIELDS = {
    "ETU": {"firstName", "lastName", "department", "specialty", "skills", "gouvernorat"},
    "ENT": {"firstName", "lastName", "companyName"},
    "ENS": {"firstName", "lastName"},
    "RESP": {"firstName", "lastName"},
    "ADM": {"firstName", "lastName"},
}
USER_FIELDS = (
    "userId", "email", "role", "etab", "firstName", "lastName", "department",
    "specialty", "skills", "gouvernorat", "cvKey", "expertise", "companyName",
    "activeCount", "conventionId", "createdAt",
)
# Never matches a real hash: login still burns one PBKDF2 run for unknown emails.
DUMMY_HASH = f"pbkdf2_sha256${authlib.PBKDF2_ITERATIONS}${'00' * 16}${'00' * 32}"


# ------------------------------------------------------------------ helpers
def _plain(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, (set, frozenset)):
        return sorted(_plain(v) for v in value)
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def public_user(item):
    """Only the openapi User fields: no passwordHash, no internal sparse keys."""
    return {k: _plain(item[k]) for k in USER_FIELDS if k in item}


def _reject_unknown(body, allowed):
    unknown = sorted(set(body) - set(allowed))
    if unknown:
        raise BadRequest("Unknown fields", details={"unknown": unknown})


def _email(body):
    email = as_str(body, "email", 3, 254).lower()
    if not EMAIL_RE.match(email):
        raise BadRequest("email is not valid", details={"field": "email"})
    return email


def _normalized_list(body, field, required=True):
    values = as_str_list(body, field, required=required)
    if values is None:
        return None
    return sorted({n for n in (normalize(v) for v in values) if n})


def _get_user(user_id):
    item = table("users").get_item(Key={"userId": user_id}, ConsistentRead=True).get("Item")
    if not item:
        raise NotFound("User not found")
    return item


def _issue_token(user):
    claims = {"sub": user["userId"], "role": user["role"]}
    if user.get("etab"):
        claims["etab"] = user["etab"]
    return authlib.sign_token(claims, TOKEN_TTL)


def _update_user(user_id, sets, removes=()):
    """SET / REMOVE on the caller's own Users item. Returns the new item."""
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
    kwargs = {}
    if values:
        kwargs["ExpressionAttributeValues"] = values
    try:
        res = table("users").update_item(
            Key={"userId": user_id},
            UpdateExpression=expr,
            ConditionExpression="attribute_exists(#uid)",
            ExpressionAttributeNames=names,
            ReturnValues="ALL_NEW",
            **kwargs,
        )
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise NotFound("User not found")
        raise
    return res["Attributes"]


def _trigger_recommender(req, student_id):
    """Best effort: ask the recommender Lambda to recompute (only if configured)."""
    fn = os.environ.get("RECOMMENDER_FUNCTION")
    if not fn:
        return
    try:
        boto3.client("lambda").invoke(
            FunctionName=fn, InvocationType="Event",
            Payload=('{"studentId": "%s"}' % student_id).encode())
    except Exception as exc:  # never fail the profile update because of this
        req.log.warn("recommender_trigger_failed", error=str(exc))


# ------------------------------------------------------------------- signup
@router.route("POST /v1/auth/signup", public=True)
def signup(req):
    body = req.json_body()
    role = as_enum(body.get("role"), "role", PUBLIC_ROLES)
    _reject_unknown(body, SIGNUP_FIELDS[role])

    email = _email(body)
    as_str(body, "password", 8, 128)
    item = {
        "userId": new_id(),
        "email": email,
        "passwordHash": authlib.hash_password(body["password"]),
        "role": role,
        "firstName": as_str(body, "firstName", 1, 100),
        "lastName": as_str(body, "lastName", 1, 100),
        "createdAt": now_iso(),
    }

    if role in ("ETU", "ENS"):
        etab = as_str(body, "etab", 1, 100)
        known = table("reference").get_item(Key={"type": "ETAB", "id": etab}).get("Item")
        if not known:
            raise BadRequest("Unknown institution", details={"field": "etab"})
        item["etab"] = etab

    if role == "ETU":
        item["department"] = as_str(body, "department", 1, 100)
        item["specialty"] = as_str(body, "specialty", 1, 100)
        item["gouvernorat"] = as_str(body, "gouvernorat", 1, 100)
        skills = _normalized_list(body, "skills", required=False)
        if skills:
            item["skills"] = set(skills)
        item["activeCount"] = 0
        item["sansStageEtab"] = item["etab"]  # sparse: no internship confirmed yet
    elif role == "ENT":
        item["companyName"] = as_str(body, "companyName", 1, 200)
    else:
        expertise = _normalized_list(body, "expertise", required=False)
        if expertise:
            item["expertise"] = set(expertise)

    ser = TypeSerializer()

    def to_dynamo(d):
        return {k: ser.serialize(v) for k, v in d.items()}

    try:
        client().transact_write_items(TransactItems=[
            {"Put": {
                "TableName": table_name("users"),
                "Item": to_dynamo(item),
                "ConditionExpression": "attribute_not_exists(#uid)",
                "ExpressionAttributeNames": {"#uid": "userId"},
            }},
            {"Put": {
                "TableName": table_name("reference"),
                "Item": to_dynamo({"type": "EMAIL", "id": email, "userId": item["userId"]}),
                "ConditionExpression": "attribute_not_exists(#t)",
                "ExpressionAttributeNames": {"#t": "type"},
            }},
        ])
    except ClientError as err:
        if err.response["Error"]["Code"] == "TransactionCanceledException":
            raise Conflict("Email already registered", code="EMAIL_TAKEN")
        raise

    req.log.info("signup", userId=item["userId"], role=role)
    return 201, {"token": _issue_token(item), "user": public_user(item)}


# -------------------------------------------------------------------- login
@router.route("POST /v1/auth/login", public=True)
def login(req):
    body = req.json_body()
    _reject_unknown(body, {"email", "password"})
    email = _email(body)
    as_str(body, "password", 1, 128)
    password = body["password"]

    ref = table("reference").get_item(
        Key={"type": "EMAIL", "id": email}, ConsistentRead=True).get("Item")
    user = None
    if ref:
        user = table("users").get_item(
            Key={"userId": ref["userId"]}, ConsistentRead=True).get("Item")
    stored = user["passwordHash"] if user else DUMMY_HASH
    if not authlib.check_password(password, stored) or not user:
        raise Unauthorized("Invalid credentials")
    return {"token": _issue_token(user), "user": public_user(user)}


# --------------------------------------------------------------------- /me
@router.route("GET /v1/me")
def get_me(req):
    return public_user(_get_user(req.user_id))


@router.route("PUT /v1/me")
def update_me(req):
    body = req.json_body()
    allowed = PROFILE_FIELDS.get(req.role, {"firstName", "lastName"})
    _reject_unknown(body, allowed)
    if not body:
        raise BadRequest("No fields to update")

    sets, removes = {}, []
    for field in ("firstName", "lastName"):
        if field in body:
            sets[field] = as_str(body, field, 1, 100)
    for field in ("department", "specialty", "gouvernorat"):
        if field in body:
            sets[field] = as_str(body, field, 1, 100)
    if "companyName" in body:
        sets["companyName"] = as_str(body, "companyName", 1, 200)
    if "skills" in body:
        skills = _normalized_list(body, "skills")
        if skills:
            sets["skills"] = set(skills)
        else:
            removes.append("skills")  # DynamoDB cannot store an empty set

    user = _update_user(req.user_id, sets, removes)
    if req.role == "ETU":
        _trigger_recommender(req, req.user_id)
    return public_user(user)


# ------------------------------------------------------------ CV upload URL
@router.route("POST /v1/me/cv-upload-url", roles=("ETU",))
def cv_upload_url(req):
    bucket = os.environ.get("CV_BUCKET")
    if not bucket:
        raise RuntimeError("Missing env var CV_BUCKET")
    key = f"cvs/{req.user_id}/cv.pdf"
    post = boto3.client("s3").generate_presigned_post(
        Bucket=bucket,
        Key=key,
        Fields={"Content-Type": "application/pdf"},
        Conditions=[
            {"Content-Type": "application/pdf"},
            ["content-length-range", 1, CV_MAX_BYTES],
        ],
        ExpiresIn=CV_EXPIRES_IN,
    )
    _update_user(req.user_id, {"cvKey": key})
    return {"url": post["url"], "fields": post["fields"], "key": key,
            "expiresIn": CV_EXPIRES_IN}


# --------------------------------------------------------- teacher expertise
@router.route("PUT /v1/teachers/me/expertise", roles=("ENS",))
def update_expertise(req):
    body = req.json_body()
    _reject_unknown(body, {"expertise"})
    expertise = _normalized_list(body, "expertise")
    if expertise:
        user = _update_user(req.user_id, {"expertise": set(expertise)})
    else:
        user = _update_user(req.user_id, {}, ["expertise"])
    return public_user(user)


handler = router.handle