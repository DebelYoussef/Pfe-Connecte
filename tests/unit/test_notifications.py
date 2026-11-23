import importlib.util
import json
import os
import sys
from pathlib import Path
from urllib.parse import quote

os.environ.update({
    "JWT_SECRET": "test-secret",
    "TABLE_NOTIFICATIONS": "pfe-connect-Notifications",
    "AWS_DEFAULT_REGION": "us-east-1",
    "AWS_ACCESS_KEY_ID": "testing",
    "AWS_SECRET_ACCESS_KEY": "testing",
    "AWS_SESSION_TOKEN": "testing",
})

import boto3
import pytest
from moto import mock_aws

LAMBDAS = Path(__file__).resolve().parents[2] / "lambdas"
sys.path.insert(0, str(LAMBDAS))

from common import auth as authlib  # noqa: E402
from common import db  # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "notifications_handler", LAMBDAS / "notifications" / "handler.py")
notif = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(notif)

TABLE = "pfe-connect-Notifications"
ALICE, BOB = "user-alice", "user-bob"


def token(user_id, role="ETU"):
    return authlib.sign_token({"sub": user_id, "role": role})


def seed(res, user_id, n, prefix="n", **extra):
    """n items for user_id with increasing createdAt; returns their sort keys oldest first."""
    sks = []
    for i in range(n):
        created = f"2026-11-0{i + 1}T10:00:00Z"
        sk = f"{created}#{prefix}{i}"
        res.Table(TABLE).put_item(Item={
            "userId": user_id, "sk": sk, "createdAt": created,
            "type": "CONVENTION_APPROVED", "title": f"title {i}", "body": f"body {i}",
            "refType": "CONVENTION", "refId": f"conv-{i}", "read": False,
            "ttl": 1_900_000_000, **extra})
        sks.append(sk)
    return sks


