"""notify, config_health, config.py GSIs and seed (pytest + moto, no real AWS)."""
import importlib.util
import os
import sys
import time
from pathlib import Path

os.environ.update({
    "JWT_SECRET": "test-secret",
    "TABLE_USERS": "pfe-connect-Users",
    "TABLE_REFERENCE": "pfe-connect-Reference",
    "TABLE_NOTIFICATIONS": "pfe-connect-Notifications",
    "TABLE_CONVENTIONS": "pfe-connect-Conventions",
    "AWS_DEFAULT_REGION": "us-east-1",
    "AWS_ACCESS_KEY_ID": "testing",
    "AWS_SECRET_ACCESS_KEY": "testing",
    "AWS_SESSION_TOKEN": "testing",
})

import boto3
import pytest
from boto3.dynamodb.conditions import Key
from moto import mock_aws

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "lambdas").is_dir())
sys.path.insert(0, str(ROOT / "lambdas"))
sys.path.insert(0, str(ROOT / "infra"))

import config as C  # noqa: E402  (infra/config.py: single source of truth for keys and indexes)
from common import config_health, db, enums, notify  # noqa: E402

_spec = importlib.util.spec_from_file_location("seed_module", ROOT / "infra" / "seed.py")
seed = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(seed)

DAY = 24 * 3600


def _create_table(ddb, logical):
    """Create a moto table from infra/config.py, so the real index definitions are exercised."""
    spec = C.TABLES[logical]
    attrs = {}

    def key_schema(hash_key, range_key):
        attrs[hash_key[0]] = hash_key[1]
        schema = [{"AttributeName": hash_key[0], "KeyType": "HASH"}]
        if range_key:
            attrs[range_key[0]] = range_key[1]
            schema.append({"AttributeName": range_key[0], "KeyType": "RANGE"})
        return schema

    kwargs = {"TableName": C.table_name(logical),
              "KeySchema": key_schema(spec["hash"], spec["range"]),
              "BillingMode": "PAY_PER_REQUEST"}
    gsis = [{"IndexName": g["name"], "KeySchema": key_schema(g["hash"], g["range"]),
             "Projection": {"ProjectionType": "ALL"}} for g in spec["gsis"]]
    if gsis:
        kwargs["GlobalSecondaryIndexes"] = gsis
    kwargs["AttributeDefinitions"] = [{"AttributeName": n, "AttributeType": t}
                                      for n, t in attrs.items()]
    ddb.create_table(**kwargs)


@pytest.fixture
def aws():
    with mock_aws():
        ddb = boto3.client("dynamodb", region_name="us-east-1")
        for logical in ("Users", "Reference", "Notifications", "Conventions"):
            _create_table(ddb, logical)
        db._resource = None
        db._client = None
        yield ddb


# ------------------------------------------------------------------ helpers
def add_user(user_id, role, etab=None):
    item = {"userId": user_id, "email": f"{user_id}@pfe.test", "role": role,
            "createdAt": "2026-09-01T00:00:00Z", "gsiAll": "ALL"}
    if etab:
        item["etab"] = etab
    db.table("users").put_item(Item=item)


def ref(type_, id_, **attrs):
    db.table("reference").put_item(Item={"type": type_, "id": id_, **attrs})


def add_convention(conv_id, etab):
    db.table("conventions").put_item(Item={
        "conventionId": conv_id, "etab": etab, "state": "SUBMITTED",
        "currentActorId": f"RESP#{etab}", "stepSince": "2026-09-02T00:00:00Z"})


def notifications_of(user_id):
    return db.table("notifications").query(
        KeyConditionExpression=Key("userId").eq(user_id))["Items"]


def all_notifications():
    return db.table("notifications").scan()["Items"]


def issue_ids():
    return sorted(i["id"] for i in db.table("reference").query(
        KeyConditionExpression=Key("type").eq("ISSUE"))["Items"])


# ---------------------------------------------------------------- config.py
def test_config_declares_the_two_new_users_indexes():
    gsis = {g["name"]: g for g in C.TABLES["Users"]["gsis"]}
    assert gsis["byRole"]["hash"] == ("role", "S")
    assert gsis["byRole"]["range"] == ("createdAt", "S")
    assert gsis["allByCreatedAt"]["hash"] == ("gsiAll", "S")
    assert gsis["allByCreatedAt"]["range"] == ("createdAt", "S")
    assert "byEtabRole" in gsis  # untouched


def test_users_indexes_serve_their_queries(aws):
    add_user("adm1", "ADM")
    add_user("resp1", "RESP", etab="ETAB1")
    users = db.table("users")
    by_role = users.query(IndexName="byRole", KeyConditionExpression=Key("role").eq("ADM"))
    assert [i["userId"] for i in by_role["Items"]] == ["adm1"]
    everyone = users.query(IndexName="allByCreatedAt",
                           KeyConditionExpression=Key("gsiAll").eq("ALL")
                           & Key("createdAt").gte("2026-01-01T00:00:00Z"))
    assert {i["userId"] for i in everyone["Items"]} == {"adm1", "resp1"}


