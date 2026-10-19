"""Exceptions mapped to HTTP status codes. Raise them anywhere; Router turns them into the error format."""


class ApiError(Exception):
    status = 500
    code = "INTERNAL_ERROR"

    def __init__(self, message="Internal error", code=None, details=None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        self.details = details or {}


class BadRequest(ApiError):
    status, code = 400, "BAD_REQUEST"


class Unauthorized(ApiError):
    status, code = 401, "UNAUTHORIZED"


class Forbidden(ApiError):
    status, code = 403, "FORBIDDEN"


class NotFound(ApiError):
    status, code = 404, "NOT_FOUND"


class Conflict(ApiError):
    status, code = 409, "CONFLICT"


class PayloadTooLarge(ApiError):
    status, code = 413, "PAYLOAD_TOO_LARGE"


class Unprocessable(ApiError):
    status, code = 422, "UNPROCESSABLE"


class TooManyRequests(ApiError):
    status, code = 429, "TOO_MANY_REQUESTS"
