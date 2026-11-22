import base64
import datetime
import json
import sys

import boto3
import pytest

from conftest import C, INFRA, call, load_handler, token_for
from common import auth as authlib
from common.config_health import run_config_health

admin = load_handler("admin_handler", "admin")
auth_handler = load_handler("auth_handler_for_admin", "auth")

sys.path.insert(0, str(INFRA))
import seed  # noqa: E402

PASSWORD = "Adm1nPass!"


# ------------------------------------------------------------------ helpers
def put_user(ddb, user_id, role, email=None, etab=None, created="2026-01-01T00:00:00Z", **extra):
    from boto3.dynamodb.types import TypeSerializer
    ser = TypeSerializer()
    email = email or f"{user_id}@pfe.test"
    item = {"userId": user_id, "email": email, "passwordHash": "pbkdf2_sha256$1$00$00",
            "role": role, "createdAt": created, "gsiAll": "ALL", **extra}
    if etab:
        item["etab"] = etab
    ddb.put_item(TableName=C.table_name("Users"), Item={k: ser.serialize(v) for k, v in item.items()})
    ddb.put_item(TableName=C.table_name("Reference"),
                 Item={"type": {"S": "EMAIL"}, "id": {"S": email}, "userId": {"S": user_id}})
    return item


def put_ref(ddb, type_, id_, name, **extra):
    from boto3.dynamodb.types import TypeSerializer
    ser = TypeSerializer()
    item = {"type": type_, "id": id_, "name": name, **extra}
    ddb.put_item(TableName=C.table_name("Reference"),
                 Item={k: ser.serialize(v) for k, v in item.items()})


@pytest.fixture
def world(ddb, calls):
    """Two institutions with a RESP each, ETAB3 without RESP, two admins."""
    for etab, name in (("ETAB1", "Institut A"), ("ETAB2", "Institut B"), ("ETAB3", "Institut C")):
        put_ref(ddb, "ETAB", etab, name)
    for etab in ("ETAB1", "ETAB2"):
        put_ref(ddb, "DEPARTMENT", f"{etab}#INFO", "Informatique")
        put_ref(ddb, "SPECIALTY", f"{etab}#INFO#IA", "Intelligence artificielle")
    put_ref(ddb, "DEPARTMENT", "ETAB3#GENIE", "Génie civil")  # no specialty
    put_user(ddb, "adm-1", "ADM", created="2026-01-01T00:00:01Z")
    put_user(ddb, "adm-2", "ADM", created="2026-01-01T00:00:02Z")
    put_user(ddb, "resp-1", "RESP", etab="ETAB1", created="2026-01-01T00:00:03Z")
    put_user(ddb, "resp-2", "RESP", etab="ETAB2", created="2026-01-01T00:00:04Z")
    put_user(ddb, "ens-1", "ENS", etab="ETAB1", created="2026-01-01T00:00:05Z")
    put_user(ddb, "ent-1", "ENT", created="2026-01-01T00:00:06Z", companyName="Acme")
    put_user(ddb, "etu-1", "ETU", etab="ETAB1", created="2026-01-01T00:00:07Z",
             department="INFO", specialty="IA", gouvernorat="Tunis",
             activeCount=0, sansStageEtab="ETAB1")
    return ddb


ADMIN_TOKEN = token_for("adm-1", "ADM")


def a(route, body=None, **kw):
    return call(admin, route, body, token=kw.pop("token", ADMIN_TOKEN), **kw)


def notifications(ddb, user_id):
    res = ddb.query(TableName=C.table_name("Notifications"),
                    KeyConditionExpression="userId = :u",
                    ExpressionAttributeValues={":u": {"S": user_id}})
    return [{k: list(v.values())[0] for k, v in i.items()} for i in res["Items"]]


def issue_ids(ddb):
    res = ddb.query(TableName=C.table_name("Reference"), KeyConditionExpression="#t = :t",
                    ExpressionAttributeNames={"#t": "type"},
                    ExpressionAttributeValues={":t": {"S": "ISSUE"}})
    return sorted(i["id"]["S"] for i in res["Items"])


def stored_user(ddb, user_id):
    item = ddb.get_item(TableName=C.table_name("Users"), Key={"userId": {"S": user_id}})["Item"]
    return {k: list(v.values())[0] for k, v in item.items()}


