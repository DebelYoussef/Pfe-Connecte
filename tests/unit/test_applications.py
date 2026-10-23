"""Unit tests for lambdas/applications/handler.py (pytest + moto)."""
import importlib.util
import json
import sys
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "lambdas"))

from common import auth as authlib  # noqa: E402
from common import db  # noqa: E402

TABLES = ("Users", "Offers", "Applications")
STUDENT, STUDENT2 = "stu-1", "stu-2"
COMPANY, OTHER_COMPANY = "comp-1", "comp-2"


def _load_handler():
    spec = importlib.util.spec_from_file_location(
        "applications_handler", ROOT / "lambdas" / "applications" / "handler.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret")
    for name in TABLES:
        monkeypatch.setenv(f"TABLE_{name.upper()}", f"pfe-connect-{name}")
    with mock_aws():
        db._resource = None
        db._client = None
        ddb = boto3.client("dynamodb")
        ddb.create_table(
            TableName="pfe-connect-Users", BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[{"AttributeName": "userId", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "userId", "KeyType": "HASH"}])
        ddb.create_table(
            TableName="pfe-connect-Offers", BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[{"AttributeName": "offerId", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "offerId", "KeyType": "HASH"}])
        ddb.create_table(
            TableName="pfe-connect-Applications", BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[{"AttributeName": "studentId", "AttributeType": "S"},
                                  {"AttributeName": "offerId", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "studentId", "KeyType": "HASH"},
                       {"AttributeName": "offerId", "KeyType": "RANGE"}],
            GlobalSecondaryIndexes=[{
                "IndexName": "byOffer",
                "KeySchema": [{"AttributeName": "offerId", "KeyType": "HASH"},
                              {"AttributeName": "studentId", "KeyType": "RANGE"}],
                "Projection": {"ProjectionType": "ALL"}}])
        res = boto3.resource("dynamodb")
        res.Table("pfe-connect-Users").put_item(
            Item={"userId": STUDENT, "role": "ETU", "activeCount": 0})
        res.Table("pfe-connect-Users").put_item(
            Item={"userId": STUDENT2, "role": "ETU", "activeCount": 0})
        yield _load_handler()
        db._resource = None
        db._client = None


# ------------------------------------------------------------------ helpers
def _tables():
    res = boto3.resource("dynamodb")
    return {n: res.Table(f"pfe-connect-{n}") for n in TABLES}


def add_offer(offer_id, status="OPEN", company=COMPANY):
    _tables()["Offers"].put_item(
        Item={"offerId": offer_id, "companyId": company, "title": "T", "status": status})


def seed_application(offer_id, status, student=STUDENT, company=COMPANY, active_count=None):
    t = _tables()
    t["Applications"].put_item(Item={
        "studentId": student, "offerId": offer_id, "companyId": company,
        "status": status, "createdAt": "2026-10-01T00:00:00Z",
        "updatedAt": "2026-10-01T00:00:00Z"})
    if active_count is not None:
        t["Users"].update_item(Key={"userId": student},
                               UpdateExpression="SET activeCount = :n",
                               ExpressionAttributeValues={":n": active_count})


def active_count(student=STUDENT):
    item = _tables()["Users"].get_item(Key={"userId": student}, ConsistentRead=True)["Item"]
    return int(item["activeCount"])


def stored_status(offer_id, student=STUDENT):
    item = _tables()["Applications"].get_item(
        Key={"studentId": student, "offerId": offer_id}, ConsistentRead=True)["Item"]
    return item["status"]


def call(h, route, uid, role, path=None, body=None, query=None):
    token = authlib.sign_token({"sub": uid, "role": role})
    event = {
        "routeKey": route,
        "headers": {"Authorization": f"Bearer {token}"},
        "pathParameters": path or {},
        "queryStringParameters": query,
        "requestContext": {"requestId": "req-1"},
    }
    if body is not None:
        event["body"] = json.dumps(body)
    resp = h.handler(event, None)
    return resp["statusCode"], json.loads(resp["body"])