# --------------------------------------------------------- create_notification
def test_create_notification_stores_the_contract_fields(aws):
    before = int(time.time())
    item = notify.create_notification(
        "u1", "ADMIN_ACCOUNT_CREATED", "Titre", "Corps", "USER", "u2", "WARNING")
    stored = db.table("notifications").get_item(
        Key={"userId": "u1", "sk": item["sk"]})["Item"]
    created_at, notif_id = stored["sk"].split("#", 1)
    assert created_at == stored["createdAt"] and len(notif_id) == 36
    assert stored["type"] == "ADMIN_ACCOUNT_CREATED"
    assert stored["title"] == "Titre" and stored["body"] == "Corps"
    assert stored["refType"] == "USER" and stored["refId"] == "u2"
    assert stored["level"] == "WARNING"
    assert stored["read"] is False
    assert before + 90 * DAY <= int(stored["ttl"]) <= int(time.time()) + 90 * DAY


def test_create_notification_defaults_to_info_and_rejects_unknown_values(aws):
    item = notify.create_notification("u1", "ADMIN_ROLE_GRANTED", "t", "b", "USER", "u2")
    assert item["level"] == "INFO"
    with pytest.raises(ValueError):
        notify.create_notification("u1", "NOT_A_TYPE", "t", "b", "USER", "u2")
    with pytest.raises(ValueError):
        notify.create_notification("u1", "ADMIN_ROLE_GRANTED", "t", "b", "NOPE", "u2")
    with pytest.raises(ValueError):
        notify.create_notification("u1", "ADMIN_ROLE_GRANTED", "t", "b", "USER", "u2", "LOUD")
    assert len(all_notifications()) == 1


# ------------------------------------------------------------- notify_admins
def test_notify_admins_only_notifies_adm_users(aws):
    add_user("adm1", "ADM")
    add_user("adm2", "ADM")
    add_user("resp1", "RESP", etab="ETAB1")
    add_user("etu1", "ETU", etab="ETAB1")
    notified = notify.notify_admins(
        "ADMIN_ACCOUNT_CREATED", "t", "b", "USER", "adm2", "INFO")
    assert sorted(notified) == ["adm1", "adm2"]
    assert len(notifications_of("adm1")) == 1 and len(notifications_of("adm2")) == 1
    assert notifications_of("resp1") == [] and notifications_of("etu1") == []


def test_notify_admins_honors_exclude_user_id(aws):
    add_user("adm1", "ADM")
    add_user("adm2", "ADM")
    notified = notify.notify_admins(
        "ADMIN_ROLE_GRANTED", "t", "b", "USER", "adm2", "INFO", exclude_user_id="adm2")
    assert notified == ["adm1"]
    assert notifications_of("adm2") == []


def test_notify_admins_follows_pagination(aws, monkeypatch):
    for i in range(5):
        add_user(f"adm{i}", "ADM")
    for i in range(3):
        add_user(f"etu{i}", "ETU", etab="ETAB1")
    monkeypatch.setattr(notify, "PAGE_SIZE", 2)  # 5 admins -> 3 pages
    assert sorted(notify.list_admin_ids()) == [f"adm{i}" for i in range(5)]
    notified = notify.notify_admins(
        "ADMIN_ACCOUNT_CREATED", "t", "b", "USER", "x", "INFO", exclude_user_id="adm3")
    assert sorted(notified) == ["adm0", "adm1", "adm2", "adm4"]
    assert len(all_notifications()) == 4


# ------------------------------------------------------------ config_health
def setup_issues():
    """ETAB1 healthy; ETAB2 without RESP; GENIE without specialty; one blocked convention."""
    add_user("adm1", "ADM")
    add_user("adm2", "ADM")
    add_user("etu1", "ETU", etab="ETAB2")
    add_user("resp1", "RESP", etab="ETAB1")
    ref("ETAB", "ETAB1", name="Institut A")
    ref("ETAB", "ETAB2", name="Institut B")
    ref("DEPARTMENT", "ETAB1#INFO", name="Informatique")
    ref("SPECIALTY", "ETAB1#INFO#gl", name="Génie logiciel")
    ref("DEPARTMENT", "ETAB1#GENIE", name="Génie civil")
    add_convention("conv-blocked", "ETAB2")  # institution without RESP: an issue
    add_convention("conv-fine", "ETAB1")     # institution with a RESP: not an issue


EXPECTED = [
    "CONVENTION_WAITING_NO_RESPONSABLE#conv-blocked",
    "DEPARTMENT_WITHOUT_SPECIALTY#ETAB1#GENIE",
    "INSTITUTION_WITHOUT_RESPONSABLE#ETAB2",
]


