"""notifications Lambda: list the caller's in-app notifications and mark one as read.

Table Notifications: PK userId, SK sk = "<createdAt>#<id>" (docs/schema.md 4.9).
Open to every authenticated role (x-roles: []). Query and UpdateItem only, never a Scan.
"""
import base64
import binascii
import json
from urllib.parse import unquote

from botocore.exceptions import ClientError

from common.db import table
from common.errors import BadRequest, NotFound
from common.response import Router

router = Router()

DEFAULT_LIMIT = 20
MAX_LIMIT = 50


# ------------------------------------------------------------------ helpers
def public_notification(item):
    """Only the openapi Notification fields: never userId or ttl."""
    sk = item["sk"]
    out = {
        "id": sk,
        "createdAt": item.get("createdAt") or sk.split("#", 1)[0],
        "type": item.get("type"),
        "title": item.get("title", ""),
    }
    for field in ("body", "refType", "refId"):
        if field in item:
            out[field] = item[field]
    out["level"] = item.get("level") or "INFO"  # absent = INFO (schema.md 4.9)
    out["read"] = bool(item.get("read", False))
    return out


def _limit(query):
    raw = query.get("limit")
    if raw in (None, ""):
        return DEFAULT_LIMIT
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise BadRequest("limit must be an integer", code="VALIDATION_ERROR",
                         details={"field": "limit"})
    if value < 1:
        raise BadRequest("limit must be at least 1", code="VALIDATION_ERROR",
                         details={"field": "limit"})
    return min(value, MAX_LIMIT)


def _encode_cursor(key):
    raw = json.dumps(key, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _decode_cursor(cursor, user_id):
    """Cursor = base64 of the LastEvaluatedKey. It must belong to the caller."""
    try:
        key = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
    except (ValueError, binascii.Error, UnicodeDecodeError):
        key = None
    if (not isinstance(key, dict) or set(key) != {"userId", "sk"}
            or key["userId"] != user_id or not isinstance(key["sk"], str)):
        raise BadRequest("Invalid cursor", code="VALIDATION_ERROR", details={"field": "cursor"})
    return key


# ----------------------------------------------------------------- list
@router.route("GET /v1/notifications")
def list_notifications(req):
    limit = _limit(req.query)
    kwargs = {
        "KeyConditionExpression": "userId = :u",
        "ExpressionAttributeValues": {":u": req.user_id},
        "ScanIndexForward": False,
        "Limit": limit,
        "ConsistentRead": True,
    }
    cursor = req.query.get("cursor")
    if cursor:
        kwargs["ExclusiveStartKey"] = _decode_cursor(cursor, req.user_id)

    res = table("notifications").query(**kwargs)
    last = res.get("LastEvaluatedKey")
    return {
        "items": [public_notification(i) for i in res.get("Items", [])],
        "nextCursor": _encode_cursor(last) if last else None,
    }


# ----------------------------------------------------------- mark as read
@router.route("PATCH /v1/notifications/{id}/read")
def mark_read(req):
    notif_id = unquote(req.path_params.get("id") or "")  # accepts "%23" and "#"
    if not notif_id:
        raise NotFound("Notification not found")
    try:
        res = table("notifications").update_item(
            # the key carries the caller's own userId: another user's id simply does not exist
            Key={"userId": req.user_id, "sk": notif_id},
            UpdateExpression="SET #r = :t",
            ConditionExpression="attribute_exists(#u)",
            ExpressionAttributeNames={"#r": "read", "#u": "userId"},
            ExpressionAttributeValues={":t": True},
            ReturnValues="ALL_NEW",
        )
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise NotFound("Notification not found")
        raise
    return public_notification(res["Attributes"])


handler = router.handle
