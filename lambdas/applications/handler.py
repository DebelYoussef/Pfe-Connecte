"""applications Lambda: apply, list, company and student status changes."""
import base64
import json

from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

from common.db import client, now_iso, table, table_name
from common.enums import ACTIVE_APPLICATION_STATUS, MAX_ACTIVE_APPLICATIONS
from common.errors import BadRequest, Conflict, Forbidden, NotFound
from common.response import Router
from common.validate import as_enum

router = Router()

DEFAULT_LIMIT, MAX_LIMIT = 20, 100
APPLICATION_FIELDS = (
    "studentId", "offerId", "companyId", "status", "createdAt", "updatedAt", "viewedAt",
)
ACTIONS = ("in_progress", "accept", "reject", "confirm", "decline", "withdraw")
# action -> (role allowed, statuses it may start from, resulting status)
TRANSITIONS = {
    "in_progress": ("ENT", ("VIEWED",), "IN_PROGRESS"),
    "accept": ("ENT", ("PENDING", "VIEWED", "IN_PROGRESS"), "ACCEPTED"),
    "reject": ("ENT", ACTIVE_APPLICATION_STATUS, "REJECTED"),
    "decline": ("ETU", ("ACCEPTED",), "DECLINED"),
    "withdraw": ("ETU", ACTIVE_APPLICATION_STATUS, "WITHDRAWN"),
}
LEAVING_ACTIVE = ("REJECTED", "DECLINED", "WITHDRAWN")
_SER = TypeSerializer()


# ------------------------------------------------------------------ helpers
def _ser(value):
    return _SER.serialize(value)


def _to_dynamo(d):
    return {k: _ser(v) for k, v in d.items()}


def public_application(item):
    """Only the openapi Application fields."""
    return {k: item[k] for k in APPLICATION_FIELDS if k in item}


def _path(req, name):
    value = req.path_params.get(name)
    if not value:
        raise BadRequest(f"{name} is required", details={"field": name})
    return value


def _app_key(student_id, offer_id):
    return {"studentId": student_id, "offerId": offer_id}


def _get_offer(offer_id):
    item = table("offers").get_item(Key={"offerId": offer_id}, ConsistentRead=True).get("Item")
    if not item:
        raise NotFound("Offer not found")
    return item


def _get_application(student_id, offer_id):
    item = table("applications").get_item(
        Key=_app_key(student_id, offer_id), ConsistentRead=True).get("Item")
    if not item:
        raise NotFound("Application not found")
    return item


def _cancel_codes(err):
    return [r.get("Code") for r in err.response.get("CancellationReasons") or []]


def _is(err, code):
    return err.response["Error"]["Code"] == code


def _encode_cursor(key):
    return base64.urlsafe_b64encode(json.dumps(key, separators=(",", ":")).encode()).decode()


def _page_params(req):
    limit = DEFAULT_LIMIT
    raw = req.query.get("limit")
    if raw is not None:
        try:
            limit = int(raw)
        except (TypeError, ValueError):
            raise BadRequest("limit must be an integer", details={"field": "limit"})
        if not 1 <= limit <= MAX_LIMIT:
            raise BadRequest(f"limit must be between 1 and {MAX_LIMIT}",
                             details={"field": "limit"})
    start = None
    cursor = req.query.get("cursor")
    if cursor:
        try:
            start = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
        except Exception:
            raise BadRequest("cursor is not valid", details={"field": "cursor"})
    return limit, start


def _query_page(req, key_name, key_value, index=None):
    """One page of Applications for a partition. Returns (items, nextCursor)."""
    limit, start = _page_params(req)
    kwargs = {"KeyConditionExpression": Key(key_name).eq(key_value), "Limit": limit}
    if index:
        kwargs["IndexName"] = index  # GSIs do not support ConsistentRead
    else:
        kwargs["ConsistentRead"] = True
    if start is not None:
        valid = (isinstance(start, dict) and set(start) == {"studentId", "offerId"}
                 and start.get(key_name) == key_value
                 and all(isinstance(v, str) for v in start.values()))
        if not valid:  # a forged cursor must not read another partition
            raise BadRequest("cursor is not valid", details={"field": "cursor"})
        kwargs["ExclusiveStartKey"] = start
    res = table("applications").query(**kwargs)
    last = res.get("LastEvaluatedKey")
    return res.get("Items", []), (_encode_cursor(last) if last else None)


