from common.db import now_iso
from common.response import Router

router = Router()


@router.route("GET /v1/health", public=True)
def health(req):
    return {"status": "ok", "time": now_iso()}


handler = router.handle
