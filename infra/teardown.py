"""Delete everything deploy.py created. Order: API, Lambdas, tables, buckets.

  python infra/teardown.py --yes
"""
import argparse
import pathlib

import boto3
from botocore.exceptions import ClientError

import config as C

ROOT = pathlib.Path(__file__).resolve().parent.parent
ACCOUNT = boto3.client("sts", region_name=C.REGION).get_caller_identity()["Account"]


def aws(service):
    return boto3.client(service, region_name=C.REGION)


def delete_api():
    gw = aws("apigatewayv2")
    token = None
    while True:
        page = gw.get_apis(**({"NextToken": token} if token else {}))
        for api in page["Items"]:
            if api["Name"] == C.API_NAME:
                gw.delete_api(ApiId=api["ApiId"])
                print(f"  - api {api['ApiId']}")
        token = page.get("NextToken")
        if not token:
            return


def delete_lambdas():
    lam = aws("lambda")
    for lambda_dir in C.LAMBDAS:
        fn = C.function_name(lambda_dir)
        try:
            lam.delete_function(FunctionName=fn)
            print(f"  - {fn}")
        except lam.exceptions.ResourceNotFoundException:
            pass


def delete_tables():
    ddb = aws("dynamodb")
    for logical in C.TABLES:
        name = C.table_name(logical)
        try:
            ddb.delete_table(TableName=name)
            print(f"  - {name}")
        except ddb.exceptions.ResourceNotFoundException:
            pass
    for logical in C.TABLES:
        ddb.get_waiter("table_not_exists").wait(TableName=C.table_name(logical))


def delete_buckets():
    s3 = boto3.resource("s3", region_name=C.REGION)
    for logical in C.BUCKETS:
        name = C.bucket_name(logical, ACCOUNT)
        try:
            bucket = s3.Bucket(name)
            bucket.objects.all().delete()
            bucket.delete()
            print(f"  - {name}")
        except ClientError as err:
            if err.response["Error"]["Code"] != "NoSuchBucket":
                raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--yes", action="store_true")
    args = parser.parse_args()
    if not args.yes and input(f"Delete ALL pfe-connect resources in {ACCOUNT}? [y/N] ").lower() != "y":
        raise SystemExit("Aborted")
    # Phase 3: delete EventBridge rules and the SNS topic here.
    for label, step in (("API", delete_api), ("Lambdas", delete_lambdas),
                        ("Tables", delete_tables), ("Buckets", delete_buckets)):
        print(label)
        step()
    (ROOT / "infra" / "outputs.json").unlink(missing_ok=True)
    print("Done")
