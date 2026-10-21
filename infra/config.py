import pathlib
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent

"""Single source of truth for infra names. Keys and indexes mirror docs/schema.md."""
import os

REGION = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"
PREFIX = "pfe-connect"
RUNTIME = "python3.12"
LAMBDA_ROLE = "LabRole"
LAMBDA_TIMEOUT = 15
LAMBDA_MEMORY = 256
API_NAME = f"{PREFIX}-api"
BUCKETS = ["reports", "conventions", "frontend"]


def _t(hash_key, range_key=None, hash_type="S", range_type="S", gsis=()):
    return {"hash": (hash_key, hash_type),
            "range": (range_key, range_type) if range_key else None,
            "gsis": list(gsis)}


def _g(name, hash_key, range_key=None):
    return {"name": name, "hash": (hash_key, "S"),
            "range": (range_key, "S") if range_key else None}


TABLES = {
    "Users": _t("userId", gsis=[
        _g("byEtabRole", "etab", "role"),
        _g("internsByLastJournal", "stageEtab", "lastJournal"),
        _g("noInternshipByEtab", "sansStageEtab"),
    ]),
    "Offers": _t("offerId", gsis=[
        _g("byCompany", "companyId", "createdAt"),
        _g("openByRegion", "status", "gouvernoratCreatedAt"),
    ]),
    "Applications": _t("studentId", "offerId", gsis=[
        _g("byOffer", "offerId", "studentId"),
    ]),
    "Conventions": _t("conventionId", gsis=[
        _g("byCompany", "companyId"),
        _g("pendingByActor", "currentActorId", "stepSince"),
        _g("stuckByEtab", "etab", "stepSince"),
        _g("noSupervisor", "noSupervisorEtab", "approvedAt"),
    ]),
    # sk = "<timestamp>#<type>"
    "ConventionEvents": _t("conventionId", "sk"),
    "Supervisions": _t("studentId", gsis=[
        _g("byTeacher", "teacherId", "status"),
    ]),
    "Journals": _t("studentId", "week"),
    "Reports": _t("studentId", "version", range_type="N", gsis=[
        _g("pendingForCompany", "pendingCompanyId", "submittedAt"),
        _g("pendingForTeacher", "pendingTeacherId", "submittedAt"),
    ]),
    # sk = "<createdAt>#<id>"
    "Notifications": _t("userId", "sk"),
    "Recommendations": _t("studentId", "rank", range_type="N"),
    "SubjectsArchive": _t("year", "subjectId", hash_type="N"),
    "Reference": _t("type", "id"),
}

def routes_from_openapi():
    spec = yaml.safe_load((ROOT / "docs" / "openapi.yaml").read_text())
    lambdas = {}
    for path, operations in spec["paths"].items():
        for method, op in operations.items():
            name = op.get("x-lambda") if isinstance(op, dict) else None
            if method.upper() in ("GET", "POST", "PUT", "PATCH", "DELETE") and name:
                if (ROOT / "lambdas" / name / "handler.py").is_file():
                    lambdas.setdefault(name, {"routes": []})["routes"].append(
                        f"{method.upper()} {path}")
    return lambdas


LAMBDAS = routes_from_openapi()


def table_name(logical):
    return f"{PREFIX}-{logical}"


def bucket_name(logical, account):
    return f"{PREFIX}-{account}-{logical}"


def function_name(lambda_dir):
    return f"{PREFIX}-{lambda_dir}"
