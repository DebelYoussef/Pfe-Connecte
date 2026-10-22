import importlib.util
import json
import sys
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

LAMBDAS = Path(__file__).resolve().parents[2] / "lambdas"
sys.path.insert(0, str(LAMBDAS))

from common import auth, db  # noqa: E402

_spec = importlib.util.spec_from_file_location("offers_handler", LAMBDAS / "offers" / "handler.py")
offers = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(offers)

OFFER = {
    "title": "Stage IA",
    "description": "Build a RAG pipeline for legal documents",
    "skills": ["Python", "Machine Learning"],
    "keywords": ["Données", "IA"],
    "gouvernorat": "Tunis",
    "durationWeeks": 12,
}


@pytest.fixture
def ddb(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("TABLE_OFFERS", "pfe-connect-Offers")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    db._resource = None
    db._client = None
    with mock_aws():
        def gsi(name, pk, sk):
            return {"IndexName": name,
                    "KeySchema": [{"AttributeName": pk, "KeyType": "HASH"},
                                  {"AttributeName": sk, "KeyType": "RANGE"}],
                    "Projection": {"ProjectionType": "ALL"}}

        boto3.client("dynamodb").create_table(
            TableName="pfe-connect-Offers",
            BillingMode="PAY_PER_REQUEST",
            KeySchema=[{"AttributeName": "offerId", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": a, "AttributeType": "S"} for a in
                                  ("offerId", "companyId", "createdAt", "status", "gouvernoratCreatedAt")],
            GlobalSecondaryIndexes=[gsi("byCompany", "companyId", "createdAt"),
                                    gsi("openByRegion", "status", "gouvernoratCreatedAt")],
        )
        yield boto3.resource("dynamodb").Table("pfe-connect-Offers")
    db._resource = None
    db._client = None


def tok(role, sub):
    return auth.sign_token({"sub": sub, "role": role})


def call(route, token=None, body=None, path=None, query=None):
    event = {
        "routeKey": route,
        "headers": {"authorization": f"Bearer {token}"} if token else {},
        "pathParameters": path,
        "queryStringParameters": query,
        "body": json.dumps(body) if body is not None else None,
        "requestContext": {"requestId": "test-request"},
    }
    res = offers.handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def make_offer(token, **overrides):
    status, body = call("POST /v1/offers", token, {**OFFER, **overrides})
    assert status == 201, body
    return body


def patch(token, offer_id, body):
    return call("PATCH /v1/offers/{id}", token, body, path={"id": offer_id})


def test_create_offer_success(ddb):
    status, body = call("POST /v1/offers", tok("ENT", "ent-1"), OFFER)
    assert status == 201
    assert body["companyId"] == "ent-1"
    assert body["status"] == "OPEN"
    assert body["similar"] == []
    assert body["skills"] == ["machine learning", "python"]
    assert body["keywords"] == ["donnees", "ia"]
    assert body["durationWeeks"] == 12
    assert "gouvernoratCreatedAt" not in body

    item = ddb.get_item(Key={"offerId": body["offerId"]})["Item"]
    assert item["skills"] == {"machine learning", "python"}
    assert item["gouvernoratCreatedAt"] == f"Tunis#{body['createdAt']}"


def test_student_cannot_create(ddb):
    status, body = call("POST /v1/offers", tok("ETU", "stu-1"), OFFER)
    assert status == 403
    assert body["error"]["code"] == "FORBIDDEN"
    assert ddb.scan()["Items"] == []


def test_list_open_offers(ddb):
    ent, stu = tok("ENT", "ent-1"), tok("ETU", "stu-1")
    tunis = make_offer(ent, gouvernorat="Tunis")
    sfax = make_offer(ent, gouvernorat="Sfax")
    closed = make_offer(ent, gouvernorat="Tunis")
    assert patch(ent, closed["offerId"], {"status": "CLOSED"})[0] == 200

    status, page = call("GET /v1/offers", stu)
    assert status == 200
    assert {o["offerId"] for o in page["items"]} == {tunis["offerId"], sfax["offerId"]}
    assert page["nextCursor"] is None

    status, page = call("GET /v1/offers", stu, query={"gouvernorat": "Tunis"})
    assert [o["offerId"] for o in page["items"]] == [tunis["offerId"]]


def test_list_pagination(ddb):
    ent, stu = tok("ENT", "ent-1"), tok("ETU", "stu-1")
    a = make_offer(ent, gouvernorat="Tunis")
    b = make_offer(ent, gouvernorat="Sfax")

    status, first = call("GET /v1/offers", stu, query={"limit": "1"})
    assert status == 200 and len(first["items"]) == 1 and first["nextCursor"]
    status, second = call("GET /v1/offers", stu, query={"limit": "1", "cursor": first["nextCursor"]})
    assert status == 200 and len(second["items"]) == 1
    assert {first["items"][0]["offerId"], second["items"][0]["offerId"]} == {a["offerId"], b["offerId"]}

    assert call("GET /v1/offers", stu, query={"cursor": "%%%"})[0] == 400
    assert call("GET /v1/offers", stu, query={"limit": "abc"})[0] == 400


def test_company_lists_own_offers_with_mine(ddb):
    ent1, ent2 = tok("ENT", "ent-1"), tok("ENT", "ent-2")
    open_offer = make_offer(ent1)
    closed = make_offer(ent1, gouvernorat="Sfax")
    make_offer(ent2)
    patch(ent1, closed["offerId"], {"status": "CLOSED"})

    status, page = call("GET /v1/offers", ent1, query={"mine": "true"})
    assert status == 200
    assert {o["offerId"] for o in page["items"]} == {open_offer["offerId"], closed["offerId"]}


def test_patch_by_owner(ddb):
    ent = tok("ENT", "ent-1")
    offer = make_offer(ent)

    status, body = patch(ent, offer["offerId"], {
        "title": "Stage IA v2", "skills": ["Docker"], "gouvernorat": "Sfax", "status": "CLOSED"})
    assert status == 200
    assert body["title"] == "Stage IA v2"
    assert body["status"] == "CLOSED"
    assert body["skills"] == ["docker"]
    assert body["gouvernorat"] == "Sfax"

    item = ddb.get_item(Key={"offerId": offer["offerId"]})["Item"]
    assert item["gouvernoratCreatedAt"] == f"Sfax#{offer['createdAt']}"
    assert call("GET /v1/offers/{id}", tok("ETU", "stu-1"), path={"id": offer["offerId"]})[1]["title"] == "Stage IA v2"


def test_patch_by_another_company_is_forbidden(ddb):
    offer = make_offer(tok("ENT", "ent-1"))
    status, body = patch(tok("ENT", "ent-2"), offer["offerId"], {"title": "Hijacked"})
    assert status == 403
    assert body["error"]["code"] == "FORBIDDEN"
    assert ddb.get_item(Key={"offerId": offer["offerId"]})["Item"]["title"] == OFFER["title"]


def test_invalid_status_change_is_conflict(ddb):
    ent = tok("ENT", "ent-1")
    offer = make_offer(ent)
    assert patch(ent, offer["offerId"], {"status": "FILLED"})[0] == 200

    status, body = patch(ent, offer["offerId"], {"status": "OPEN"})  # FILLED is final
    assert status == 409
    assert body["error"]["code"] == "CONFLICT"
    assert ddb.get_item(Key={"offerId": offer["offerId"]})["Item"]["status"] == "FILLED"

    assert patch(ent, offer["offerId"], {"status": "DONE"})[0] == 400


def test_unknown_offer_is_404(ddb):
    missing = "00000000-0000-4000-8000-000000000000"
    assert call("GET /v1/offers/{id}", tok("ETU", "stu-1"), path={"id": missing})[0] == 404
    status, body = patch(tok("ENT", "ent-1"), missing, {"title": "x"})
    assert status == 404
    assert body["error"]["code"] == "NOT_FOUND"


def test_recommendations_stub(ddb):
    assert call("GET /v1/students/me/recommendations", tok("ETU", "stu-1")) == (200, {"items": []})
    assert call("GET /v1/students/me/recommendations", tok("ENT", "ent-1"))[0] == 403