def _mark_viewed(item):
    """PENDING -> VIEWED on first company read. Returns the fresh item."""
    now = now_iso()
    key = _app_key(item["studentId"], item["offerId"])
    try:
        res = table("applications").update_item(
            Key=key,
            UpdateExpression="SET #s = :viewed, #va = :now, #u = :now",
            ConditionExpression="#s = :pending",
            ExpressionAttributeNames={"#s": "status", "#va": "viewedAt", "#u": "updatedAt"},
            ExpressionAttributeValues={":viewed": "VIEWED", ":pending": "PENDING", ":now": now},
            ReturnValues="ALL_NEW",
        )
        return res["Attributes"]
    except ClientError as err:
        if _is(err, "ConditionalCheckFailedException"):  # status moved meanwhile
            return table("applications").get_item(Key=key, ConsistentRead=True).get("Item") or item
        raise


def _invalid_transition(current, action, target):
    return Conflict(f"Cannot {action} an application in status {current}",
                    code="INVALID_TRANSITION",
                    details={"from": current, "action": action, "to": target})


# ------------------------------------------------------------------- apply
@router.route("POST /v1/offers/{id}/applications", roles=("ETU",))
def apply_to_offer(req):
    offer_id = _path(req, "id")
    offer = _get_offer(offer_id)
    if offer.get("status") != "OPEN":
        raise Conflict("Offer is not open", code="OFFER_NOT_OPEN")

    now = now_iso()
    item = {
        "studentId": req.user_id,
        "offerId": offer_id,
        "companyId": offer["companyId"],
        "status": "PENDING",
        "createdAt": now,
        "updatedAt": now,
    }
    try:
        client().transact_write_items(TransactItems=[
            {"Update": {
                "TableName": table_name("users"),
                "Key": {"userId": _ser(req.user_id)},
                "UpdateExpression": "SET #ac = #ac + :one",
                "ConditionExpression": "#ac < :max",
                "ExpressionAttributeNames": {"#ac": "activeCount"},
                "ExpressionAttributeValues": {
                    ":one": _ser(1), ":max": _ser(MAX_ACTIVE_APPLICATIONS)},
            }},
            {"Put": {
                "TableName": table_name("applications"),
                "Item": _to_dynamo(item),
                "ConditionExpression": "attribute_not_exists(#sid)",
                "ExpressionAttributeNames": {"#sid": "studentId"},
            }},
        ])
    except ClientError as err:
        if not _is(err, "TransactionCanceledException"):
            raise
        codes = _cancel_codes(err)
        failed = "ConditionalCheckFailed"
        if len(codes) >= 2:
            users_failed, app_failed = codes[0] == failed, codes[1] == failed
        else:  # no reasons reported: find out whether the application exists
            exists = table("applications").get_item(
                Key=_app_key(req.user_id, offer_id), ConsistentRead=True).get("Item")
            users_failed, app_failed = not exists, bool(exists)
        if app_failed:
            raise Conflict("Already applied to this offer", code="ALREADY_APPLIED")
        if users_failed:
            raise Conflict(f"Maximum of {MAX_ACTIVE_APPLICATIONS} active applications reached",
                           code="APPLICATION_LIMIT")
        raise

    req.log.info("application_created", studentId=req.user_id, offerId=offer_id)
    return 201, public_application(item)


# -------------------------------------------------------------------- lists
@router.route("GET /v1/students/me/applications", roles=("ETU",))
def list_my_applications(req):
    items, cursor = _query_page(req, "studentId", req.user_id)
    return {"items": [public_application(i) for i in items], "nextCursor": cursor}


