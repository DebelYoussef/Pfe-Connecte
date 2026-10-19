"""JWT HS256 (stdlib only, nothing to package), PBKDF2 passwords, role checks."""
import base64
import hashlib
import hmac
import json
import os
import time

from .errors import Forbidden, Unauthorized

PBKDF2_ITERATIONS = 200_000


def _b64e(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64d(text):
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _secret():
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("Missing env var JWT_SECRET")
    return secret.encode()


def _json(obj):
    return json.dumps(obj, separators=(",", ":")).encode()


def sign_token(claims, ttl_seconds=3600):
    """claims example: {"sub": userId, "role": "ETU", "etab": "ETAB1"}"""
    now = int(time.time())
    payload = {**claims, "iat": now, "exp": now + ttl_seconds}
    signing = f"{_b64e(_json({'alg': 'HS256', 'typ': 'JWT'}))}.{_b64e(_json(payload))}"
    sig = hmac.new(_secret(), signing.encode(), hashlib.sha256).digest()
    return f"{signing}.{_b64e(sig)}"


def verify_token(token):
    try:
        head, payload, sig = token.split(".")
        expected = hmac.new(_secret(), f"{head}.{payload}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64d(sig)):
            raise Unauthorized("Invalid token")
        if json.loads(_b64d(head)).get("alg") != "HS256":
            raise Unauthorized("Invalid token")
        claims = json.loads(_b64d(payload))
    except Unauthorized:
        raise
    except Exception:
        raise Unauthorized("Malformed token")
    if claims.get("exp", 0) < time.time():
        raise Unauthorized("Token expired")
    return claims


def get_claims(event):
    """Claims from a Lambda authorizer context if present, else verify the Bearer header."""
    ctx = (event.get("requestContext", {}).get("authorizer") or {}).get("lambda")
    if ctx and ctx.get("sub"):
        return ctx
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    value = headers.get("authorization", "")
    if not value.lower().startswith("bearer "):
        raise Unauthorized("Missing token")
    return verify_token(value[7:].strip())


def check_role(claims, roles):
    if roles and claims.get("role") not in roles:
        raise Forbidden("Role not allowed")


def hash_password(password, iterations=PBKDF2_ITERATIONS):
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def check_password(password, stored):
    try:
        _, iterations, salt, digest = stored.split("$")
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(),
                                        bytes.fromhex(salt), int(iterations))
        return hmac.compare_digest(candidate.hex(), digest)
    except Exception:
        return False
