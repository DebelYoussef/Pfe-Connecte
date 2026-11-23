"""Shared fixtures: moto tables built from infra/config.py (the real keys and indexes), a spy
that forbids Scan and records every Query, helpers to load handlers and call routes."""
import importlib.util
import json
import os
import sys
from pathlib import Path

os.environ.update({
    "JWT_SECRET": "test-secret",
    "AWS_DEFAULT_REGION": "us-east-1",
    "AWS_REGION": "us-east-1",
    "AWS_ACCESS_KEY_ID": "testing",
    "AWS_SECRET_ACCESS_KEY": "testing",
    "AWS_SESSION_TOKEN": "testing",
})
os.environ.pop("CONFIG_HEALTH_FUNCTION", None)

ROOT = Path(__file__).resolve().parents[1]
LAMBDAS = ROOT / "lambdas"
INFRA = ROOT / "infra"
for path in (str(LAMBDAS), str(INFRA)):
    if path not in sys.path:
        sys.path.insert(0, path)

import boto3  # noqa: E402
import pytest  # noqa: E402
from moto import mock_aws  # noqa: E402

import config as C  # noqa: E402  (infra/config.py)
from common import auth as authlib  # noqa: E402
from common import db  # noqa: E402

for _logical in C.TABLES:
    os.environ[f"TABLE_{_logical.upper()}"] = C.table_name(_logical)


def load_handler(name, directory):
    spec = importlib.util.spec_from_file_location(name, LAMBDAS / directory / "handler.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def create_tables(ddb):
    for logical, spec in C.TABLES.items():
        attrs = {}

        def key_schema(h, r):
            attrs[h[0]] = h[1]
            schema = [{"AttributeName": h[0], "KeyType": "HASH"}]
            if r:
                attrs[r[0]] = r[1]
                schema.append({"AttributeName": r[0], "KeyType": "RANGE"})
            return schema

        kwargs = {"TableName": C.table_name(logical), "BillingMode": "PAY_PER_REQUEST",
                  "KeySchema": key_schema(spec["hash"], spec["range"])}
        if spec["gsis"]:
            kwargs["GlobalSecondaryIndexes"] = [{
                "IndexName": g["name"], "KeySchema": key_schema(g["hash"], g["range"]),
                "Projection": {"ProjectionType": "ALL"}} for g in spec["gsis"]]
        kwargs["AttributeDefinitions"] = [
            {"AttributeName": n, "AttributeType": t} for n, t in attrs.items()]
        ddb.create_table(**kwargs)


class SpyTable:
    def __init__(self, real, calls):
        self._real, self._calls = real, calls

    def query(self, **kwargs):
        self._calls.append((self._real.name, kwargs.get("IndexName")))
        return self._real.query(**kwargs)

    def scan(self, **kwargs):
        raise AssertionError("Scan is forbidden")

    def __getattr__(self, name):
        return getattr(self._real, name)


class SpyResource:
    def __init__(self, real, calls):
        self._real, self._calls = real, calls

    def Table(self, name):
        return SpyTable(self._real.Table(name), self._calls)

    def __getattr__(self, name):
        return getattr(self._real, name)


@pytest.fixture
def ddb():
    """Raw client (assertions only: the tests may scan, the code under test may not)."""
    with mock_aws():
        client = boto3.client("dynamodb", region_name="us-east-1")
        create_tables(client)
        db._resource = None
        db._client = None
        yield client
        db._resource = None
        db._client = None


@pytest.fixture
def calls(ddb):
    """Every Query made by the code under test as (table, index); Scan raises."""
    log = []
    db._resource = SpyResource(boto3.resource("dynamodb", region_name="us-east-1"), log)
    return log


def token_for(user_id, role, etab=None):
    claims = {"sub": user_id, "role": role}
    if etab:
        claims["etab"] = etab
    return authlib.sign_token(claims)


def call(module, route, body=None, token=None, query=None, path=None, ip="1.2.3.4"):
    event = {
        "routeKey": route,
        "headers": {"authorization": f"Bearer {token}"} if token else {},
        "body": json.dumps(body) if body is not None else None,
        "queryStringParameters": query or None,
        "pathParameters": path or None,
        "requestContext": {"requestId": "test-req", "http": {"sourceIp": ip}},
    }
    res = module.handler(event, None)
    return res["statusCode"], json.loads(res["body"])