def apply(h, offer_id, student=STUDENT):
    return call(h, "POST /v1/offers/{id}/applications", student, "ETU", {"id": offer_id})


def patch(h, offer_id, student_id, action, uid, role):
    return call(h, "PATCH /v1/applications/{offerId}/{studentId}", uid, role,
                {"offerId": offer_id, "studentId": student_id}, {"action": action})


# -------------------------------------------------------------------- apply
def test_apply_success_increments_active_count(env):
    add_offer("o1")
    status, body = apply(env, "o1")
    assert status == 201
    assert body["studentId"] == STUDENT and body["offerId"] == "o1"
    assert body["status"] == "PENDING" and body["companyId"] == COMPANY
    assert active_count() == 1
    assert stored_status("o1") == "PENDING"


def test_sixth_application_is_rejected(env):
    for i in range(6):
        add_offer(f"o{i}")
    for i in range(5):
        assert apply(env, f"o{i}")[0] == 201
    status, body = apply(env, "o5")
    assert status == 409
    assert body["error"]["code"] == "APPLICATION_LIMIT"
    assert active_count() == 5
    assert "Item" not in _tables()["Applications"].get_item(
        Key={"studentId": STUDENT, "offerId": "o5"})


def test_duplicate_application_is_rejected(env):
    add_offer("o1")
    assert apply(env, "o1")[0] == 201
    status, body = apply(env, "o1")
    assert status == 409
    assert body["error"]["code"] == "ALREADY_APPLIED"
    assert active_count() == 1


def test_apply_to_closed_offer_fails(env):
    add_offer("o1", status="CLOSED")
    status, body = apply(env, "o1")
    assert status == 409
    assert body["error"]["code"] == "OFFER_NOT_OPEN"
    assert active_count() == 0


def test_apply_to_unknown_offer_is_404(env):
    assert apply(env, "nope")[0] == 404


def test_company_cannot_apply(env):
    add_offer("o1")
    status, _ = call(env, "POST /v1/offers/{id}/applications", COMPANY, "ENT", {"id": "o1"})
    assert status == 403


# ------------------------------------------------------------------- status
def test_company_rejects_and_active_count_decrements(env):
    add_offer("o1")
    apply(env, "o1")
    status, body = patch(env, "o1", STUDENT, "reject", COMPANY, "ENT")
    assert status == 200 and body["status"] == "REJECTED"
    assert active_count() == 0


def test_student_withdraws(env):
    add_offer("o1")
    apply(env, "o1")
    status, body = patch(env, "o1", STUDENT, "withdraw", STUDENT, "ETU")
    assert status == 200 and body["status"] == "WITHDRAWN"
    assert active_count() == 0


def test_student_declines_accepted_application(env):
    add_offer("o1")
    seed_application("o1", "ACCEPTED", active_count=1)
    status, body = patch(env, "o1", STUDENT, "decline", STUDENT, "ETU")
    assert status == 200 and body["status"] == "DECLINED"
    assert active_count() == 0


def test_another_company_gets_403(env):
    add_offer("o1")
    apply(env, "o1")
    status, _ = patch(env, "o1", STUDENT, "reject", OTHER_COMPANY, "ENT")
    assert status == 403
    assert stored_status("o1") == "PENDING" and active_count() == 1
    status, _ = call(env, "GET /v1/offers/{id}/applications", OTHER_COMPANY, "ENT", {"id": "o1"})
    assert status == 403


def test_student_cannot_touch_another_students_application(env):
    add_offer("o1")
    apply(env, "o1")
    status, _ = patch(env, "o1", STUDENT, "withdraw", STUDENT2, "ETU")
    assert status == 403
    assert stored_status("o1") == "PENDING"


