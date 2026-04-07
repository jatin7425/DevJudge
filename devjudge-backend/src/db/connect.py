from __future__ import annotations

from contextlib import contextmanager
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from config.settings import get_database_settings


def get_database_provider() -> str:
    return get_database_settings().provider


@contextmanager
def get_postgres_connection():
    settings = get_database_settings()

    if settings.provider != "postgres" or settings.postgres is None:
        raise RuntimeError("Postgres connection is not configured for the current environment.")

    import psycopg
    from psycopg.rows import dict_row

    connection = psycopg.connect(settings.postgres.url, row_factory=dict_row)  # type: ignore

    try:
        yield connection
    finally:
        connection.close()


def supabase_request(
    method: str,
    path: str,
    *,
    query: dict[str, str] | None = None,
    body: dict[str, Any] | None = None,
    prefer: str | None = None,
) -> Any:
    settings = get_database_settings()

    if settings.provider != "supabase" or settings.supabase is None:
        raise RuntimeError("Supabase Data API is not configured for the current environment.")

    url = f"{settings.supabase.url}/rest/v1{path}"

    if query:
        url = f"{url}?{urlencode(query)}"

    headers = {
        "apikey": settings.supabase.key,
        "Authorization": f"Bearer {settings.supabase.key}",
        "Accept": "application/json",
    }
    data = None

    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")

    if prefer:
        headers["Prefer"] = prefer

    request = Request(url, data=data, headers=headers, method=method)

    try:
        with urlopen(request, timeout=10) as response:
            payload = response.read().decode("utf-8")
            if not payload:
                return None
            return json.loads(payload)
    except HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Supabase Data API request failed with status {error.code}: {error_body}"
        ) from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Supabase Data API request failed: {error}") from error
