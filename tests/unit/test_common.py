import json
import time

import pytest

from common import auth, validate
from common.errors import BadRequest, Forbidden, Unauthorized
from common.response import Router


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret")


def test_token_roundtrip():
    token = auth.sign_token({"sub": "u1", "role": "ETU"})
    assert auth.verify_token(token)["sub"] == "u1"


def test_token_expired():
    with pytest.raises(Unauthorized):
        auth.verify_token(auth.sign_token({"sub": "u1"}, ttl_seconds=-1))


def test_token_tampered():
    head, payload, sig = auth.sign_token({"sub": "u1", "role": "ETU"}).split(".")
    forged = auth._b64e(json.dumps({"sub": "u1", "role": "ADM", "exp": time.time() + 99}).encode())
    with pytest.raises(Unauthorized):
        auth.verify_token(f"{head}.{forged}.{sig}")


def test_password():
    stored = auth.hash_password("Test1234!", iterations=1000)
    assert auth.check_password("Test1234!", stored)
    assert not auth.check_password("wrong", stored)


def test_role_check():
    with pytest.raises(Forbidden):
        auth.check_role({"role": "ETU"}, ("ENT",))
    auth.check_role({"role": "ENT"}, ("ENT",))


def test_validate():
    with pytest.raises(BadRequest):
        validate.require({"a": 1}, "a", "b")
    with pytest.raises(BadRequest):
        validate.as_enum("X", "role", ("ETU", "ENT"))
    assert validate.normalize("  Génie Logiciel ") == "genie logiciel"


def _event(route, token=None):
    headers = {"authorization": f"Bearer {token}"} if token else {}
    return {"routeKey": route, "headers": headers, "requestContext": {"requestId": "r1"}}


def test_router():
    router = Router()

    @router.route("GET /pub", public=True)
    def pub(req):
        return {"ok": True}

    @router.route("GET /ent", roles=("ENT",))
    def ent(req):
        return 201, {"user": req.user_id}

    assert router.handle(_event("GET /pub"), None)["statusCode"] == 200
    assert router.handle(_event("GET /ent"), None)["statusCode"] == 401
    student = auth.sign_token({"sub": "u1", "role": "ETU"})
    assert router.handle(_event("GET /ent", student), None)["statusCode"] == 403
    company = auth.sign_token({"sub": "c1", "role": "ENT"})
    res = router.handle(_event("GET /ent", company), None)
    assert res["statusCode"] == 201 and json.loads(res["body"])["user"] == "c1"
    res = router.handle(_event("GET /nope"), None)
    body = json.loads(res["body"])
    assert res["statusCode"] == 404 and body["error"]["requestId"] == "r1"