# ---------------------------------------------------------------- security
def test_every_admin_route_requires_adm(world):
    routes = [("GET /v1/admin/users", None), ("POST /v1/admin/users", {}),
              ("PATCH /v1/admin/users/{id}", {}), ("GET /v1/admin/institutions", None),
              ("POST /v1/admin/institutions", {}), ("PATCH /v1/admin/institutions/{id}", {}),
              ("GET /v1/admin/departments", None), ("POST /v1/admin/departments", {}),
              ("PATCH /v1/admin/departments/{id}", {}), ("GET /v1/admin/specialties", None),
              ("POST /v1/admin/specialties", {}), ("PATCH /v1/admin/specialties/{id}", {}),
              ("GET /v1/admin/overview", None)]
    assert {r for r, _ in routes} == set(admin.router._routes)
    for route, body in routes:
        assert call(admin, route, body)[0] == 401
        status, err = call(admin, route, body, token=token_for("resp-1", "RESP", "ETAB1"))
        assert status == 403 and err["error"]["code"] == "FORBIDDEN"


# ------------------------------------------------------------- users list
def test_list_no_filter_uses_all_by_created_at_newest_first(world, calls):
    status, body = a("GET /v1/admin/users")
    assert status == 200 and body["nextCursor"] is None
    ids = [u["userId"] for u in body["items"]]
    assert ids == ["etu-1", "ent-1", "ens-1", "resp-2", "resp-1", "adm-2", "adm-1"]
    assert ("pfe-connect-Users", "allByCreatedAt") in calls
    assert all("passwordHash" not in u and "gsiAll" not in u and "sansStageEtab" not in u
               for u in body["items"])


def test_list_role_uses_by_role(world, calls):
    status, body = a("GET /v1/admin/users", query={"role": "ADM"})
    assert status == 200
    assert [u["userId"] for u in body["items"]] == ["adm-2", "adm-1"]  # newest first
    assert calls[-1] == ("pfe-connect-Users", "byRole")


def test_list_role_and_etab_uses_by_etab_role(world, calls):
    status, body = a("GET /v1/admin/users", query={"role": "RESP", "etab": "ETAB2"})
    assert [u["userId"] for u in body["items"]] == ["resp-2"]
    assert calls[-1] == ("pfe-connect-Users", "byEtabRole")


def test_list_etab_only_uses_by_etab_role(world, calls):
    status, body = a("GET /v1/admin/users", query={"etab": "ETAB1"})
    assert {u["userId"] for u in body["items"]} == {"resp-1", "ens-1", "etu-1"}
    assert calls[-1] == ("pfe-connect-Users", "byEtabRole")


def test_list_adm_with_etab_is_empty(world):
    assert a("GET /v1/admin/users", query={"role": "ADM", "etab": "ETAB1"})[1] == {
        "items": [], "nextCursor": None}


def test_list_by_email_exact_lookup(world, calls):
    status, body = a("GET /v1/admin/users", query={"email": "RESP-1@PFE.test", "limit": "1",
                                                   "cursor": "ignored"})
    assert status == 200 and body["nextCursor"] is None
    assert [u["userId"] for u in body["items"]] == ["resp-1"]
    assert all(index is None for _, index in calls)  # GetItem only, no index query
    assert a("GET /v1/admin/users", query={"email": "nobody@pfe.test"})[1]["items"] == []
    mismatch = a("GET /v1/admin/users", query={"email": "resp-1@pfe.test", "role": "ENS"})[1]
    assert mismatch["items"] == []
    mismatch = a("GET /v1/admin/users", query={"email": "resp-1@pfe.test", "etab": "ETAB2"})[1]
    assert mismatch["items"] == []
    assert a("GET /v1/admin/users", query={"email": "resp-1@pfe.test", "role": "RESP",
                                           "etab": "ETAB1"})[1]["items"]


def test_list_validation(world):
    for query in ({"email": "not-an-email"}, {"role": "BOSS"}, {"limit": "0"}, {"limit": "101"},
                  {"limit": "abc"}, {"name": "x"}, {"cursor": "%%%"},
                  {"cursor": base64.urlsafe_b64encode(b'{"k": 1}').decode()}):
        status, body = a("GET /v1/admin/users", query=query)
        assert status == 400, query
    assert a("GET /v1/admin/users", query={"limit": "100"})[0] == 200


@pytest.mark.parametrize("query,expected", [
    ({}, 7), ({"role": "ADM"}, 2), ({"etab": "ETAB1"}, 3)])
