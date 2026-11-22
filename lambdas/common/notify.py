"""In-app notifications: one Users-independent writer (create_notification) and the admin fan-out.

Notifications item: PK userId, SK sk = "<createdAt>#<id>" (see docs/schema.md 4.9).
Titles and bodies are written by the callers (French).
"""
import time

from boto3.dynamodb.conditions import Key

from .db import new_id, now_iso, table
from .enums import NOTIFICATION_LEVEL, NOTIFICATION_REF_TYPE, NOTIFICATION_TYPE

TTL_SECONDS = 90 * 24 * 3600
PAGE_SIZE = None  # DynamoDB page size for the byRole query (None = default 1 MB); tests lower it


def create_notification(user_id, type, title, body, ref_type, ref_id, level="INFO"):
    """Write one Notifications item and return it."""
    if type not in NOTIFICATION_TYPE:
        raise ValueError(f"Unknown notification type: {type}")
    if ref_type not in NOTIFICATION_REF_TYPE:
        raise ValueError(f"Unknown notification refType: {ref_type}")
    if level not in NOTIFICATION_LEVEL:
        raise ValueError(f"Unknown notification level: {level}")
    created_at = now_iso()
    item = {
        "userId": user_id,
        "sk": f"{created_at}#{new_id()}",
        "createdAt": created_at,
        "type": type,
        "title": title,
        "body": body,
        "refType": ref_type,
        "refId": ref_id,
        "level": level,
        "read": False,
        "ttl": int(time.time()) + TTL_SECONDS,
    }
    table("notifications").put_item(Item=item)
    return item


def list_admin_ids():
    """userId of every ADM user, from the byRole index (Query, all pages, never a scan)."""
    kwargs = {
        "IndexName": "byRole",
        "KeyConditionExpression": Key("role").eq("ADM"),
        "ProjectionExpression": "userId",
    }
    if PAGE_SIZE:
        kwargs["Limit"] = PAGE_SIZE
    ids = []
    while True:
        res = table("users").query(**kwargs)
        ids.extend(item["userId"] for item in res.get("Items", []))
        last = res.get("LastEvaluatedKey")
        if not last:
            return ids
        kwargs["ExclusiveStartKey"] = last


def notify_admins(type, title, body, ref_type, ref_id, level="INFO", exclude_user_id=None):
    """Notify every ADM user except exclude_user_id (one id, or a collection of ids).
    Returns the notified user ids."""
    if exclude_user_id is None:
        excluded = set()
    elif isinstance(exclude_user_id, str):
        excluded = {exclude_user_id}
    else:
        excluded = set(exclude_user_id)
    notified = []
    for user_id in list_admin_ids():
        if user_id in excluded:
            continue
        create_notification(user_id, type, title, body, ref_type, ref_id, level)
        notified.append(user_id)
    return notified