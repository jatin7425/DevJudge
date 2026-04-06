import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

from config.settings import get_session_settings
from shared.cookies import build_cookie


@dataclass(frozen=True)
class SessionPayload:
    access_token: str
    username: str
    issued_at: int


def _encode_bytes(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _decode_bytes(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _sign(value: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), value.encode("utf-8"), hashlib.sha256)
    return _encode_bytes(digest.digest())


def _serialize_payload(payload: SessionPayload) -> str:
    raw_payload = json.dumps(
        {
            "access_token": payload.access_token,
            "username": payload.username,
            "issued_at": payload.issued_at,
        },
        separators=(",", ":"),
    ).encode("utf-8")
    return _encode_bytes(raw_payload)


def _deserialize_payload(value: str) -> SessionPayload | None:
    try:
        raw_payload = _decode_bytes(value).decode("utf-8")
        payload = json.loads(raw_payload)
    except (ValueError, json.JSONDecodeError):
        return None

    access_token = payload.get("access_token")
    username = payload.get("username")
    issued_at = payload.get("issued_at")

    if not isinstance(access_token, str) or not isinstance(username, str) or not isinstance(issued_at, int):
        return None

    return SessionPayload(
        access_token=access_token,
        username=username,
        issued_at=issued_at,
    )


def create_session_cookie(access_token: str, username: str) -> str:
    settings = get_session_settings()
    payload = SessionPayload(
        access_token=access_token,
        username=username,
        issued_at=int(time.time()),
    )
    encoded_payload = _serialize_payload(payload)
    signature = _sign(encoded_payload, settings.secret)
    return build_cookie(
        settings.cookie_name,
        f"{encoded_payload}.{signature}",
        max_age=settings.max_age_seconds,
        same_site="None",
        secure=True,
    )


def read_session_cookie(cookie_value: str | None) -> SessionPayload | None:
    if not cookie_value or "." not in cookie_value:
        return None

    encoded_payload, signature = cookie_value.split(".", 1)
    settings = get_session_settings()
    expected_signature = _sign(encoded_payload, settings.secret)

    if not hmac.compare_digest(signature, expected_signature):
        return None

    return _deserialize_payload(encoded_payload)
