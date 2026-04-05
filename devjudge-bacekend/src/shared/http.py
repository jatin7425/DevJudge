import json

import azure.functions as func

from src.config.settings import get_frontend_url


def _build_headers(extra_headers: dict[str, str] | None = None) -> dict[str, str]:
    headers = {
        "Access-Control-Allow-Origin": get_frontend_url(),
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin",
    }

    if extra_headers:
        headers.update(extra_headers)

    return headers


def json_response(payload: dict, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        body=json.dumps(payload),
        status_code=status_code,
        mimetype="application/json",
        headers=_build_headers(),
    )


def redirect_response(
    location: str,
    *,
    cookie: str | None = None,
    status_code: int = 302,
) -> func.HttpResponse:
    headers = _build_headers({"Location": location})

    if cookie:
        headers["Set-Cookie"] = cookie

    return func.HttpResponse(status_code=status_code, headers=headers)
