"""offers Lambda: publish, list, read and update offers; recommendations (stub)."""
import base64
import json
from decimal import Decimal

from botocore.exceptions import ClientError

from common.db import new_id, now_iso, table
from common.enums import OFFER_STATUS
from common.errors import BadRequest, Conflict, Forbidden, NotFound
from common.response import Router
from common.validate import as_enum, as_int, as_str, as_str_list, normalize

router = Router()

DEFAULT_LIMIT = 20
MAX_LIMIT = 50
CREATE_FIELDS = {"title", "description", "skills", "keywords", "gouvernorat", "durationWeeks"}
UPDATE_FIELDS = CREATE_FIELDS | {"status"}
OFFER_FIELDS = (
    "offerId", "companyId", "title", "description", "keywords", "skills",
    "gouvernorat", "durationWeeks", "status", "similar", "createdAt",
)
STATUS_TRANSITIONS = {("OPEN", "CLOSED"), ("OPEN", "FILLED"), ("CLOSED", "OPEN")}
# LastEvaluatedKey attributes of each GSI (table key + index keys).
OPEN_KEYS = {"offerId", "status", "gouvernoratCreatedAt"}
COMPANY_KEYS = {"offerId", "companyId", "createdAt"}


# ------------------------------------------------------------------ helpers
def _plain(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, (set, frozenset)):
        return sorted(_plain(v) for v in value)
    if isinstance(value, list):
        return [_plain(v) for v in value]
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    return value


def public_offer(item):
    """Only the openapi Offer fields: no gouvernoratCreatedAt."""
    out = {k: _plain(item[k]) for k in OFFER_FIELDS if k in item}
    for field in ("keywords", "skills", "similar"):
        out.setdefault(field, [])  # DynamoDB cannot store an empty set
    return out


def _reject_unknown(body, allowed):
    unknown = sorted(set(body) - set(allowed))
    if unknown:
        raise BadRequest("Unknown fields", details={"unknown": unknown})


def _normalized_list(body, field):
    values = as_str_list(body, field)
    return sorted({n for n in (normalize(v) for v in values) if n})


def _validated(body, partial):
    """Validated values of the fields in body (every field when not partial)."""
    out = {}

    def want(field):
        return field in body or not partial

    if want("title"):
        out["title"] = as_str(body, "title", 1, 200)
    if want("description"):
        out["description"] = as_str(body, "description", 1, 5000)
    if want("gouvernorat"):
        value = as_str(body, "gouvernorat", 1, 100)
        if "#" in value:  # '#' separates gouvernorat and createdAt in the index key
            raise BadRequest("gouvernorat must not contain '#'", details={"field": "gouvernorat"})
        out["gouvernorat"] = value
    if want("durationWeeks"):
        out["durationWeeks"] = as_int(body, "durationWeeks", minimum=1)
    for field in ("skills", "keywords"):
        if want(field):
            out[field] = _normalized_list(body, field)
    return out


def _get_offer(offer_id):
    item = None
    if offer_id:
        item = table("offers").get_item(Key={"offerId": offer_id}, ConsistentRead=True).get("Item")
    if not item:
        raise NotFound("Offer not found")
    return item


def _limit(query):
    raw = query.get("limit")
    if raw in (None, ""):
        return DEFAULT_LIMIT
    try:
        limit = int(raw)
    except (TypeError, ValueError):
        raise BadRequest("limit must be an integer", details={"field": "limit"})
    if limit < 1:
        raise BadRequest("limit must be at least 1", details={"field": "limit"})
    return min(limit, MAX_LIMIT)


def _mine(query):
    raw = str(query.get("mine", "false")).lower()
    if raw not in ("true", "false"):
        raise BadRequest("mine must be true or false", details={"field": "mine"})
    return raw == "true"


def _encode_cursor(key):
    return base64.urlsafe_b64encode(json.dumps(key, separators=(",", ":")).encode()).decode()


def _decode_cursor(raw, keys, exact, prefix=None):
    """Decode and check a cursor: right shape, same partition, inside the sort-key range."""
    try:
        key = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
    except Exception:
        key = None
    valid = (isinstance(key, dict) and set(key) == keys
             and all(isinstance(v, str) for v in key.values())
             and all(key[k] == v for k, v in exact.items()))
    if valid and prefix:
        valid = key["gouvernoratCreatedAt"].startswith(prefix)
    if not valid:
        raise BadRequest("Invalid cursor", details={"field": "cursor"})
    return key


# ------------------------------------------------------------------- create
@router.route("POST /v1/offers", roles=("ENT",))
def create_offer(req):
    body = req.json_body()
    _reject_unknown(body, CREATE_FIELDS)
    values = _validated(body, partial=False)

    created = now_iso()
    item = {
        "offerId": new_id(),
        "companyId": req.user_id,
        "status": "OPEN",
        "similar": [],
        "createdAt": created,
    }
    for field, value in values.items():
        if isinstance(value, list):
            if value:
                item[field] = set(value)
        else:
            item[field] = value
    item["gouvernoratCreatedAt"] = f"{item['gouvernorat']}#{created}"

    table("offers").put_item(
        Item=item,
        ConditionExpression="attribute_not_exists(#oid)",
        ExpressionAttributeNames={"#oid": "offerId"},
    )
    req.log.info("offer_created", offerId=item["offerId"])
    return 201, public_offer(item)


