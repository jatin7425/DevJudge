from urllib.parse import quote

import azure.functions as func

from src.auth.github import (
    GitHubOAuthError,
    build_authorization_url,
    exchange_code_for_access_token,
    fetch_github_user,
    generate_oauth_state,
)
from src.auth.session import create_session_cookie, read_session_cookie
from src.config.app import APP_INFO
from src.config.settings import (
    SESSION_COOKIE_NAME,
    STATE_COOKIE_NAME,
    STATE_COOKIE_PATH,
    STATE_MAX_AGE_SECONDS,
    get_frontend_url,
)
from src.shared.cookies import build_cookie, build_expired_cookie, parse_cookie_header
from src.shared.http import json_response, redirect_response

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="health", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def health(req: func.HttpRequest) -> func.HttpResponse:
    return json_response(
        {
            "name": APP_INFO["name"],
            "version": APP_INFO["version"],
            "status": "ok",
        }
    )


@app.route(route="auth/github/signin", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def github_signin(req: func.HttpRequest) -> func.HttpResponse:
    state = generate_oauth_state()
    state_cookie = build_cookie(
        STATE_COOKIE_NAME,
        state,
        path=STATE_COOKIE_PATH,
        max_age=STATE_MAX_AGE_SECONDS,
    )
    return redirect_response(build_authorization_url(req.url, state), cookie=state_cookie)


@app.route(route="auth/github/callback", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def github_callback(req: func.HttpRequest) -> func.HttpResponse:
    state = req.params.get("state", "")
    code = req.params.get("code", "")
    cookies = parse_cookie_header(req.headers.get("cookie"))
    stored_state = cookies.get(STATE_COOKIE_NAME, "")
    frontend_url = get_frontend_url()

    if not state or not code or state != stored_state:
        expired_state_cookie = build_expired_cookie(STATE_COOKIE_NAME, path=STATE_COOKIE_PATH)
        return redirect_response(f"{frontend_url}/?auth=error&reason=state", cookie=expired_state_cookie)

    try:
        access_token = exchange_code_for_access_token(req.url, code, state)
        user = fetch_github_user(access_token)
    except GitHubOAuthError:
        expired_state_cookie = build_expired_cookie(STATE_COOKIE_NAME, path=STATE_COOKIE_PATH)
        return redirect_response(f"{frontend_url}/?auth=error&reason=github", cookie=expired_state_cookie)

    session_cookie = create_session_cookie(access_token, user.username)
    success_url = f"{frontend_url}/?auth=success&username={quote(user.username)}"
    return redirect_response(success_url, cookie=session_cookie)


@app.route(route="auth/session", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def auth_session(req: func.HttpRequest) -> func.HttpResponse:
    cookies = parse_cookie_header(req.headers.get("cookie"))
    session_payload = read_session_cookie(cookies.get(SESSION_COOKIE_NAME))

    if session_payload is None:
        return json_response({"authenticated": False})

    return json_response(
        {
            "authenticated": True,
            "user": {
                "username": session_payload.username,
            },
        }
    )


@app.route(route="auth/logout", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def auth_logout(req: func.HttpRequest) -> func.HttpResponse:
    expired_session_cookie = build_expired_cookie(SESSION_COOKIE_NAME)
    return redirect_response(f"{get_frontend_url()}/", cookie=expired_session_cookie)