def test_list_pagination(world, query, expected):
    seen, cursor = [], None
    for _ in range(10):
        q = {**query, "limit": "2", **({"cursor": cursor} if cursor else {})}
        status, body = a("GET /v1/admin/users", query=q)
        assert status == 200 and len(body["items"]) <= 2
        seen += [u["userId"] for u in body["items"]]
        cursor = body["nextCursor"]
        if not cursor:
            break
    assert len(seen) == len(set(seen)) == expected


def test_cursor_from_another_filter_is_400(world):
    cursor = a("GET /v1/admin/users", query={"limit": "1"})[1]["nextCursor"]
    assert cursor
    status, body = a("GET /v1/admin/users", query={"role": "ADM", "cursor": cursor})
    assert status == 400 and body["error"]["details"]["field"] == "cursor"
    other = a("GET /v1/admin/users", query={"role": "ADM", "limit": "1"})[1]["nextCursor"]
    assert a("GET /v1/admin/users", query={"role": "RESP", "cursor": other})[0] == 400


# ------------------------------------------------------------- user create
STUDENT = {"email": "New.Student@Example.tn", "password": PASSWORD, "role": "ETU",
           "firstName": "Sami", "lastName": "Ben Ali", "etab": "ETAB1", "department": "INFO",
           "specialty": "IA", "gouvernorat": "Tunis", "skills": ["Python", "Réseaux", "python"]}
CREATE = {
    "ETU": STUDENT,
    "ENS": {"email": "ens.new@example.tn", "password": PASSWORD, "role": "ENS", "etab": "ETAB1",
            "expertise": ["Java"]},
    "RESP": {"email": "resp.new@example.tn", "password": PASSWORD, "role": "RESP",
             "etab": "ETAB3", "firstName": "R", "lastName": "S"},
    "ENT": {"email": "ent.new@example.tn", "password": PASSWORD, "role": "ENT",
            "companyName": "Acme 2"},
    "ADM": {"email": "adm.new@example.tn", "password": PASSWORD, "role": "ADM"},
}


@pytest.mark.parametrize("role", list(CREATE))
def test_create_user_per_role(world, capsys, role):
    payload = CREATE[role]
    status, user = a("POST /v1/admin/users", payload)
    assert status == 201, user
    assert user["role"] == role and user["email"] == payload["email"].lower()
    assert PASSWORD not in json.dumps(user) and "passwordHash" not in user and "password" not in user

    stored = stored_user(world, user["userId"])
    assert stored["passwordHash"].startswith("pbkdf2_sha256$")
    assert authlib.check_password(PASSWORD, stored["passwordHash"])
    assert PASSWORD not in json.dumps(stored)
    assert stored["gsiAll"] == "ALL"
    assert ("etab" in stored) == (role in ("ETU", "ENS", "RESP"))
    ref = world.get_item(TableName=C.table_name("Reference"),
                         Key={"type": {"S": "EMAIL"}, "id": {"S": payload["email"].lower()}})
    assert ref["Item"]["userId"]["S"] == user["userId"]
    out = capsys.readouterr()
    assert PASSWORD not in out.out and PASSWORD not in out.err
    if role == "ETU":
        assert user["skills"] == ["python", "reseaux"] and user["activeCount"] == 0
        assert stored["sansStageEtab"] == "ETAB1"  # same as signup


def test_duplicate_email_409(world):
    assert a("POST /v1/admin/users", CREATE["ENT"])[0] == 201
    status, body = a("POST /v1/admin/users", {**CREATE["ENT"], "email": "ENT.new@example.tn"})
    assert status == 409 and body["error"]["code"] == "EMAIL_TAKEN"
    status, body = a("POST /v1/admin/users", {**CREATE["ENT"], "email": "resp-1@pfe.test"})
    assert status == 409 and body["error"]["code"] == "EMAIL_TAKEN"
    assert len([i for i in world.scan(TableName=C.table_name("Users"))["Items"]
                if i["email"]["S"] == "ent.new@example.tn"]) == 1


