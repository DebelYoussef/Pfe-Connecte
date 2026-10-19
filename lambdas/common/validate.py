"""Small input validation helpers. All raise BadRequest (400)."""
import unicodedata

from .errors import BadRequest


def require(body, *fields):
    missing = [f for f in fields if body.get(f) in (None, "")]
    if missing:
        raise BadRequest("Missing required fields", details={"missing": missing})


def as_str(body, field, min_len=1, max_len=2000, required=True):
    value = body.get(field)
    if value is None:
        if required:
            raise BadRequest(f"{field} is required", details={"field": field})
        return None
    if not isinstance(value, str) or not (min_len <= len(value.strip()) <= max_len):
        raise BadRequest(f"{field} must be a string of {min_len}-{max_len} characters",
                         details={"field": field})
    return value.strip()


def as_int(body, field, minimum=None, maximum=None, required=True):
    value = body.get(field)
    if value is None:
        if required:
            raise BadRequest(f"{field} is required", details={"field": field})
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise BadRequest(f"{field} must be an integer", details={"field": field})
    if (minimum is not None and value < minimum) or (maximum is not None and value > maximum):
        raise BadRequest(f"{field} out of range", details={"field": field})
    return value


def as_enum(value, field, allowed):
    if value not in allowed:
        raise BadRequest(f"{field} must be one of {list(allowed)}", details={"field": field})
    return value


def as_str_list(body, field, max_items=30, required=True):
    value = body.get(field)
    if value is None:
        if required:
            raise BadRequest(f"{field} is required", details={"field": field})
        return None
    if (not isinstance(value, list) or len(value) > max_items
            or not all(isinstance(v, str) and v.strip() for v in value)):
        raise BadRequest(f"{field} must be a list of non-empty strings",
                         details={"field": field})
    return [v.strip() for v in value]


def normalize(text):
    """Lowercase and strip accents (skills, keywords)."""
    decomposed = unicodedata.normalize("NFD", text.strip().lower())
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