@router.route("GET /v1/offers/{id}/applications", roles=("ENT",))
def list_offer_applications(req):
    offer_id = _path(req, "id")
    offer = _get_offer(offer_id)
    if offer.get("companyId") != req.user_id:
        raise Forbidden("This offer belongs to another company")
    items, cursor = _query_page(req, "offerId", offer_id, index="byOffer")
    items = [_mark_viewed(i) if i.get("status") == "PENDING" else i for i in items]
    return {"items": [public_application(i) for i in items], "nextCursor": cursor}


# ------------------------------------------------------------ status change
@router.route("PATCH /v1/applications/{offerId}/{studentId}", roles=("ETU", "ENT"))
def update_application_status(req):
    offer_id, student_id = _path(req, "offerId"), _path(req, "studentId")
    body = req.json_body()
    unknown = sorted(set(body) - {"action"})
    if unknown:
        raise BadRequest("Unknown fields", details={"unknown": unknown})
    action = as_enum(body.get("action"), "action", ACTIONS)

    if action == "confirm":
        if req.role != "ETU":
            raise Forbidden("Action not allowed for this role")
        raise BadRequest("confirm is handled by the conventions service",
                         details={"field": "action"})
    role, sources, target = TRANSITIONS[action]
    if req.role != role:
        raise Forbidden("Action not allowed for this role")

    if req.role == "ETU" and student_id != req.user_id:
        raise Forbidden("Not your application")
    app = _get_application(student_id, offer_id)
    if req.role == "ENT" and app.get("companyId") != req.user_id:
        raise Forbidden("This application belongs to another company")

    current = app["status"]
    if current not in sources:
        raise _invalid_transition(current, action, target)

    now = now_iso()
    names = {"#s": "status", "#u": "updatedAt"}
    src_values = {f":src{i}": s for i, s in enumerate(sources)}
    cond = f"#s IN ({', '.join(src_values)})"
    values = {":new": target, ":now": now, **src_values}
    update = "SET #s = :new, #u = :now"

    if target in LEAVING_ACTIVE:
        try:
            client().transact_write_items(TransactItems=[
                {"Update": {
                    "TableName": table_name("applications"),
                    "Key": _to_dynamo(_app_key(student_id, offer_id)),
                    "UpdateExpression": update,
                    "ConditionExpression": cond,
                    "ExpressionAttributeNames": names,
                    "ExpressionAttributeValues": _to_dynamo(values),
                }},
                {"Update": {
                    "TableName": table_name("users"),
                    "Key": {"userId": _ser(student_id)},
                    "UpdateExpression": "SET #ac = #ac - :one",
                    "ConditionExpression": "#ac > :zero",
                    "ExpressionAttributeNames": {"#ac": "activeCount"},
                    "ExpressionAttributeValues": {":one": _ser(1), ":zero": _ser(0)},
                }},
            ])
        except ClientError as err:
            if not _is(err, "TransactionCanceledException"):
                raise
            codes = _cancel_codes(err)
            if (len(codes) >= 2 and codes[0] != "ConditionalCheckFailed"
                    and codes[1] == "ConditionalCheckFailed"):
                raise Conflict("Active application counter is out of sync",
                               code="COUNTER_OUT_OF_SYNC")
            raise _invalid_transition(current, action, target)
        updated = _get_application(student_id, offer_id)
    else:
        try:
            updated = table("applications").update_item(
                Key=_app_key(student_id, offer_id),
                UpdateExpression=update,
                ConditionExpression=cond,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
                ReturnValues="ALL_NEW",
            )["Attributes"]
        except ClientError as err:
            if _is(err, "ConditionalCheckFailedException"):
                raise _invalid_transition(current, action, target)
            raise

    req.log.info("application_status", studentId=student_id, offerId=offer_id,
                 action=action, status=target)
    return public_application(updated)


handler = router.handle