@pytest.mark.parametrize("patch", [
    {"password": "short"}, {"role": "BOSS"}, {"role": None}, {"email": "bad"},
    {"extra": 1},
    # etab
    {"role": "RESP", "etab": None}, {"role": "ENS", "etab": None}, {"role": "ETU", "etab": None},
    {"role": "ENT", "etab": "ETAB1", "companyName": "X"}, {"role": "ADM", "etab": "ETAB1"},
    {"etab": "NOPE"},
    # ETU
    {"department": None}, {"specialty": None}, {"gouvernorat": None},
    {"department": "ETAB1#INFO"}, {"department": "NOPE"}, {"specialty": "NOPE"},
    {"specialty": "ETAB1#INFO#IA"},
    # ENT
    {"role": "ENT", "companyName": None, "etab": "REMOVE"},
])
def test_create_user_validation_400(world, patch):
    base = dict(STUDENT, email="v@example.tn")
    if patch.get("role") == "ENT":
        base = {"email": "v@example.tn", "password": PASSWORD, "role": "ENT", "companyName": "X"}
    elif patch.get("role") in ("RESP", "ENS", "ADM"):
        base = {"email": "v@example.tn", "password": PASSWORD, "role": patch["role"],
                "etab": "ETAB1"}
    payload = {**base, **patch}
    payload = {k: v for k, v in payload.items() if v is not None and v != "REMOVE"}
    if patch.get("role") in ("ENS", "RESP", "ETU") and "etab" in patch and patch["etab"] is None:
        payload.pop("etab", None)
    status, body = a("POST /v1/admin/users", payload)
    assert status == 400, (patch, body)
    assert body["error"]["code"] == "BAD_REQUEST"
    assert PASSWORD not in json.dumps(body)


def test_create_user_unknown_references_name_the_field(world):
    status, body = a("POST /v1/admin/users", {**STUDENT, "etab": "ETAB9"})
    assert status == 400 and body["error"]["details"]["field"] == "etab"
    status, body = a("POST /v1/admin/users", {**STUDENT, "etab": "ETAB3"})  # no INFO in ETAB3
    assert status == 400 and body["error"]["details"]["field"] == "department"
    status, body = a("POST /v1/admin/users", {**STUDENT, "specialty": "XX"})
    assert status == 400 and body["error"]["details"]["field"] == "specialty"
    status, body = a("POST /v1/admin/users", {k: v for k, v in STUDENT.items() if k != "gouvernorat"})
    assert status == 400 and body["error"]["details"]["missing"] == ["gouvernorat"]


def test_create_adm_notifies_only_the_other_admin(world):
    status, user = a("POST /v1/admin/users", CREATE["ADM"])
    assert status == 201
    others = notifications(world, "adm-2")
    assert len(others) == 1
    n = others[0]
    assert (n["type"], n["refType"], n["refId"], n["level"]) == (
        "ADMIN_ACCOUNT_CREATED", "USER", user["userId"], "INFO")
    assert notifications(world, "adm-1") == []          # the creator
    assert notifications(world, user["userId"]) == []   # the new account
    # other roles never notify
    a("POST /v1/admin/users", CREATE["ENT"])
    assert len(notifications(world, "adm-2")) == 1


def test_create_resp_closes_the_institution_issue(world, calls):
    run_config_health()
    assert "INSTITUTION_WITHOUT_RESPONSABLE#ETAB3" in issue_ids(world)
    assert a("POST /v1/admin/users", CREATE["RESP"])[0] == 201
    assert "INSTITUTION_WITHOUT_RESPONSABLE#ETAB3" not in issue_ids(world)
    status, overview = a("GET /v1/admin/overview")
    assert overview["institutionsWithoutResponsable"] == []


def test_student_created_by_admin_can_log_in(world):
    status, user = a("POST /v1/admin/users", STUDENT)
    assert status == 201
    status, body = call(auth_handler, "POST /v1/auth/login",
                        {"email": "NEW.student@example.tn", "password": PASSWORD})
    assert status == 200 and body["user"]["userId"] == user["userId"]
    claims = authlib.verify_token(body["token"])
    assert claims["role"] == "ETU" and claims["etab"] == "ETAB1"
    assert call(auth_handler, "POST /v1/auth/login",
                {"email": STUDENT["email"], "password": "wrong-password"})[0] == 401


# -------------------------------------------------------------- user patch
def patch_user(user_id, body, token=ADMIN_TOKEN):
    return call(admin, "PATCH /v1/admin/users/{id}", body, token=token, path={"id": user_id})


def test_patch_whitelist_and_404(world):
    for body in ({"email": "x@y.tn"}, {"passwordHash": "x"}, {"userId": "z"}, {"skills": ["a"]},
                 {"gsiAll": "X"}, {}):
        assert patch_user("ens-1", body)[0] == 400
    assert patch_user("ghost", {"firstName": "A"})[0] == 404
    status, user = patch_user("ens-1", {"firstName": " Omar ", "lastName": "J"})
    assert status == 200 and user["firstName"] == "Omar" and "passwordHash" not in user


