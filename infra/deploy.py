"""Idempotent deploy. Safe to run twice.

  python infra/deploy.py                  # everything
  python infra/deploy.py --only tables    # tables | buckets | lambdas | schedule | api
  python infra/deploy.py --no-schedule    # everything except the optional EventBridge rule
"""
import argparse
import io
import json
import pathlib
import secrets
import zipfile

import boto3
from botocore.exceptions import BotoCoreError, ClientError

import config as C

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUTPUTS = ROOT / "infra" / "outputs.json"
SECRETS = ROOT / "infra" / "secrets.json"

ACCOUNT = boto3.client("sts", region_name=C.REGION).get_caller_identity()["Account"]


def aws(service):
    return boto3.client(service, region_name=C.REGION)


def load_outputs():
    return json.loads(OUTPUTS.read_text()) if OUTPUTS.exists() else {}


def save_outputs(**values):
    data = load_outputs()
    data.update(values)
    OUTPUTS.write_text(json.dumps(data, indent=2))


def jwt_secret():
    if SECRETS.exists():
        return json.loads(SECRETS.read_text())["jwtSecret"]
    value = secrets.token_hex(32)
    SECRETS.write_text(json.dumps({"jwtSecret": value}))
    return value


# ---------------------------------------------------------------- tables
def ensure_tables():
    print("Tables")
    ddb = aws("dynamodb")
    existing = set()
    for page in ddb.get_paginator("list_tables").paginate():
        existing.update(page["TableNames"])
    created = []
    for logical, spec in C.TABLES.items():
        name = C.table_name(logical)
        if name in existing:
            print(f"  = {name} (exists; index changes need teardown)")
            continue
        attrs = {}

        def key_schema(h, r):
            attrs[h[0]] = h[1]
            schema = [{"AttributeName": h[0], "KeyType": "HASH"}]
            if r:
                attrs[r[0]] = r[1]
                schema.append({"AttributeName": r[0], "KeyType": "RANGE"})
            return schema

        kwargs = {"TableName": name, "BillingMode": "PAY_PER_REQUEST",
                  "KeySchema": key_schema(spec["hash"], spec["range"])}
        if spec["gsis"]:
            kwargs["GlobalSecondaryIndexes"] = [{
                "IndexName": g["name"],
                "KeySchema": key_schema(g["hash"], g["range"]),
                "Projection": {"ProjectionType": "ALL"},
            } for g in spec["gsis"]]
        kwargs["AttributeDefinitions"] = [
            {"AttributeName": n, "AttributeType": t} for n, t in attrs.items()]
        ddb.create_table(**kwargs)
        created.append(name)
        print(f"  + {name}")
    waiter = ddb.get_waiter("table_exists")
    for logical in C.TABLES:
        waiter.wait(TableName=C.table_name(logical))
    # TTL on notifications (optional attribute "ttl")
    try:
        ddb.update_time_to_live(TableName=C.table_name("Notifications"),
                                TimeToLiveSpecification={"Enabled": True, "AttributeName": "ttl"})
    except ClientError as err:
        print(f"  ! TTL not set: {err.response['Error']['Message']}")


# --------------------------------------------------------------- buckets
def ensure_buckets():
    print("Buckets")
    s3 = aws("s3")
    names = {}
    for logical in C.BUCKETS:
        name = C.bucket_name(logical, ACCOUNT)
        names[logical] = name
        try:
            s3.head_bucket(Bucket=name)
            print(f"  = {name}")
        except ClientError as err:
            if err.response["Error"]["Code"] not in ("404", "NoSuchBucket"):
                raise
            if C.REGION == "us-east-1":
                s3.create_bucket(Bucket=name)
            else:
                s3.create_bucket(Bucket=name, CreateBucketConfiguration={
                    "LocationConstraint": C.REGION})
            print(f"  + {name}")
        s3.put_public_access_block(Bucket=name, PublicAccessBlockConfiguration={
            "BlockPublicAcls": True, "IgnorePublicAcls": True,
            "BlockPublicPolicy": True, "RestrictPublicBuckets": True})
    # browser uploads of reports with presigned PUT URLs
    s3.put_bucket_cors(Bucket=names["reports"], CORSConfiguration={"CORSRules": [{
        "AllowedMethods": ["PUT", "GET"], "AllowedOrigins": ["*"],
        "AllowedHeaders": ["*"], "MaxAgeSeconds": 3000}]})
    save_outputs(buckets=names, account=ACCOUNT, region=C.REGION)


