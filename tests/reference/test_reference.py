import pytest
from boto3.dynamodb.types import TypeSerializer

from conftest import C, call, load_handler

reference = load_handler("reference_handler", "reference")
ser = TypeSerializer()


def put(ddb, **item):
    ddb.put_item(TableName=C.table_name("Reference"),
                 Item={k: ser.serialize(v) for k, v in item.items()})


@pytest.fixture
def data(ddb, calls):
    reference._hits.clear()
    put(ddb, type="ETAB", id="ETAB1", name="Institut A")
    put(ddb, type="ETAB", id="ETAB10", name="Institut J")
    put(ddb, type="ETAB", id="ETAB2", name="Institut B")
    put(ddb, type="DEPARTMENT", id="ETAB1#INFO", name="Informatique")
    put(ddb, type="DEPARTMENT", id="ETAB1#TELECOM", name="Télécoms")
    put(ddb, type="DEPARTMENT", id="ETAB10#INFO", name="Informatique J")
    put(ddb, type="SPECIALTY", id="ETAB1#INFO#IA", name="IA", compatibleWith={"Chatbot", "Data"})
    put(ddb, type="SPECIALTY", id="ETAB1#INFO#GL", name="Génie logiciel")
    put(ddb, type="SPECIALTY", id="ETAB1#TELECOM#IA", name="IA télécoms")
    put(ddb, type="EMAIL", id="secret@pfe.test", userId="u1")
    put(ddb, type="ISSUE", id="INSTITUTION_WITHOUT_RESPONSABLE#ETAB2", openedAt="2026-01-01T00:00:00Z")
    put(ddb, type="SETTINGS", id="ETAB1", deadline="2027-02-15")
    return ddb


def get(route, query=None, ip="9.9.9.9"):
    return call(reference, route, query=query, ip=ip)  # no token on purpose


def test_institutions_public_and_only_contract_fields(data):
    status, body = get("GET /v1/reference/institutions")
    assert status == 200
    assert body == {"items": [{"id": "ETAB1", "name": "Institut A"},
                              {"id": "ETAB10", "name": "Institut J"},
                              {"id": "ETAB2", "name": "Institut B"}]}


def test_departments(data):
    status, body = get("GET /v1/reference/departments", {"etab": "ETAB1"})
    assert status == 200
    assert body == {"items": [{"id": "ETAB1#INFO", "code": "INFO", "name": "Informatique"},
                              {"id": "ETAB1#TELECOM", "code": "TELECOM", "name": "Télécoms"}]}
    # ETAB10 is not matched by the ETAB1 prefix
    assert [d["id"] for d in get("GET /v1/reference/departments", {"etab": "ETAB10"})[1]["items"]] == ["ETAB10#INFO"]
    assert get("GET /v1/reference/departments", {"etab": "ETAB99"}) == (200, {"items": []})
    assert get("GET /v1/reference/departments", {"etab": "ETAB1#INFO"}) == (200, {"items": []})


def test_specialties(data):
    status, body = get("GET /v1/reference/specialties", {"department": "ETAB1#INFO"})
    assert status == 200
    assert body == {"items": [
        {"id": "ETAB1#INFO#GL", "code": "GL", "name": "Génie logiciel"},
        {"id": "ETAB1#INFO#IA", "code": "IA", "name": "IA", "compatibleWith": ["Chatbot", "Data"]}]}
    # codes repeat across departments: the id keeps them apart
    assert [s["id"] for s in get("GET /v1/reference/specialties", {"department": "ETAB1#TELECOM"})[1]["items"]] == ["ETAB1#TELECOM#IA"]
    for unknown in ("ETAB1#NOPE", "ETAB1", "INFO", "ETAB1#INFO#IA", "#"):
        assert get("GET /v1/reference/specialties", {"department": unknown}) == (200, {"items": []})


def test_400_when_the_filter_is_missing(data):
    for route, field in (("GET /v1/reference/departments", "etab"),
                         ("GET /v1/reference/specialties", "department")):
        for query in (None, {}, {field: ""}, {field: "   "}, {"other": "x"}):
            status, body = get(route, query)
            assert status == 400, (route, query)
            assert body["error"]["details"]["field"] == field
    assert get("GET /v1/reference/departments", {"etab": "x" * 201})[0] == 400


def test_nothing_but_reference_lists_is_exposed(data):
    for route, query in (("GET /v1/reference/institutions", None),
                         ("GET /v1/reference/departments", {"etab": "ETAB1"}),
                         ("GET /v1/reference/specialties", {"department": "ETAB1#INFO"})):
        text = str(get(route, query)[1])
        assert "secret@pfe.test" not in text and "ISSUE" not in text and "deadline" not in text


def test_rate_limit_429_per_ip_and_window(data, monkeypatch):
    clock = {"t": 1000.0}
    monkeypatch.setattr(reference, "_now", lambda: clock["t"])
    monkeypatch.setattr(reference, "RATE_LIMIT", 3)
    monkeypatch.setattr(reference, "RATE_WINDOW", 60)
    for _ in range(3):
        assert get("GET /v1/reference/institutions", ip="5.5.5.5")[0] == 200
    status, body = get("GET /v1/reference/institutions", ip="5.5.5.5")
    assert status == 429 and body["error"]["code"] == "TOO_MANY_REQUESTS"
    assert 1 <= body["error"]["details"]["retryAfterSeconds"] <= 60
    # the three routes share the budget, and invalid calls count too
    assert get("GET /v1/reference/departments", ip="5.5.5.5")[0] == 429
    # another IP is not affected
    assert get("GET /v1/reference/institutions", ip="6.6.6.6")[0] == 200
    # a new window resets the counter
    clock["t"] += 61
    assert get("GET /v1/reference/institutions", ip="5.5.5.5")[0] == 200


def test_rate_limit_memory_is_bounded(data, monkeypatch):
    monkeypatch.setattr(reference, "MAX_TRACKED_IPS", 10)
    for n in range(50):
        assert get("GET /v1/reference/institutions", ip=f"10.0.0.{n}")[0] == 200
    assert len(reference._hits) <= 10


def test_unknown_source_ip_is_one_bucket(data, monkeypatch):
    monkeypatch.setattr(reference, "RATE_LIMIT", 1)
    event = {"routeKey": "GET /v1/reference/institutions", "headers": {}, "requestContext": {}}
    assert reference.handler(event, None)["statusCode"] == 200
    assert reference.handler(event, None)["statusCode"] == 429
