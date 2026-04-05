import json
import secrets
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from src.config.settings import (
    GITHUB_AUTHORIZE_URL,
    GITHUB_TOKEN_URL,
    GITHUB_USER_URL,
    get_github_settings,
)


class GitHubOAuthError(RuntimeError):
    pass


@dataclass(frozen=True)
class GitHubUser:
    github_id: int | None
    username: str
    name: str | None
    email: str | None
    avatar_url: str | None


def generate_oauth_state() -> str:
    return secrets.token_urlsafe(32)


def build_callback_url(request_url: str) -> str:
    parsed_url = urlsplit(request_url)
    return urlunsplit(
        (parsed_url.scheme, parsed_url.netloc, "/api/auth/github/callback", "", "")
    )


def build_authorization_url(request_url: str, state: str) -> str:
    settings = get_github_settings()
    query = urlencode(
        {
            "client_id": settings.client_id,
            "redirect_uri": build_callback_url(request_url),
            "scope": settings.scope,
            "state": state,
        }
    )
    return f"{GITHUB_AUTHORIZE_URL}?{query}"


def _load_json_response(request: Request) -> dict:
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise GitHubOAuthError("GitHub request failed") from error


def exchange_code_for_access_token(request_url: str, code: str, state: str) -> str:
    settings = get_github_settings()
    payload = urlencode(
        {
            "client_id": settings.client_id,
            "client_secret": settings.client_secret,
            "code": code,
            "redirect_uri": build_callback_url(request_url),
            "state": state,
        }
    ).encode("utf-8")
    request = Request(
        GITHUB_TOKEN_URL,
        data=payload,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "DevJudge",
        },
        method="POST",
    )
    response = _load_json_response(request)
    access_token = response.get("access_token")

    if not isinstance(access_token, str) or not access_token:
        raise GitHubOAuthError("GitHub token response was missing access_token")

    return access_token


def fetch_github_user(access_token: str) -> GitHubUser:
    request = Request(
        GITHUB_USER_URL,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "DevJudge",
        },
        method="GET",
    )
    response = _load_json_response(request)
    username = response.get("login")

    if not isinstance(username, str) or not username:
        raise GitHubOAuthError("GitHub user response was missing login")

    github_id = response.get("id")
    name = response.get("name")
    email = response.get("email")
    avatar_url = response.get("avatar_url")

    return GitHubUser(
        github_id=github_id if isinstance(github_id, int) else None,
        username=username,
        name=name if isinstance(name, str) else None,
        email=email if isinstance(email, str) else None,
        avatar_url=avatar_url if isinstance(avatar_url, str) else None,
    )