# --------------------------------------------------------------- lambdas
def build_zip(lambda_dir):
    sources = [(ROOT / "lambdas" / lambda_dir, ""), (ROOT / "lambdas" / "common", "common")]
    if (ROOT / "algos").exists():
        sources.append((ROOT / "algos", "algos"))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for base, prefix in sources:
            for path in sorted(base.rglob("*.py")):
                rel = path.relative_to(base).as_posix()
                zf.write(path, f"{prefix}/{rel}" if prefix else rel)
    return buf.getvalue()


def lambda_env():
    env = {"JWT_SECRET": jwt_secret(), "ALLOWED_ORIGIN": "*",
           # the admin Lambda invokes it asynchronously after a change (schema.md 4.9.1)
           "CONFIG_HEALTH_FUNCTION": C.function_name("config_health")}
    for logical in C.TABLES:
        env[f"TABLE_{logical.upper()}"] = C.table_name(logical)
    for logical in C.BUCKETS:
        env[f"BUCKET_{logical.upper()}"] = C.bucket_name(logical, ACCOUNT)
    return {"Variables": env}


def ensure_lambdas():
    print("Lambdas")
    lam = aws("lambda")
    role_arn = f"arn:aws:iam::{ACCOUNT}:role/{C.LAMBDA_ROLE}"
    for lambda_dir in C.FUNCTIONS:  # API Lambdas and the ones without routes
        fn = C.function_name(lambda_dir)
        code = build_zip(lambda_dir)
        try:
            lam.get_function(FunctionName=fn)
            exists = True
        except lam.exceptions.ResourceNotFoundException:
            exists = False
        if not exists:
            lam.create_function(
                FunctionName=fn, Runtime=C.RUNTIME, Role=role_arn, Handler="handler.handler",
                Code={"ZipFile": code}, Timeout=C.lambda_timeout(lambda_dir),
                MemorySize=C.LAMBDA_MEMORY,
                Environment=lambda_env())
            lam.get_waiter("function_active_v2").wait(FunctionName=fn)
            print(f"  + {fn} ({len(code)} bytes)")
        else:
            lam.update_function_code(FunctionName=fn, ZipFile=code)
            lam.get_waiter("function_updated_v2").wait(FunctionName=fn)
            lam.update_function_configuration(
                FunctionName=fn, Role=role_arn, Timeout=C.lambda_timeout(lambda_dir),
                MemorySize=C.LAMBDA_MEMORY, Environment=lambda_env())
            lam.get_waiter("function_updated_v2").wait(FunctionName=fn)
            print(f"  ~ {fn} ({len(code)} bytes)")


# ------------------------------------------------------------------- api
def _all(fn, key, **kwargs):
    items, token = [], None
    while True:
        page = fn(**kwargs, **({"NextToken": token} if token else {}))
        items += page[key]
        token = page.get("NextToken")
        if not token:
            return items


def ensure_api():
    print("API Gateway (HTTP API)")
    gw, lam = aws("apigatewayv2"), aws("lambda")
    api = next((a for a in _all(gw.get_apis, "Items") if a["Name"] == C.API_NAME), None)
    if not api:
        api = gw.create_api(Name=C.API_NAME, ProtocolType="HTTP", CorsConfiguration={
            "AllowOrigins": ["*"], "AllowMethods": ["*"], "AllowHeaders": ["*"]})
        print(f"  + {C.API_NAME}")
    api_id = api["ApiId"]
    routes = {r["RouteKey"] for r in _all(gw.get_routes, "Items", ApiId=api_id)}
    integrations = {i["IntegrationUri"]: i["IntegrationId"]
                    for i in _all(gw.get_integrations, "Items", ApiId=api_id)}
    for lambda_dir, spec in C.LAMBDAS.items():
        fn = C.function_name(lambda_dir)
        fn_arn = f"arn:aws:lambda:{C.REGION}:{ACCOUNT}:function:{fn}"
        integration_id = integrations.get(fn_arn) or gw.create_integration(
            ApiId=api_id, IntegrationType="AWS_PROXY", IntegrationUri=fn_arn,
            PayloadFormatVersion="2.0")["IntegrationId"]
        for route_key in spec["routes"]:
            if route_key not in routes:
                gw.create_route(ApiId=api_id, RouteKey=route_key,
                                Target=f"integrations/{integration_id}")
                print(f"  + {route_key} -> {fn}")
        try:
            lam.add_permission(
                FunctionName=fn, StatementId=f"apigw-{api_id}",
                Action="lambda:InvokeFunction", Principal="apigateway.amazonaws.com",
                SourceArn=f"arn:aws:execute-api:{C.REGION}:{ACCOUNT}:{api_id}/*/*")
        except lam.exceptions.ResourceConflictException:
            pass
    try:
        gw.get_stage(ApiId=api_id, StageName="$default")
    except gw.exceptions.NotFoundException:
        gw.create_stage(ApiId=api_id, StageName="$default", AutoDeploy=True)
    url = f"https://{api_id}.execute-api.{C.REGION}.amazonaws.com"
    save_outputs(apiId=api_id, apiUrl=url)
    print(f"  API URL: {url}")


