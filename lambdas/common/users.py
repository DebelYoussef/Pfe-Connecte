"""Helpers shared by the Lambdas that write or return Users items (admin; same transaction as signup)."""
from decimal import Decimal

from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

from .db import client, table_name
from .errors import Conflict

# Only the openapi User fields: never passwordHash, gsiAll or the internal sparse keys.
USER_FIELDS = (
    "userId", "email", "role", "etab", "firstName", "lastName", "department",
    "specialty", "skills", "gouvernorat", "cvKey", "expertise", "companyName",
    "activeCount", "conventionId", "createdAt",
)


def plain(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, (set, frozenset)):
        return sorted(plain(v) for v in value)
    if isinstance(value, list):
        return [plain(v) for v in value]
    return value


def public_user(item):
    return {k: plain(item[k]) for k in USER_FIELDS if k in item}


def create_user_item(item):
    """Users + Reference EMAIL in one transaction, both attribute_not_exists (schema.md section 6).

    The same transaction as signup. 409 EMAIL_TAKEN when the user id or the e-mail already exists.
    """
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
                "Item": to_dynamo({"type": "EMAIL", "id": item["email"], "userId": item["userId"]}),
                "ConditionExpression": "attribute_not_exists(#t)",
                "ExpressionAttributeNames": {"#t": "type"},
            }},
        ])
    except ClientError as err:
        if err.response["Error"]["Code"] == "TransactionCanceledException":
            reasons = err.response.get("CancellationReasons") or []
            # a throttled or conflicting transaction is not a duplicate e-mail
            if not reasons or any(r.get("Code") == "ConditionalCheckFailed" for r in reasons):
                raise Conflict("Email already registered", code="EMAIL_TAKEN")
        raise
