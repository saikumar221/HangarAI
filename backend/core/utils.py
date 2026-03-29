import json
import uuid

from fastapi import HTTPException


def parse_uuid(value: str) -> uuid.UUID:
    """Parse a UUID string and raise HTTP 400 if it is malformed."""
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid UUID: {value!r}")


def _escape_control_chars_in_strings(s: str) -> str:
    """Escape literal control characters inside JSON string values.

    Gemini sometimes emits multi-paragraph text with raw newlines, which is
    invalid JSON even though it looks fine in a text editor.
    """
    result: list[str] = []
    in_string = False
    escaped = False
    for ch in s:
        if escaped:
            result.append(ch)
            escaped = False
        elif ch == "\\" and in_string:
            result.append(ch)
            escaped = True
        elif ch == '"':
            result.append(ch)
            in_string = not in_string
        elif in_string and ch == "\n":
            result.append("\\n")
        elif in_string and ch == "\r":
            result.append("\\r")
        elif in_string and ch == "\t":
            result.append("\\t")
        else:
            result.append(ch)
    return "".join(result)


def parse_json_response(raw: str) -> dict | list:
    """Parse a JSON response from an LLM, stripping markdown fences and
    escaping control characters that Gemini sometimes emits."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return json.loads(_escape_control_chars_in_strings(raw))
