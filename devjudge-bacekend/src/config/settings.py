from dataclasses import dataclass
import os

DEFAULT_FRONTEND_URL = "http://localhost:3000"
DEFAULT_SESSION_SECRET = "devjudge-super-secret-key-2024"
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_SCOPE = "read:user user:email repo"
SESSION_COOKIE_NAME = "devjudge_session"
STATE_COOKIE_NAME = "devjudge_oauth_state"
STATE_COOKIE_PATH = "/api/auth"
STATE_MAX_AGE_SECONDS = 600
SESSION_MAX_AGE_SECONDS = 604800


@dataclass(frozen=True)
class GitHubSettings:
    client_id: str
    client_secret: str
    scope: str


@dataclass(frozen=True)
class SessionSettings:
    secret: str
    cookie_name: str
    max_age_seconds: int


def _get_required_setting(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_frontend_url() -> str:
    return os.getenv("DEVJUDGE_FRONTEND_URL", DEFAULT_FRONTEND_URL).rstrip("/")


def get_github_settings() -> GitHubSettings:
    return GitHubSettings(
        client_id=_get_required_setting("GITHUB_CLIENT_ID"),
        client_secret=_get_required_setting("GITHUB_CLIENT_SECRET"),
        scope=GITHUB_SCOPE,
    )


def get_session_settings() -> SessionSettings:
    return SessionSettings(
        secret=os.getenv("DEVJUDGE_SESSION_SECRET", DEFAULT_SESSION_SECRET),
        cookie_name=SESSION_COOKIE_NAME,
        max_age_seconds=SESSION_MAX_AGE_SECONDS,
    )
