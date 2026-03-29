import uuid

from fastapi import HTTPException


def parse_uuid(value: str) -> uuid.UUID:
    """Parse a UUID string and raise HTTP 400 if it is malformed."""
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid UUID: {value!r}")
