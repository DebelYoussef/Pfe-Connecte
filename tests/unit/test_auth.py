import importlib.util
import json
import os
import sys
from pathlib import Path

os.environ.update({
    "JWT_SECRET": "test-secret",
    "TABLE_USERS": "pfe-connect-Users",
    "TABLE_REFERENCE": "pfe-connect-Reference",
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

_spec = importlib.util.spec_from_file_location("auth_handler", LAMBDAS / "auth" / "handler.py")
auth_handler = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(auth_handler)

STUDENT = {
    "email": "Sami.Ben@Example.tn", "password": "s3cretpass", "role": "ETU",
    "firstName": "Sami", "lastName": "Ben Ali", "etab": "ETAB1",
    "department": "INFO", "specialty": "GL", "gouvernorat": "Tunis",
    "skills": ["Python", "Réseaux", "python"],
}


@pytest.fixture
def aws():
    with mock_aws():
        ddb = boto3.client("dynamodb", region_name="us-east-1")
        ddb.create_table(
            TableName="pfe-connect-Users",
            KeySchema=[{"AttributeName": "userId", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "userId", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST")
        ddb.create_table(
            TableName="pfe-connect-Reference",
            KeySchema=[{"AttributeName": "type", "KeyType": "HASH"},
                       {"AttributeName": "id", "KeyType": "RANGE"}],
            AttributeDefinitions=[{"AttributeName": "type", "AttributeType": "S"},
                                  {"AttributeName": "id", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST")
        ddb.put_item(TableName="pfe-connect-Reference",
                     Item={"type": {"S": "ETAB"}, "id": {"S": "ETAB1"}, "name": {"S": "Uni 1"}})
        db._resource = None
        db._client = None
        yield ddb


def call(route, body=None, token=None):
    event = {
        "routeKey": route,
        "headers": {"authorization": f"Bearer {token}"} if token else {},
        "body": json.dumps(body) if body is not None else None,
        "requestContext": {"requestId": "test-req"},
    }
    res = auth_handler.handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def signup(payload=None):
    return call("POST /v1/auth/signup", payload or STUDENT)


def test_signup_success(aws):
    status, body = signup()
    assert status == 201
    user = body["user"]
    assert "passwordHash" not in user
    assert user["email"] == "sami.ben@example.tn"
    assert user["role"] == "ETU"
    assert user["skills"] == ["python", "reseaux"]
    assert user["activeCount"] == 0
    claims = authlib.verify_token(body["token"])
    assert claims["sub"] == user["userId"] and claims["role"] == "ETU"
    assert claims["etab"] == "ETAB1"

    stored = aws.get_item(TableName="pfe-connect-Users",
                          Key={"userId": {"S": user["userId"]}})["Item"]
    assert stored["passwordHash"]["S"].startswith("pbkdf2_sha256$")
    ref = aws.get_item(TableName="pfe-connect-Reference",
                       Key={"type": {"S": "EMAIL"}, "id": {"S": "sami.ben@example.tn"}})["Item"]
    assert ref["userId"]["S"] == user["userId"]


def test_signup_duplicate_email_409(aws):
    assert signup()[0] == 201
    status, body = signup({**STUDENT, "email": "SAMI.ben@example.tn"})
    assert status == 409
    assert body["error"]["code"] == "EMAIL_TAKEN"
    assert aws.scan(TableName="pfe-connect-Users")["Count"] == 1


def test_signup_rejects_non_public_role(aws):
    status, body = signup({**STUDENT, "role": "ADM"})
    assert status == 400


def test_login_success(aws):
    user = signup()[1]["user"]
    status, body = call("POST /v1/auth/login",
                        {"email": "SAMI.BEN@example.tn", "password": STUDENT["password"]})
    assert status == 200
    assert body["user"]["userId"] == user["userId"]
    assert "passwordHash" not in body["user"]
    assert authlib.verify_token(body["token"])["sub"] == user["userId"]


def test_login_wrong_password_401(aws):
    signup()
    status, body = call("POST /v1/auth/login",
                        {"email": STUDENT["email"], "password": "wrong-password"})
    assert status == 401
    unknown_status, unknown_body = call("POST /v1/auth/login",
                                        {"email": "nobody@example.tn", "password": "wrong-password"})
    assert unknown_status == 401
    assert unknown_body["error"]["message"] == body["error"]["message"]


def test_me_update(aws):
    created = signup()[1]
    token = created["token"]
    status, body = call("PUT /v1/me", {
        "firstName": "Samir", "gouvernorat": "Sfax", "skills": ["Docker", "Java"]}, token)
    assert status == 200
    assert body["firstName"] == "Samir"
    assert body["gouvernorat"] == "Sfax"
    assert body["skills"] == ["docker", "java"]
    assert body["role"] == "ETU" and body["email"] == "sami.ben@example.tn"

    status, me = call("GET /v1/me", token=token)
    assert status == 200 and me["skills"] == ["docker", "java"]

    status, _ = call("PUT /v1/me", {"role": "ADM"}, token)
    assert status == 400
    assert call("GET /v1/me", token=token)[1]["role"] == "ETU"