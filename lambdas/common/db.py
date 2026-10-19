"""DynamoDB access. Table names come from env vars TABLE_<LOGICAL> set by deploy.py."""
import datetime
import os
import uuid

_resource = None
_client = None


def _res():
    global _resource
    if _resource is None:
        import boto3
        _resource = boto3.resource("dynamodb")
    return _resource


def client():
    """Low-level client, needed for transact_write_items."""
    global _client
    if _client is None:
        import boto3
        _client = boto3.client("dynamodb")
    return _client


def table_name(logical):
    name = os.environ.get(f"TABLE_{logical.upper()}")
    if not name:
        raise RuntimeError(f"Missing env var TABLE_{logical.upper()}")
    return name


def table(logical):
    return _res().Table(table_name(logical))


def new_id():
    return str(uuid.uuid4())


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