# --------------------------------------------------------------------- list
@router.route("GET /v1/offers")
def list_offers(req):
    limit = _limit(req.query)
    mine = _mine(req.query)
    gouvernorat = (req.query.get("gouvernorat") or "").strip()
    cursor = req.query.get("cursor")

    if req.role == "ENT" and mine:
        names = {"#c": "companyId"}
        values = {":c": req.user_id}
        kwargs = {"IndexName": "byCompany", "KeyConditionExpression": "#c = :c"}
        if gouvernorat:
            kwargs["FilterExpression"] = "#g = :g"
            names["#g"] = "gouvernorat"
            values[":g"] = gouvernorat
        keys, exact, prefix = COMPANY_KEYS, {"companyId": req.user_id}, None
    else:
        names = {"#s": "status"}
        values = {":s": "OPEN"}
        condition = "#s = :s"
        prefix = None
        if gouvernorat:
            prefix = f"{gouvernorat}#"
            condition += " AND begins_with(#gc, :p)"
            names["#gc"] = "gouvernoratCreatedAt"
            values[":p"] = prefix
        kwargs = {"IndexName": "openByRegion", "KeyConditionExpression": condition}
        keys, exact = OPEN_KEYS, {"status": "OPEN"}

    kwargs["ExpressionAttributeNames"] = names
    kwargs["ExpressionAttributeValues"] = values
    if cursor:
        kwargs["ExclusiveStartKey"] = _decode_cursor(cursor, keys, exact, prefix)

    try:
        res = table("offers").query(Limit=limit, ScanIndexForward=False, **kwargs)
    except ClientError as err:
        if cursor and err.response["Error"]["Code"] == "ValidationException":
            raise BadRequest("Invalid cursor", details={"field": "cursor"})
        raise
    last = res.get("LastEvaluatedKey")
    return {"items": [public_offer(i) for i in res.get("Items", [])],
            "nextCursor": _encode_cursor(last) if last else None}


# ---------------------------------------------------------------------- get
@router.route("GET /v1/offers/{id}")
def get_offer(req):
    return public_offer(_get_offer(req.path_params.get("id")))


# ------------------------------------------------------------------- update
@router.route("PATCH /v1/offers/{id}", roles=("ENT",))
def update_offer(req):
    body = req.json_body()
    _reject_unknown(body, UPDATE_FIELDS)
    if not body:
        raise BadRequest("No fields to update")
    values = _validated(body, partial=True)
    new_status = as_enum(body["status"], "status", OFFER_STATUS) if "status" in body else None

    offer = _get_offer(req.path_params.get("id"))
    if offer["companyId"] != req.user_id:
        raise Forbidden("Not your offer")
    if new_status is not None and (offer["status"], new_status) not in STATUS_TRANSITIONS:
        raise Conflict(f"Cannot change status from {offer['status']} to {new_status}",
                       details={"from": offer["status"], "to": new_status})

    sets, removes = {}, []
    for field, value in values.items():
        if isinstance(value, list):
            if value:
                sets[field] = set(value)
            else:
                removes.append(field)  # DynamoDB cannot store an empty set
        else:
            sets[field] = value
    if new_status is not None:
        sets["status"] = new_status
    if "gouvernorat" in values:
        sets["gouvernoratCreatedAt"] = f"{values['gouvernorat']}#{offer['createdAt']}"

    names = {"#oid": "offerId", "#cid": "companyId"}
    attr_values = {":caller": req.user_id}
    condition = "attribute_exists(#oid) AND #cid = :caller"
    if new_status is not None:  # the transition was checked against this status
        names["#cur"] = "status"
        attr_values[":cur"] = offer["status"]
        condition += " AND #cur = :cur"
    set_parts, remove_parts = [], []
    for i, (field, value) in enumerate(sets.items()):
        names[f"#f{i}"] = field
        attr_values[f":v{i}"] = value
        set_parts.append(f"#f{i} = :v{i}")
    for i, field in enumerate(removes):
        names[f"#r{i}"] = field
        remove_parts.append(f"#r{i}")
    expr = ""
    if set_parts:
        expr += "SET " + ", ".join(set_parts)
    if remove_parts:
        expr += (" " if expr else "") + "REMOVE " + ", ".join(remove_parts)

    try:
        res = table("offers").update_item(
            Key={"offerId": offer["offerId"]},
            UpdateExpression=expr,
            ConditionExpression=condition,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=attr_values,
            ReturnValues="ALL_NEW",
        )
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise Conflict("Offer was modified concurrently, retry")
        raise
    req.log.info("offer_updated", offerId=offer["offerId"], fields=sorted(body))
    return public_offer(res["Attributes"])


# ---------------------------------------------------------- recommendations
@router.route("GET /v1/students/me/recommendations", roles=("ETU",))
def list_recommendations(req):
    return {"items": []}  # matching is a later deliverable


handler = router.handle
