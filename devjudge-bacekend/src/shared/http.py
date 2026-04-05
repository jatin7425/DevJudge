import json

import azure.functions as func


def json_response(payload: dict, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        body=json.dumps(payload),
        status_code=status_code,
        mimetype="application/json",
    )


def redirect_response(
    location: str,
    *,
    cookie: str | None = None,
    status_code: int = 302,
) -> func.HttpResponse:
    headers = {"Location": location}

    if cookie:
        headers["Set-Cookie"] = cookie

    return func.HttpResponse(status_code=status_code, headers=headers)
