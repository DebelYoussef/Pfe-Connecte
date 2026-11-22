import json
import sys

import boto3
import pytest

from conftest import C, INFRA, load_handler
from common import auth as authlib

handler_mod = load_handler("config_health_handler", "config_health")
sys.path.insert(0, str(INFRA))
import seed  # noqa: E402


@pytest.fixture
def seeded(ddb, calls):
    items, _ = seed.build(authlib.hash_password("x", iterations=1))
    res = boto3.resource("dynamodb", region_name="us-east-1")
    for logical in ("Users", "Reference"):
        with res.Table(C.table_name(logical)).batch_writer() as batch:
            for row in items[logical]:
                batch.put_item(Item=row)
    return ddb


EVENTBRIDGE = {"version": "0", "source": "aws.events", "detail-type": "Scheduled Event",
               "resources": ["arn:aws:events:us-east-1:123456789012:rule/pfe-connect-config-health-daily"]}


def notif_count(ddb, user_id):
    res = ddb.query(TableName=C.table_name("Notifications"), KeyConditionExpression="userId = :u",
                    ExpressionAttributeValues={":u": {"S": user_id}})
    return res["Count"]


def test_scheduled_run_opens_the_two_seed_issues_once(seeded, capsys):
    admin_id = [u for u in seed.build("h")[0]["Users"] if u["role"] == "ADM"][0]["userId"]
    first = handler_mod.handler(EVENTBRIDGE, None)
    assert first["opened"] == ["DEPARTMENT_WITHOUT_SPECIALTY#ETAB3#GENIE",
                               "INSTITUTION_WITHOUT_RESPONSABLE#ETAB3"]
    assert first["resolved"] == [] and len(first["open"]) == 2
    assert notif_count(seeded, admin_id) == 2          # one notification per issue, per admin
    log = [json.loads(l) for l in capsys.readouterr().out.splitlines() if l.startswith("{")]
    done = [l for l in log if l["message"] == "config_health_done"][0]
    assert done["trigger"] == "schedule" and done["openCount"] == 2 and done["function"] == "config_health"

    second = handler_mod.handler({"source": "admin"}, None)  # dedupe: nothing new, no new notification
    assert second["opened"] == [] and second["resolved"] == []
    assert notif_count(seeded, admin_id) == 2


def test_manual_invoke_with_empty_event_and_failure_is_reraised(seeded, monkeypatch, capsys):
    assert handler_mod.handler({}, None)["open"]
    monkeypatch.setattr(handler_mod, "run_config_health", lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    with pytest.raises(RuntimeError):
        handler_mod.handler(EVENTBRIDGE, None)
    assert '"config_health_failed"' in capsys.readouterr().out


# ----------------------------------------------------------- infra (config, deploy)
def test_config_packages_lambdas_without_routes():
    assert {"admin", "reference"} <= set(C.LAMBDAS)
    assert "config_health" not in C.LAMBDAS                      # no route in openapi.yaml
    assert "config_health" in C.SCHEDULED_LAMBDAS
    assert {"admin", "reference", "config_health"} <= set(C.FUNCTIONS)
    assert len(C.FUNCTIONS) == len(set(C.FUNCTIONS))
    assert C.lambda_timeout("config_health") == 60 and C.lambda_timeout("admin") == C.LAMBDA_TIMEOUT
    routes = {r for spec in C.LAMBDAS.values() for r in spec["routes"]}
    assert "GET /v1/reference/institutions" in routes and "PATCH /v1/admin/users/{id}" in routes
    assert len([r for r in routes if "/v1/admin/" in r]) == 13


@pytest.fixture
def deploy_mod(ddb):
    import importlib
    sys.modules.pop("deploy", None)
    return importlib.import_module("deploy")  # needs STS: imported inside mock_aws


def make_function(deploy):
    import io
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("handler.py", "def handler(e, c):\n    return {}\n")
    iam = boto3.client("iam", region_name="us-east-1")
    role = iam.create_role(RoleName="LabRole", AssumeRolePolicyDocument="{}")["Role"]["Arn"]
    boto3.client("lambda", region_name="us-east-1").create_function(
        FunctionName="pfe-connect-config_health", Runtime="python3.12", Role=role,
        Handler="handler.handler", Code={"ZipFile": buf.getvalue()})


def test_ensure_schedule_is_idempotent(deploy_mod, capsys):
    make_function(deploy_mod)
    deploy_mod.ensure_schedule()
    deploy_mod.ensure_schedule()
    events = boto3.client("events", region_name="us-east-1")
    rules = events.list_rules()["Rules"]
    assert [(r["Name"], r["ScheduleExpression"], r["State"]) for r in rules] == [
        ("pfe-connect-config-health-daily", "rate(1 day)", "ENABLED")]
    targets = events.list_targets_by_rule(Rule="pfe-connect-config-health-daily")["Targets"]
    assert len(targets) == 1 and targets[0]["Arn"].endswith(":function:pfe-connect-config_health")
    policy = json.loads(boto3.client("lambda", region_name="us-east-1").get_policy(
        FunctionName="pfe-connect-config_health")["Policy"])
    assert len(policy["Statement"]) == 1 and policy["Statement"][0]["Principal"]["Service"] == "events.amazonaws.com"
    assert "!" not in capsys.readouterr().out


def test_ensure_schedule_denied_prints_hint_and_does_not_fail(deploy_mod, monkeypatch, capsys):
    from botocore.exceptions import ClientError
    make_function(deploy_mod)
    real = deploy_mod.aws

    class Denied:
        def put_rule(self, **kwargs):
            raise ClientError({"Error": {"Code": "AccessDeniedException",
                                         "Message": "not authorized to perform events:PutRule"}}, "PutRule")

    monkeypatch.setattr(deploy_mod, "aws", lambda service: Denied() if service == "events" else real(service))
    deploy_mod.ensure_schedule()  # must not raise
    out = capsys.readouterr().out
    assert "denied by the Learner Lab" in out
    assert "aws lambda invoke --function-name pfe-connect-config_health out.json" in out


def test_lambda_env_carries_the_config_health_function(deploy_mod, tmp_path, monkeypatch):
    monkeypatch.setattr(deploy_mod, "SECRETS", tmp_path / "secrets.json")
    env = deploy_mod.lambda_env()["Variables"]
    assert env["CONFIG_HEALTH_FUNCTION"] == "pfe-connect-config_health"
    assert env["TABLE_NOTIFICATIONS"] == "pfe-connect-Notifications"


def test_build_zip_for_a_lambda_without_routes(deploy_mod):
    import io
    import zipfile
    names = zipfile.ZipFile(io.BytesIO(deploy_mod.build_zip("config_health"))).namelist()
    assert "handler.py" in names and "common/config_health.py" in names and "common/users.py" in names