def test_cannot_change_own_role(world):
    status, body = patch_user("adm-1", {"role": "RESP", "etab": "ETAB1"})
    assert status == 403 and body["error"]["code"] == "CANNOT_CHANGE_OWN_ROLE"
    assert stored_user(world, "adm-1")["role"] == "ADM"
    # same role is accepted (no-op) and the other fields of the own account stay editable
    assert patch_user("adm-1", {"role": "ADM"})[0] == 200
    status, user = patch_user("adm-1", {"firstName": "Boss"})
    assert status == 200 and user["firstName"] == "Boss"
    # another admin can change somebody else's role
    assert patch_user("ens-1", {"role": "RESP"})[0] == 200


def test_promote_to_adm_removes_etab_and_notifies_the_other_admin_only(world):
    status, body = patch_user("ens-1", {"role": "ADM", "etab": "ETAB1"})
    assert status == 400  # sending etab for an ADM
    status, user = patch_user("ens-1", {"role": "ADM"})
    assert status == 200 and user["role"] == "ADM" and "etab" not in user
    assert "etab" not in stored_user(world, "ens-1")
    n = notifications(world, "adm-2")
    assert [(x["type"], x["refId"], x["level"]) for x in n] == [("ADMIN_ROLE_GRANTED", "ens-1", "INFO")]
    assert notifications(world, "adm-1") == [] and notifications(world, "ens-1") == []
    # byRole sees the new admin, byEtabRole no longer
    assert "ens-1" in [u["userId"] for u in a("GET /v1/admin/users", query={"role": "ADM"})[1]["items"]]
    assert "ens-1" not in [u["userId"] for u in a("GET /v1/admin/users", query={"etab": "ETAB1"})[1]["items"]]


def test_role_change_keeps_indexes_coherent(world):
    status, user = patch_user("ens-1", {"role": "RESP"})
    assert status == 200
    resp = [u["userId"] for u in a("GET /v1/admin/users", query={"role": "RESP", "etab": "ETAB1"})[1]["items"]]
    assert sorted(resp) == ["ens-1", "resp-1"]
    assert "ens-1" not in [u["userId"] for u in a("GET /v1/admin/users", query={"role": "ENS"})[1]["items"]]
    assert patch_user("ent-1", {"role": "ETU"})[0] == 400          # student fields missing
    assert patch_user("ent-1", {"role": "ENS"})[0] == 400          # etab missing
    status, user = patch_user("ent-1", {"role": "ENS", "etab": "ETAB2"})
    assert status == 200 and user["etab"] == "ETAB2"
    status, user = patch_user("ens-1", {"role": "ENT"})            # ENT has no etab
    assert status == 400 and user is not None                       # companyName missing
    status, user = patch_user("ens-1", {"role": "ENT", "companyName": "Acme 3"})
    assert status == 200 and "etab" not in user and user["companyName"] == "Acme 3"


def test_patch_student_references_and_sparse_attributes_untouched(world):
    assert patch_user("etu-1", {"department": "NOPE"})[0] == 400
    assert patch_user("etu-1", {"etab": "ETAB9"})[0] == 400
    assert patch_user("etu-1", {"companyName": "X"})[0] == 400
    status, user = patch_user("etu-1", {"gouvernorat": "Sfax", "firstName": "Sami"})
    assert status == 200 and user["gouvernorat"] == "Sfax" and user["activeCount"] == 0
    status, user = patch_user("etu-1", {"etab": "ETAB2"})
    assert status == 200 and user["etab"] == "ETAB2"
    stored = stored_user(world, "etu-1")
    assert stored["sansStageEtab"] == "ETAB1" and stored["activeCount"] == "0"  # never touched


def test_moving_the_last_resp_is_allowed_and_opens_the_institution_issue(world):
    run_config_health()
    assert issue_ids(world) == ["DEPARTMENT_WITHOUT_SPECIALTY#ETAB3#GENIE",
                                "INSTITUTION_WITHOUT_RESPONSABLE#ETAB3"]
    before = len(notifications(world, "adm-1"))
    status, user = patch_user("resp-1", {"etab": "ETAB2"})
    assert status == 200 and user["etab"] == "ETAB2"
    assert "INSTITUTION_WITHOUT_RESPONSABLE#ETAB1" in issue_ids(world)
    new = [n for n in notifications(world, "adm-1") if n["refId"] == "ETAB1"]
    assert len(notifications(world, "adm-1")) == before + 1
    assert (new[0]["type"], new[0]["level"], new[0]["refType"]) == (
        "INSTITUTION_WITHOUT_RESPONSABLE", "WARNING", "INSTITUTION")
    # changing the role of the last RESP of ETAB2... still ETAB2 has resp-2 and resp-1 -> no issue
    assert patch_user("resp-2", {"role": "ENS"})[0] == 200
    assert "INSTITUTION_WITHOUT_RESPONSABLE#ETAB2" not in issue_ids(world)
    assert patch_user("resp-1", {"role": "ENS"})[0] == 200
    assert "INSTITUTION_WITHOUT_RESPONSABLE#ETAB2" in issue_ids(world)