def test_wrong_role_for_action_is_403(env):
    add_offer("o1")
    apply(env, "o1")
    assert patch(env, "o1", STUDENT, "withdraw", COMPANY, "ENT")[0] == 403
    assert patch(env, "o1", STUDENT, "accept", STUDENT, "ETU")[0] == 403


def test_invalid_transition_is_409(env):
    add_offer("o1")
    apply(env, "o1")
    # PENDING cannot go straight to IN_PROGRESS
    status, body = patch(env, "o1", STUDENT, "in_progress", COMPANY, "ENT")
    assert status == 409 and body["error"]["code"] == "INVALID_TRANSITION"
    # a rejected application is final and must not decrement twice
    assert patch(env, "o1", STUDENT, "reject", COMPANY, "ENT")[0] == 200
    assert patch(env, "o1", STUDENT, "accept", COMPANY, "ENT")[0] == 409
    assert patch(env, "o1", STUDENT, "withdraw", STUDENT, "ETU")[0] == 409
    assert active_count() == 0
    # a student cannot decline before acceptance
    add_offer("o2")
    apply(env, "o2")
    assert patch(env, "o2", STUDENT, "decline", STUDENT, "ETU")[0] == 409
    assert active_count() == 1


def test_company_progression_and_confirm_not_handled(env):
    add_offer("o1")
    seed_application("o1", "VIEWED", active_count=1)
    status, body = patch(env, "o1", STUDENT, "in_progress", COMPANY, "ENT")
    assert status == 200 and body["status"] == "IN_PROGRESS"
    status, body = patch(env, "o1", STUDENT, "accept", COMPANY, "ENT")
    assert status == 200 and body["status"] == "ACCEPTED"
    assert active_count() == 1  # still active
    assert patch(env, "o1", STUDENT, "confirm", STUDENT, "ETU")[0] == 400
    assert stored_status("o1") == "ACCEPTED"


def test_bad_action_and_unknown_field_are_400(env):
    add_offer("o1")
    apply(env, "o1")
    assert patch(env, "o1", STUDENT, "explode", COMPANY, "ENT")[0] == 400
    status, _ = call(env, "PATCH /v1/applications/{offerId}/{studentId}", COMPANY, "ENT",
                     {"offerId": "o1", "studentId": STUDENT},
                     {"action": "reject", "status": "ACCEPTED"})
    assert status == 400


# -------------------------------------------------------------------- lists
def test_list_mine_with_pagination(env):
    for i in range(3):
        add_offer(f"o{i}")
        apply(env, f"o{i}")
    status, page = call(env, "GET /v1/students/me/applications", STUDENT, "ETU",
                        query={"limit": "2"})
    assert status == 200 and len(page["items"]) == 2 and page["nextCursor"]
    status, page2 = call(env, "GET /v1/students/me/applications", STUDENT, "ETU",
                         query={"limit": "2", "cursor": page["nextCursor"]})
    assert status == 200 and len(page2["items"]) == 1
    seen = {i["offerId"] for i in page["items"] + page2["items"]}
    assert seen == {"o0", "o1", "o2"}


def test_list_for_offer_marks_pending_as_viewed(env):
    add_offer("o1")
    apply(env, "o1", STUDENT)
    apply(env, "o1", STUDENT2)
    status, page = call(env, "GET /v1/offers/{id}/applications", COMPANY, "ENT", {"id": "o1"})
    assert status == 200 and len(page["items"]) == 2
    assert all(i["status"] == "VIEWED" and "viewedAt" in i for i in page["items"])
    assert stored_status("o1") == "VIEWED"
    assert active_count() == 1  # VIEWED is still active


def test_forged_cursor_is_rejected(env):
    import base64
    cursor = base64.urlsafe_b64encode(
        json.dumps({"studentId": STUDENT2, "offerId": "o1"}).encode()).decode()
    status, _ = call(env, "GET /v1/students/me/applications", STUDENT, "ETU",
                     query={"cursor": cursor})
    assert status == 400