# -------------------------------------------------------------- schedule
MANUAL_HINT = ('    The check can still be run by hand:\n'
               '      aws lambda invoke --function-name {fn} out.json')


def _has_permission(lam, fn, statement_id):
    try:
        policy = json.loads(lam.get_policy(FunctionName=fn)["Policy"])
    except lam.exceptions.ResourceNotFoundException:  # no resource policy yet
        return False
    return any(st.get("Sid") == statement_id for st in policy.get("Statement", []))


def ensure_schedule():
    """OPTIONAL: one EventBridge rule per scheduled Lambda (daily config_health).

    Idempotent (put_rule and put_targets overwrite, the permission conflict is ignored). It never
    fails the deploy: the Learner Lab may deny events:* or lambda:AddPermission.
    """
    print("Schedule (optional)")
    events, lam = aws("events"), aws("lambda")
    for lambda_dir, spec in C.SCHEDULED_LAMBDAS.items():
        fn = C.function_name(lambda_dir)
        rule = spec["rule"]
        try:
            fn_arn = lam.get_function(FunctionName=fn)["Configuration"]["FunctionArn"]
            rule_arn = events.put_rule(
                Name=rule, ScheduleExpression=spec["schedule"], State="ENABLED",
                Description=f"Daily run of {fn}")["RuleArn"]
            statement_id = f"events-{rule}"
            if not _has_permission(lam, fn, statement_id):
                try:
                    lam.add_permission(
                        FunctionName=fn, StatementId=statement_id,
                        Action="lambda:InvokeFunction", Principal="events.amazonaws.com",
                        SourceArn=rule_arn)
                except lam.exceptions.ResourceConflictException:
                    pass
            events.put_targets(Rule=rule, Targets=[{"Id": "1", "Arn": fn_arn}])
            print(f"  = {rule} ({spec['schedule']}) -> {fn}")
        except (ClientError, BotoCoreError) as err:
            if isinstance(err, ClientError):
                code = err.response["Error"]["Code"]
                reason = f"{code}: {err.response['Error']['Message']}"
                denied = "denied" in code.lower() or code in ("UnauthorizedOperation",
                                                              "AuthorizationError")
            else:
                reason, denied = str(err), False
            head = "denied by the Learner Lab" if denied else "failed"
            print(f"  ! schedule for {fn} {head} ({reason}); deploy continues.")
            print(MANUAL_HINT.format(fn=fn))


# ------------------------------------------------------------------ main
STEPS = {"tables": ensure_tables, "buckets": ensure_buckets, "lambdas": ensure_lambdas,
         "schedule": ensure_schedule, "api": ensure_api}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=list(STEPS))
    parser.add_argument("--no-schedule", action="store_true",
                        help="skip the optional EventBridge rule")
    args = parser.parse_args()
    print(f"Account {ACCOUNT}, region {C.REGION}")
    for step_name, step in STEPS.items():
        if args.only and args.only != step_name:
            continue
        if step_name == "schedule" and args.no_schedule and not args.only:
            continue
        step()
    # Phase 3: SNS topic, EventBridge rules, S3 event notification go here.
    print("Done. Outputs in infra/outputs.json")