def test_run_config_health_opens_one_notification_per_issue(aws):
    setup_issues()
    result = config_health.run_config_health()
    assert sorted(result["opened"]) == EXPECTED
    assert sorted(result["open"]) == EXPECTED and result["resolved"] == []
    assert issue_ids() == EXPECTED

    sent = all_notifications()
    assert len(sent) == 3 * 2  # three issues, two admins
    assert {n["userId"] for n in sent} == {"adm1", "adm2"}
    assert {n["level"] for n in sent} == {"WARNING"}
    by_type = {n["type"]: n for n in notifications_of("adm1")}
    assert set(by_type) == {"INSTITUTION_WITHOUT_RESPONSABLE", "DEPARTMENT_WITHOUT_SPECIALTY",
                            "CONVENTION_WAITING_NO_RESPONSABLE"}
    inst = by_type["INSTITUTION_WITHOUT_RESPONSABLE"]
    assert (inst["refType"], inst["refId"]) == ("INSTITUTION", "ETAB2")
    assert "Institut B" in inst["body"]
    dept = by_type["DEPARTMENT_WITHOUT_SPECIALTY"]
    assert (dept["refType"], dept["refId"]) == ("INSTITUTION", "ETAB1#GENIE")
    assert "Génie civil" in dept["body"] and "Institut A" in dept["body"]
    conv = by_type["CONVENTION_WAITING_NO_RESPONSABLE"]
    assert (conv["refType"], conv["refId"]) == ("CONVENTION", "conv-blocked")

    issue = db.table("reference").get_item(
        Key={"type": "ISSUE", "id": "INSTITUTION_WITHOUT_RESPONSABLE#ETAB2"})["Item"]
    assert issue["openedAt"] and issue["notifiedAt"]


def test_second_run_sends_nothing(aws):
    setup_issues()
    config_health.run_config_health()
    result = config_health.run_config_health()
    assert result["opened"] == [] and result["resolved"] == []
    assert sorted(result["open"]) == EXPECTED
    assert len(all_notifications()) == 6


def test_fixing_the_problems_deletes_the_issues_and_a_return_notifies_again(aws):
    setup_issues()
    config_health.run_config_health()

    add_user("resp2", "RESP", etab="ETAB2")                        # fixes institution + convention
    ref("SPECIALTY", "ETAB1#GENIE#structures", name="Structures")  # fixes the department
    result = config_health.run_config_health()
    assert sorted(result["resolved"]) == EXPECTED
    assert result["opened"] == [] and result["open"] == []
    assert issue_ids() == []
    assert len(all_notifications()) == 6  # resolving sends nothing

    db.table("users").delete_item(Key={"userId": "resp2"})         # the problem comes back
    result = config_health.run_config_health()
    assert sorted(result["opened"]) == [EXPECTED[0], EXPECTED[2]]
    assert len(all_notifications()) == 6 + 2 * 2


def test_failed_fan_out_is_retried_by_the_next_run(aws, monkeypatch):
    add_user("adm1", "ADM")
    ref("ETAB", "ETAB2", name="Institut B")

    def boom(*args, **kwargs):
        raise RuntimeError("SNS down")

    monkeypatch.setattr(config_health, "notify_admins", boom)
    result = config_health.run_config_health()
    assert result["opened"] == ["INSTITUTION_WITHOUT_RESPONSABLE#ETAB2"]
    assert all_notifications() == []
    item = db.table("reference").get_item(
        Key={"type": "ISSUE", "id": "INSTITUTION_WITHOUT_RESPONSABLE#ETAB2"})["Item"]
    assert "notifiedAt" not in item

    monkeypatch.undo()
    config_health.run_config_health()
    assert len(all_notifications()) == 1
    config_health.run_config_health()
    assert len(all_notifications()) == 1


def test_issue_kinds_are_notification_types():
    assert set(config_health.ISSUE_KINDS) <= set(enums.NOTIFICATION_TYPE)
    assert set(config_health.REF_TYPE.values()) <= set(enums.NOTIFICATION_REF_TYPE)


# --------------------------------------------------------------------- seed
def test_seed_is_reproducible_and_every_user_has_gsi_all():
    items, _ = seed.build("hash")
    assert items == seed.build("hash")[0]
    assert items["Users"] and all(u["gsiAll"] == "ALL" for u in items["Users"])
    assert all("createdAt" in u for u in items["Users"])
    admins = [u for u in items["Users"] if u["role"] == "ADM"]
    assert len(admins) == 1 and "etab" not in admins[0]
    # users store codes, reference ids follow schema 4.12
    spec_ids = {r["id"] for r in items["Reference"] if r["type"] == "SPECIALTY"}
    for u in items["Users"]:
        if u["role"] == "ETU":
            assert f"{u['etab']}#{u['department']}#{u['specialty']}" in spec_ids


def test_seeded_database_raises_exactly_the_two_demo_warnings(aws):
    items, _ = seed.build("hash")
    for logical in ("Users", "Reference"):
        with db.table(logical.lower()).batch_writer() as batch:
            for row in items[logical]:
                batch.put_item(Item=row)
    result = config_health.run_config_health()
    assert sorted(result["opened"]) == [
        "DEPARTMENT_WITHOUT_SPECIALTY#ETAB3#GENIE",
        "INSTITUTION_WITHOUT_RESPONSABLE#ETAB3",
    ]
    admin_id = next(u["userId"] for u in items["Users"] if u["role"] == "ADM")
    assert len(notifications_of(admin_id)) == 2
    assert config_health.run_config_health()["opened"] == []
