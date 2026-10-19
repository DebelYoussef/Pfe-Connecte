"""Request wrapper, JSON responses with CORS headers, error format, and a tiny router.

Error format (everywhere): {"error": {"code", "message", "details", "requestId"}}
"""
import base64
import json
import os
import traceback

from .auth import check_role, get_claims
from .errors import ApiError, BadRequest, NotFound
from .log import get_logger


def cors_headers():
    return {
        "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*"),
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    }


def respond(status, body=None):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", **cors_headers()},
        "body": json.dumps(body if body is not None else {}, default=str),
    }


def error_response(err, request_id):
    return respond(err.status, {"error": {
        "code": err.code, "message": err.message,
        "details": err.details, "requestId": request_id}})


class Request:
    def __init__(self, event, context):
        self.event = event
        self.context = context
        self.request_id = (event.get("requestContext", {}).get("requestId")
                           or getattr(context, "aws_request_id", "local"))
        self.path_params = event.get("pathParameters") or {}
        self.query = event.get("queryStringParameters") or {}
        self.log = get_logger(self.request_id)
        self._claims = None

    @property
    def claims(self):
        if self._claims is None:
            self._claims = get_claims(self.event)
        return self._claims

    @property
    def user_id(self):
        return self.claims["sub"]

    @property
    def role(self):
        return self.claims.get("role")

    @property
    def etab(self):
        return self.claims.get("etab")

    def json_body(self):
        raw = self.event.get("body")
        if not raw:
            return {}
        if self.event.get("isBase64Encoded"):
            raw = base64.b64decode(raw).decode()
        try:
            data = json.loads(raw)
        except ValueError:
            raise BadRequest("Body is not valid JSON")
        if not isinstance(data, dict):
            raise BadRequest("Body must be a JSON object")
        return data


class Router:
    """One Lambda can serve several routes: @router.route("GET /v1/offers", roles=("ENT",))."""

    def __init__(self):
        self._routes = {}

    def route(self, key, roles=None, public=False):
        def decorator(fn):
            self._routes[key] = (fn, roles, public)
            return fn
        return decorator

    def handle(self, event, context):
        req = Request(event, context)
        try:
            entry = self._routes.get(event.get("routeKey"))
            if not entry:
                raise NotFound("Route not found")
            fn, roles, public = entry
            if not public:
                check_role(req.claims, roles)
            result = fn(req)
            status, body = result if isinstance(result, tuple) else (200, result)
            return respond(status, body)
        except ApiError as err:
            req.log.warn("api_error", status=err.status, code=err.code, detail=err.message)
            return error_response(err, req.request_id)
        except Exception:
            req.log.error("unhandled", trace=traceback.format_exc())
            return error_response(ApiError("Internal error"), req.request_id)