@pytest.fixture
def aws():
    with mock_aws():
        ddb = boto3.client("dynamodb", region_name="us-east-1")
        ddb.create_table(
            TableName=TABLE,
            KeySchema=[{"AttributeName": "userId", "KeyType": "HASH"},
                       {"AttributeName": "sk", "KeyType": "RANGE"}],
            AttributeDefinitions=[{"AttributeName": "userId", "AttributeType": "S"},
                                  {"AttributeName": "sk", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST")
        db._resource = None
        db._client = None
        yield boto3.resource("dynamodb", region_name="us-east-1")


def call(route, tok=None, query=None, path=None):
    event = {
        "routeKey": route,
        "headers": {"authorization": f"Bearer {tok}"} if tok else {},
        "queryStringParameters": query,
        "pathParameters": path,
        "requestContext": {"requestId": "test-req"},
    }
    res = notif.handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def list_(tok, **query):
    return call("GET /v1/notifications", tok, query or None)


def read(tok, notif_id):
    return call("PATCH /v1/notifications/{id}/read", tok, path={"id": notif_id})


def test_list_only_callers_items_newest_first(aws):
    seed(aws, ALICE, 3)
    seed(aws, BOB, 2, prefix="b")
    status, body = list_(token(ALICE))
    assert status == 200
    assert [i["title"] for i in body["items"]] == ["title 2", "title 1", "title 0"]
    assert body["nextCursor"] is None
    assert all("#n" in i["id"] for i in body["items"])


def test_list_shape_level_default_and_no_leak(aws):
    seed(aws, ALICE, 1)
    seed(aws, ALICE, 1, prefix="w", level="WARNING")  # same day, other id
    items = list_(token(ALICE))[1]["items"]
    for item in items:
        assert "userId" not in item and "ttl" not in item and "sk" not in item
        assert set(item) == {"id", "createdAt", "type", "title", "body", "refType",
                             "refId", "level", "read"}
    assert {i["level"] for i in items} == {"INFO", "WARNING"}
    first = next(i for i in items if i["level"] == "INFO")
    assert first["id"] == "2026-11-01T10:00:00Z#n0"
    assert first["createdAt"] == "2026-11-01T10:00:00Z" and first["read"] is False


def test_list_empty(aws):
    assert list_(token(ALICE)) == (200, {"items": [], "nextCursor": None})


def test_list_pagination(aws):
    seed(aws, ALICE, 5)
    seen, cursor, pages = [], None, 0
    while True:
        query = {"limit": "2"}
        if cursor:
            query["cursor"] = cursor
        status, body = list_(token(ALICE), **query)
        assert status == 200
        seen += [i["title"] for i in body["items"]]
        pages += 1
        cursor = body["nextCursor"]
        if not cursor:
            break
    assert seen == ["title 4", "title 3", "title 2", "title 1", "title 0"]
    assert pages == 3


def test_list_limit_default_clamp_and_invalid(aws):
    seed(aws, ALICE, 5)
    assert len(list_(token(ALICE))[1]["items"]) == 5
    assert len(list_(token(ALICE), limit="1")[1]["items"]) == 1
    assert list_(token(ALICE), limit="100")[0] == 200  # clamped to 50, contract allows 100
    for bad in ("0", "-1", "abc"):
        status, body = list_(token(ALICE), limit=bad)
        assert status == 400 and body["error"]["code"] == "VALIDATION_ERROR"


def test_list_max_limit_is_50(aws):
    for day in range(1, 8):
        for i in range(8):
            aws.Table(TABLE).put_item(Item={
                "userId": ALICE, "sk": f"2026-10-0{day}T10:00:0{i}Z#x", "createdAt": "x",
                "type": "CONVENTION_APPROVED", "title": "t", "read": False})
    body = list_(token(ALICE), limit="100")[1]
    assert len(body["items"]) == 50 and body["nextCursor"]


def test_bad_cursor_400(aws):
    seed(aws, ALICE, 3)
    status, body = list_(token(ALICE), limit="1")
    cursor = body["nextCursor"]
    assert list_(token(BOB), cursor=cursor)[0] == 400  # a cursor of another user
    for bad in ("not-base64!!", "e30", "bm90LWpzb24"):
        assert list_(token(ALICE), cursor=bad)[0] == 400


def test_requires_authentication(aws):
    assert list_(None)[0] == 401
    assert read(None, "x")[0] == 401


def test_open_to_every_role(aws):
    seed(aws, "u1", 1)
    for role in ("ETU", "ENT", "ENS", "RESP", "ADM"):
        assert list_(token("u1", role))[0] == 200


def test_mark_read(aws):
    sks = seed(aws, ALICE, 2)
    status, body = read(token(ALICE), sks[0])
    assert status == 200
    assert body["id"] == sks[0] and body["read"] is True and body["title"] == "title 0"
    assert "userId" not in body and "ttl" not in body
    stored = aws.Table(TABLE).get_item(Key={"userId": ALICE, "sk": sks[0]})["Item"]
    assert stored["read"] is True and stored["ttl"] == 1_900_000_000
    other = aws.Table(TABLE).get_item(Key={"userId": ALICE, "sk": sks[1]})["Item"]
    assert other["read"] is False
    flags = {i["id"]: i["read"] for i in list_(token(ALICE))[1]["items"]}
    assert flags == {sks[0]: True, sks[1]: False}


def test_mark_read_twice_is_idempotent(aws):
    sk = seed(aws, ALICE, 1)[0]
    first = read(token(ALICE), sk)
    second = read(token(ALICE), sk)
    assert first == second and second[0] == 200 and second[1]["read"] is True


def test_other_users_id_is_404(aws):
    sk = seed(aws, BOB, 1)[0]
    status, body = read(token(ALICE), sk)
    assert status == 404 and body["error"]["code"] == "NOT_FOUND"
    assert aws.Table(TABLE).get_item(Key={"userId": BOB, "sk": sk})["Item"]["read"] is False
    # and no item was created for the caller by the update
    assert list_(token(ALICE))[1]["items"] == []


def test_unknown_id_404(aws):
    assert read(token(ALICE), "2026-01-01T00:00:00Z#nope")[0] == 404
    assert read(token(ALICE), "")[0] == 404


def test_encoded_and_decoded_id(aws):
    a, b = seed(aws, ALICE, 2)
    assert "#" in a
    assert read(token(ALICE), quote(a, safe=""))[1]["read"] is True  # 2026-...%23n0
    assert "%23" in quote(b, safe="")
    assert read(token(ALICE), b)[1]["read"] is True  # decoded
    assert read(token(ALICE), quote(a, safe=""))[0] == 200  # still fine