def test_recheck_is_asynchronous_when_the_function_is_configured(world, monkeypatch):
    invoked = []

    class FakeLambda:
        def invoke(self, **kwargs):
            invoked.append(kwargs)

    real_client = boto3.client
    monkeypatch.setenv("CONFIG_HEALTH_FUNCTION", "pfe-connect-config_health")
    monkeypatch.setattr(admin.boto3, "client",
                        lambda name, *a_, **k: FakeLambda() if name == "lambda" else real_client(name, *a_, **k))
    assert patch_user("resp-1", {"etab": "ETAB2"})[0] == 200
    assert invoked and invoked[0]["FunctionName"] == "pfe-connect-config_health"
    assert invoked[0]["InvocationType"] == "Event"
    assert issue_ids(world) == []  # nothing ran inline


# ------------------------------------------- institutions / departments / specialties
def test_institutions_create_list_update(world):
    status, inst = a("POST /v1/admin/institutions", {"name": "Institut D"})
    assert status == 201 and inst == {"id": "ETAB4", "name": "Institut D"}
    assert a("POST /v1/admin/institutions", {"name": "  institut d "})[0] == 409   # unique name
    assert a("POST /v1/admin/institutions", {"name": "Institut É"})[0] == 201
    assert a("POST /v1/admin/institutions", {})[0] == 400
    assert a("POST /v1/admin/institutions", {"name": "X", "id": "ETAB9"})[0] == 400
    items = a("GET /v1/admin/institutions")[1]["items"]
    assert [i["id"] for i in items] == ["ETAB1", "ETAB2", "ETAB3", "ETAB4", "ETAB5"]
    assert "INSTITUTION_WITHOUT_RESPONSABLE#ETAB4" in issue_ids(world)  # check ran after creation

    path = {"id": "ETAB4"}
    status, inst = call(admin, "PATCH /v1/admin/institutions/{id}", {"name": "Institut D2"},
                        token=ADMIN_TOKEN, path=path)
    assert status == 200 and inst == {"id": "ETAB4", "name": "Institut D2"}
    assert call(admin, "PATCH /v1/admin/institutions/{id}", {"name": "Institut A"},
                token=ADMIN_TOKEN, path=path)[0] == 409
    assert call(admin, "PATCH /v1/admin/institutions/{id}", {"name": "Institut D2"},
                token=ADMIN_TOKEN, path=path)[0] == 200   # its own name is not a duplicate
    assert call(admin, "PATCH /v1/admin/institutions/{id}", {"name": "Z"},
                token=ADMIN_TOKEN, path={"id": "ETAB99"})[0] == 404


def test_institution_pagination(world):
    page1 = a("GET /v1/admin/institutions", query={"limit": "2"})[1]
    assert [i["id"] for i in page1["items"]] == ["ETAB1", "ETAB2"] and page1["nextCursor"]
    page2 = a("GET /v1/admin/institutions", query={"limit": "2", "cursor": page1["nextCursor"]})[1]
    assert [i["id"] for i in page2["items"]] == ["ETAB3"] and page2["nextCursor"] is None


