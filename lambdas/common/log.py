"""Structured JSON logs (one JSON object per line) so CloudWatch Logs Insights can query them."""
import json
import time


class Logger:
    def __init__(self, request_id="local", **base):
        self.base = {"requestId": request_id, **base}

    def _emit(self, level, message, **fields):
        print(json.dumps({"level": level, "message": message, "ts": time.time(),
                          **self.base, **fields}, default=str))

    def info(self, message, **fields):
        self._emit("INFO", message, **fields)

    def warn(self, message, **fields):
        self._emit("WARN", message, **fields)

    def error(self, message, **fields):
        self._emit("ERROR", message, **fields)


def get_logger(request_id="local", **base):
    return Logger(request_id, **base)
