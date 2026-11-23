"""Configuration health check (docs/schema.md 4.9.1 and 4.12).

Finds three kinds of issue, opens one Reference ISSUE item per issue and notifies the admins once,
and deletes the ISSUE items whose problem is gone. No Scan: Query and GetItem only.

  INSTITUTION_WITHOUT_RESPONSABLE    institution with no RESP user          (byEtabRole)
  DEPARTMENT_WITHOUT_SPECIALTY       department with no SPECIALTY item      (Reference prefix query)
  CONVENTION_WAITING_NO_RESPONSABLE  convention waiting for RESP#{etab} of an institution with no RESP
                                     (Conventions.pendingByActor)

ISSUE id is "{kind}#{refId}" (refId may itself contain "#", e.g. a department id "ETAB1#INFO").
"""
import datetime

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from .db import batch_get, now_iso, table
from .log import get_logger
from .notify import notify_admins

INSTITUTION_WITHOUT_RESPONSABLE = "INSTITUTION_WITHOUT_RESPONSABLE"
DEPARTMENT_WITHOUT_SPECIALTY = "DEPARTMENT_WITHOUT_SPECIALTY"
CONVENTION_WAITING_NO_RESPONSABLE = "CONVENTION_WAITING_NO_RESPONSABLE"
ISSUE_KINDS = (INSTITUTION_WITHOUT_RESPONSABLE, DEPARTMENT_WITHOUT_SPECIALTY,
               CONVENTION_WAITING_NO_RESPONSABLE)

# refType per kind (contract 4.9.1: there is no DEPARTMENT ref type, a department issue uses INSTITUTION)
REF_TYPE = {
    INSTITUTION_WITHOUT_RESPONSABLE: "INSTITUTION",
    DEPARTMENT_WITHOUT_SPECIALTY: "INSTITUTION",
    CONVENTION_WAITING_NO_RESPONSABLE: "CONVENTION",
}

log = get_logger("config_health")


def _iso(now):
    if now is None:
        return now_iso()
    if isinstance(now, datetime.datetime):
        return now.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return now


def _query_all(tbl, **kwargs):
    while True:
        res = tbl.query(**kwargs)
        yield from res.get("Items", [])
        last = res.get("LastEvaluatedKey")
        if not last:
            return
        kwargs["ExclusiveStartKey"] = last


def _exists(tbl, **kwargs):
    return bool(tbl.query(Limit=1, **kwargs).get("Items"))


def _issue(kind, ref_id, title, body):
    return {"id": f"{kind}#{ref_id}", "kind": kind, "refId": ref_id,
            "title": title, "body": body}


def _detect():
    """All issues that exist right now, keyed by ISSUE id."""
    reference = table("reference")
    issues = {}

    institutions = {
        item["id"]: item.get("name", item["id"])
        for item in _query_all(reference, KeyConditionExpression=Key("type").eq("ETAB"),
                               ConsistentRead=True)
    }

    without_resp = []
    for etab, name in institutions.items():
        has_resp = _exists(
            table("users"), IndexName="byEtabRole",
            KeyConditionExpression=Key("etab").eq(etab) & Key("role").eq("RESP"))
        if not has_resp:
            without_resp.append(etab)
            issue = _issue(
                INSTITUTION_WITHOUT_RESPONSABLE, etab,
                "Établissement sans responsable",
                f"L'établissement « {name} » n'a aucun responsable : ses conventions "
                f"ne pourront pas être signées.")
            issues[issue["id"]] = issue

    for dept in _query_all(reference, KeyConditionExpression=Key("type").eq("DEPARTMENT"),
                           ConsistentRead=True):
        dept_id = dept["id"]
        has_specialty = _exists(
            reference, ConsistentRead=True,
            KeyConditionExpression=Key("type").eq("SPECIALTY") & Key("id").begins_with(f"{dept_id}#"))
        if not has_specialty:
            dept_name = dept.get("name", dept_id)
            etab = dept_id.split("#", 1)[0]
            etab_name = institutions.get(etab, etab)
            issue = _issue(
                DEPARTMENT_WITHOUT_SPECIALTY, dept_id,
                "Département sans spécialité",
                f"Le département « {dept_name} » de l'établissement « {etab_name} » n'a aucune "
                f"spécialité : les étudiants ne peuvent pas s'y inscrire.")
            issues[issue["id"]] = issue

    for etab in without_resp:
        etab_name = institutions[etab]
        for conv in _query_all(
                table("conventions"), IndexName="pendingByActor",
                KeyConditionExpression=Key("currentActorId").eq(f"RESP#{etab}")):
            issue = _issue(
                CONVENTION_WAITING_NO_RESPONSABLE, conv["conventionId"],
                "Convention en attente d'un responsable",
                f"Une convention de l'établissement « {etab_name} » attend la signature d'un "
                f"responsable, mais cet établissement n'en a aucun.")
            issues[issue["id"]] = issue
    return issues