def test_departments(world):
    status, dept = a("POST /v1/admin/departments", {"etab": "ETAB1", "name": "Génie civil"})
    assert status == 201 and dept == {"id": "ETAB1#GENIE-CIVIL", "etab": "ETAB1", "name": "Génie civil"}
    assert a("POST /v1/admin/departments", {"etab": "ETAB1", "name": "génie CIVIL"})[0] == 409
    assert a("POST /v1/admin/departments", {"etab": "ETAB1", "name": "Genie-civil"})[0] == 409  # same code
    assert a("POST /v1/admin/departments", {"etab": "ETAB2", "name": "Génie civil"})[0] == 201
    assert a("POST /v1/admin/departments", {"name": "Sans parent"})[0] == 400
    assert a("POST /v1/admin/departments", {"etab": "ETAB9", "name": "Orphelin"})[0] == 404
    assert a("POST /v1/admin/departments", {"etab": "ETAB1", "name": "***"})[0] == 400
    assert "DEPARTMENT_WITHOUT_SPECIALTY#ETAB1#GENIE-CIVIL" in issue_ids(world)
    assert [d["id"] for d in a("GET /v1/admin/departments", query={"etab": "ETAB1"})[1]["items"]] == [
        "ETAB1#GENIE-CIVIL", "ETAB1#INFO"]
    assert len(a("GET /v1/admin/departments")[1]["items"]) == 5

    path = {"id": "ETAB1#INFO"}
    status, dept = call(admin, "PATCH /v1/admin/departments/{id}", {"name": "Informatique 2"},
                        token=ADMIN_TOKEN, path=path)
    assert status == 200 and dept["id"] == "ETAB1#INFO" and dept["name"] == "Informatique 2"
    assert call(admin, "PATCH /v1/admin/departments/{id}", {"name": "Génie civil"},
                token=ADMIN_TOKEN, path=path)[0] == 409
    assert call(admin, "PATCH /v1/admin/departments/{id}", {"name": "X", "etab": "ETAB2"},
                token=ADMIN_TOKEN, path=path)[0] == 400   # cannot move
    assert call(admin, "PATCH /v1/admin/departments/{id}", {"name": "X"},
                token=ADMIN_TOKEN, path={"id": "ETAB1#NOPE"})[0] == 404
    # an id sent URL-encoded (API Gateway) is accepted too
    assert call(admin, "PATCH /v1/admin/departments/{id}", {"name": "Informatique 3"},
                token=ADMIN_TOKEN, path={"id": "ETAB1%23INFO"})[0] == 200


def test_specialties(world):
    run_config_health()
    assert "DEPARTMENT_WITHOUT_SPECIALTY#ETAB3#GENIE" in issue_ids(world)
    status, spec = a("POST /v1/admin/specialties", {
        "department": "ETAB3#GENIE", "name": "Génie des matériaux", "compatibleWith": ["BTP", "BTP", "Industrie"]})
    assert status == 201
    assert spec == {"id": "ETAB3#GENIE#GENIE-DES-MATERIAUX", "department": "ETAB3#GENIE",
                    "name": "Génie des matériaux", "compatibleWith": ["BTP", "Industrie"]}
    assert "DEPARTMENT_WITHOUT_SPECIALTY#ETAB3#GENIE" not in issue_ids(world)  # check re-ran
    assert a("POST /v1/admin/specialties", {"department": "ETAB3#GENIE", "name": "GENIE DES matériaux"})[0] == 409
    assert a("POST /v1/admin/specialties", {"department": "ETAB1#INFO", "name": "Génie des matériaux"})[0] == 201
    assert a("POST /v1/admin/specialties", {"name": "Sans parent"})[0] == 400
    assert a("POST /v1/admin/specialties", {"department": "ETAB3#NOPE", "name": "Orphelin"})[0] == 404
    assert a("POST /v1/admin/specialties", {"department": "ETAB3", "name": "Mauvais parent"})[0] == 404
    listed = a("GET /v1/admin/specialties", query={"department": "ETAB1#INFO"})[1]["items"]
    assert [s["id"] for s in listed] == ["ETAB1#INFO#GENIE-DES-MATERIAUX", "ETAB1#INFO#IA"]
    assert len(a("GET /v1/admin/specialties")[1]["items"]) == 4

    path = {"id": "ETAB3#GENIE#GENIE-DES-MATERIAUX"}
    status, spec = call(admin, "PATCH /v1/admin/specialties/{id}", {"compatibleWith": []},
                        token=ADMIN_TOKEN, path=path)
    assert status == 200 and "compatibleWith" not in spec
    status, spec = call(admin, "PATCH /v1/admin/specialties/{id}", {"name": "Matériaux", "compatibleWith": ["BTP"]},
                        token=ADMIN_TOKEN, path=path)
    assert status == 200 and spec["name"] == "Matériaux" and spec["compatibleWith"] == ["BTP"]
    assert call(admin, "PATCH /v1/admin/specialties/{id}", {},
                token=ADMIN_TOKEN, path=path)[0] == 400
    assert call(admin, "PATCH /v1/admin/specialties/{id}", {"name": "x"},
                token=ADMIN_TOKEN, path={"id": "ETAB3#GENIE#NOPE"})[0] == 404
    # the specialty "code" of the id is what Users.specialty stores: usable at user creation
    a("POST /v1/admin/specialties", {"department": "ETAB1#INFO", "name": "Réseaux"})
    status, _ = a("POST /v1/admin/users", {**STUDENT, "email": "r@example.tn", "specialty": "RESEAUX"})
    assert status == 201


