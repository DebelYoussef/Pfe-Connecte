"""reference Lambda: the three PUBLIC read-only lists (no token): institutions, departments of an
institution, specialties of a department. Reads the Reference table only (Query, never Scan).

Abuse protection (the routes are public, so there is no user to throttle)
------------------------------------------------------------------------
A fixed-window counter per source IP, kept in a module-level dict: RATE_LIMIT requests per
RATE_WINDOW seconds, then 429. The IP is requestContext.http.sourceIp, set by API Gateway (a
client cannot forge it the way it can forge X-Forwarded-For).

Its limits, on purpose, are those of a best-effort guard and not of a real rate limiter:
  - the counter lives in ONE Lambda execution environment. Lambda runs several in parallel, so
    the effective limit is up to RATE_LIMIT x (number of warm environments), and it restarts from
    zero on every cold start;
  - users behind one NAT (a campus) share an IP and therefore a budget;
  - an attacker rotating IPs is not stopped.
It does cap what a single client can do against one warm container and it costs nothing. For a hard
limit, set stage throttling on API Gateway (DefaultRouteSettings ThrottlingRateLimit/BurstLimit),
which is shared by all environments.
"""
import time

from boto3.dynamodb.conditions import Key

from common.db import table
from common.errors import BadRequest, TooManyRequests
from common.response import Router

router = Router()

RATE_LIMIT = 60       # requests per source IP and per window, per execution environment
RATE_WINDOW = 60      # seconds (fixed window)
MAX_TRACKED_IPS = 5000  # memory bound: when exceeded, expired windows are dropped first
_hits = {}            # ip -> [window_start, count]


def _now():
    return time.monotonic()


def _source_ip(event):
    http = (event.get("requestContext") or {}).get("http") or {}
    return http.get("sourceIp") or "unknown"


def _rate_limit(req):
    now = _now()
    ip = _source_ip(req.event)
    entry = _hits.get(ip)
    if entry is None or now - entry[0] >= RATE_WINDOW:
        if len(_hits) >= MAX_TRACKED_IPS:
            for key in [k for k, v in _hits.items() if now - v[0] >= RATE_WINDOW]:
                del _hits[key]
            if len(_hits) >= MAX_TRACKED_IPS:
                _hits.clear()
        entry = _hits[ip] = [now, 0]
    entry[1] += 1
    if entry[1] > RATE_LIMIT:
        retry_after = max(1, int(RATE_WINDOW - (now - entry[0])))
        raise TooManyRequests("Too many requests", details={"retryAfterSeconds": retry_after})


def _required(req, name):
    value = (req.query.get(name) or "").strip()
    if not value:
        raise BadRequest(f"{name} is required", details={"field": name})
    if len(value) > 200:
        raise BadRequest(f"{name} is too long", details={"field": name})
    return value


def _query_all(**kwargs):
    reference = table("reference")
    while True:
        res = reference.query(**kwargs)
        yield from res.get("Items", [])
        last = res.get("LastEvaluatedKey")
        if not last:
            return
        kwargs["ExclusiveStartKey"] = last


def _code(item_id):
    return item_id.rsplit("#", 1)[-1]


@router.route("GET /v1/reference/institutions", public=True)
def institutions(req):
    _rate_limit(req)
    items = _query_all(KeyConditionExpression=Key("type").eq("ETAB"))
    return {"items": [{"id": i["id"], "name": i.get("name", "")} for i in items]}


@router.route("GET /v1/reference/departments", public=True)
def departments(req):
    _rate_limit(req)
    etab = _required(req, "etab")
    if "#" in etab:  # not an institution id: unknown filter value, empty list (schema.md 9.10)
        return {"items": []}
    items = _query_all(KeyConditionExpression=Key("type").eq("DEPARTMENT")
                       & Key("id").begins_with(f"{etab}#"))
    return {"items": [{"id": i["id"], "code": _code(i["id"]), "name": i.get("name", "")}
                      for i in items]}


@router.route("GET /v1/reference/specialties", public=True)
def specialties(req):
    _rate_limit(req)
    department = _required(req, "department")
    parts = department.split("#")
    if len(parts) != 2 or not all(parts):  # a department id is {etabId}#{deptId}
        return {"items": []}
    items = _query_all(KeyConditionExpression=Key("type").eq("SPECIALTY")
                       & Key("id").begins_with(f"{department}#"))
    out = []
    for i in items:
        entry = {"id": i["id"], "code": _code(i["id"]), "name": i.get("name", "")}
        if i.get("compatibleWith"):
            entry["compatibleWith"] = sorted(i["compatibleWith"])
        out.append(entry)
    return {"items": out}


handler = router.handle
