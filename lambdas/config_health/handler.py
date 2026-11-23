"""config_health Lambda: scheduled configuration check. No API route.

Triggers: EventBridge (once a day, see infra/deploy.py) and asynchronous invocation by the admin
Lambda after a change ({"source": "admin"}). It can also be run by hand:

    aws lambda invoke --function-name pfe-connect-config_health out.json
"""
from common.config_health import run_config_health
from common.log import get_logger


def _trigger(event):
    event = event if isinstance(event, dict) else {}
    if event.get("source") == "aws.events":
        return "schedule"
    return event.get("source") or "manual"


def handler(event, context):
    log = get_logger(getattr(context, "aws_request_id", "local"), function="config_health")
    trigger = _trigger(event)
    try:
        result = run_config_health()
    except Exception as exc:
        # Raised again so that Lambda marks the run as failed (an async invocation is retried;
        # the check is idempotent).
        log.error("config_health_failed", trigger=trigger, error=str(exc))
        raise
    log.info("config_health_done", trigger=trigger, opened=result["opened"],
             resolved=result["resolved"], openCount=len(result["open"]))
    return result