# ---------------------------------------------------------------- overview
@pytest.fixture
def seeded(ddb, calls):
    items, _ = seed.build(authlib.hash_password("x", iterations=1))
    res = boto3.resource("dynamodb", region_name="us-east-1")
    for logical in ("Users", "Reference"):
        with res.Table(C.table_name(logical)).batch_writer() as batch:
            for row in items[logical]:
                batch.put_item(Item=row)
    return items


def test_overview_with_seed_data(seeded, ddb, calls):
    login = [u for u in seeded["Users"] if u["role"] == "ADM"][0]
    token = token_for(login["userId"], "ADM")
    # Before the first check there is nothing to list: the lists come from ISSUE items.
    status, empty = call(admin, "GET /v1/admin/overview", token=token)
    assert status == 200 and empty["institutionsWithoutResponsable"] == []

    assert run_config_health()["opened"] == ["DEPARTMENT_WITHOUT_SPECIALTY#ETAB3#GENIE",
                                              "INSTITUTION_WITHOUT_RESPONSABLE#ETAB3"]
    conv_id = "11111111-1111-4111-8111-111111111111"
    from boto3.dynamodb.types import TypeSerializer
    ser = TypeSerializer()
    ddb.put_item(TableName=C.table_name("Conventions"), Item={k: ser.serialize(v) for k, v in {
        "conventionId": conv_id, "etab": "ETAB3", "state": "SIGNED_COMPANY",
        "currentActorId": "RESP#ETAB3", "stepSince": "2026-10-01T00:00:00Z"}.items()})
    run_config_health()

    status, body = call(admin, "GET /v1/admin/overview", token=token)
    assert status == 200
    assert body["usersByRole"] == {"ETU": 200, "ENT": 40, "ENS": 30, "RESP": 2, "ADM": 1}
    assert body["institutionsWithoutResponsable"] == [{"id": "ETAB3", "name": "Institut C"}]
    assert body["departmentsWithoutSpecialty"] == [
        {"id": "ETAB3#GENIE", "etab": "ETAB3", "name": "Génie civil"}]
    waiting = body["conventionsWaitingForMissingResponsable"]
    assert [(w["conventionId"], w["etab"]) for w in waiting] == [(conv_id, "ETAB3")]
    assert waiting[0]["since"].endswith("Z")
    cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)
              ).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert body["recentUsersCount"] == (273 if seed.CREATED >= cutoff else 0)
    assert ("pfe-connect-Users", "byRole") in calls and ("pfe-connect-Users", "allByCreatedAt") in calls

    # recentUsersCount counts accounts created now; the issue lists follow the fixes
    for n in range(2):
        assert call(admin, "POST /v1/admin/users", {"email": f"r{n}@e.tn", "password": PASSWORD,
                    "role": "ENT", "companyName": "X"}, token=token)[0] == 201
    assert call(admin, "POST /v1/admin/users", {"email": "resp3@e.tn", "password": PASSWORD,
                "role": "RESP", "etab": "ETAB3"}, token=token)[0] == 201
    body = call(admin, "GET /v1/admin/overview", token=token)[1]
    assert body["usersByRole"]["ENT"] == 42 and body["usersByRole"]["RESP"] == 3
    assert body["recentUsersCount"] == 3 + (273 if seed.CREATED >= cutoff else 0)
    assert body["institutionsWithoutResponsable"] == [] and body["conventionsWaitingForMissingResponsable"] == []
    assert len(body["departmentsWithoutSpecialty"]) == 1


def test_overview_recent_window_is_seven_days(world):
    old = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=8)).strftime("%Y-%m-%dT%H:%M:%SZ")
    put_user(world, "old-1", "ENT", created=old)
    assert a("POST /v1/admin/users", CREATE["ENT"])[0] == 201
    body = a("GET /v1/admin/overview")[1]
    assert body["recentUsersCount"] == 1
    assert body["usersByRole"] == {"ETU": 1, "ENT": 3, "ENS": 1, "RESP": 2, "ADM": 2}


def test_count_follows_pagination(world, monkeypatch):
    """COUNT queries stop at 1 MB: the helper must follow LastEvaluatedKey."""
    pages = [{"Count": 2, "LastEvaluatedKey": {"k": 1}}, {"Count": 3}]

    class Fake:
        def query(self, **kwargs):
            assert kwargs["Select"] == "COUNT"
            return pages.pop(0)

    assert admin._count(Fake(), IndexName="byRole") == 5 and not pages