def _notify(issue, now):
    """Fan out to the admins, then stamp notifiedAt. Never raises: a failed fan-out is retried
    by the next run because the ISSUE item has no notifiedAt."""
    try:
        notify_admins(issue["kind"], issue["title"], issue["body"],
                      REF_TYPE[issue["kind"]], issue["refId"], "WARNING")
        table("reference").update_item(
            Key={"type": "ISSUE", "id": issue["id"]},
            UpdateExpression="SET notifiedAt = :n",
            ConditionExpression="attribute_exists(#t)",
            ExpressionAttributeNames={"#t": "type"},
            ExpressionAttributeValues={":n": now})
        return True
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return True  # the issue was resolved meanwhile
        log.error("issue_notify_failed", issue=issue["id"], error=str(err))
    except Exception as err:
        log.error("issue_notify_failed", issue=issue["id"], error=str(err))
    return False


def run_config_health(now=None):
    """Returns {"opened": [...], "resolved": [...], "open": [...]} (lists of ISSUE ids)."""
    now = _iso(now)
    reference = table("reference")
    detected = _detect()
    existing = {
        item["id"]: item
        for item in _query_all(reference, KeyConditionExpression=Key("type").eq("ISSUE"),
                               ConsistentRead=True)
    }

    opened, resolved = [], []
    for issue_id, issue in sorted(detected.items()):
        if issue_id in existing:
            if "notifiedAt" not in existing[issue_id]:
                log.warn("issue_renotify", issue=issue_id)
                _notify(issue, now)
            continue
        try:
            reference.put_item(
                Item={"type": "ISSUE", "id": issue_id, "openedAt": now},
                ConditionExpression="attribute_not_exists(#t) AND attribute_not_exists(#i)",
                ExpressionAttributeNames={"#t": "type", "#i": "id"})
        except ClientError as err:
            if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
                continue  # created by a concurrent run: it sends the notification
            raise
        opened.append(issue_id)
        _notify(issue, now)

    for issue_id in sorted(set(existing) - set(detected)):
        reference.delete_item(Key={"type": "ISSUE", "id": issue_id})
        resolved.append(issue_id)

    result = {"opened": opened, "resolved": resolved, "open": sorted(detected)}
    log.info("config_health", opened=len(opened), resolved=len(resolved), open=len(detected))
    return result


def list_open_issues():
    """Open ISSUE items grouped like the AdminOverview schema (Query + BatchGetItem, no Scan).

    Reads the ISSUE items written by run_config_health, so the lists are as fresh as the last
    check; "since" is the detection time (openedAt). Names come from ETAB / DEPARTMENT items and
    the institution of a convention from its Conventions item.
    """
    reference = table("reference")
    by_kind = {}
    for kind in ISSUE_KINDS:
        by_kind[kind] = [
            (item["id"][len(kind) + 1:], item.get("openedAt"))
            for item in _query_all(
                reference, ConsistentRead=True,
                KeyConditionExpression=Key("type").eq("ISSUE") & Key("id").begins_with(f"{kind}#"))]

    etab_ids = [ref for ref, _ in by_kind[INSTITUTION_WITHOUT_RESPONSABLE]]
    dept_ids = [ref for ref, _ in by_kind[DEPARTMENT_WITHOUT_SPECIALTY]]
    names = {("ETAB", i["id"]): i.get("name", i["id"])
             for i in batch_get("reference", [{"type": "ETAB", "id": e} for e in etab_ids])}
    names.update({("DEPARTMENT", i["id"]): i.get("name", i["id"])
                  for i in batch_get("reference", [{"type": "DEPARTMENT", "id": d} for d in dept_ids])})
    conventions = {i["conventionId"]: i for i in batch_get(
        "conventions", [{"conventionId": c} for c, _ in by_kind[CONVENTION_WAITING_NO_RESPONSABLE]])}

    institutions = [{"id": ref, "name": names.get(("ETAB", ref), ref)}
                    for ref, _ in sorted(by_kind[INSTITUTION_WITHOUT_RESPONSABLE])]
    departments = [{"id": ref, "etab": ref.split("#", 1)[0],
                    "name": names.get(("DEPARTMENT", ref), ref)}
                   for ref, _ in sorted(by_kind[DEPARTMENT_WITHOUT_SPECIALTY])]
    waiting = [{"conventionId": ref, "etab": conventions[ref].get("etab", ""), "since": opened}
               for ref, opened in sorted(by_kind[CONVENTION_WAITING_NO_RESPONSABLE])
               if ref in conventions]  # a stale issue for a missing convention is dropped
    return {"institutionsWithoutResponsable": institutions,
            "departmentsWithoutSpecialty": departments,
            "conventionsWaitingForMissingResponsable": waiting}