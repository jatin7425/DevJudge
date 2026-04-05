from dataclasses import dataclass
import os

DEFAULT_FRONTEND_URL = os.getenv("DEVJUDGE_FRONTEND_URL", "http://localhost:3000")
DEFAULT_BASE_URL = os.getenv("DEVJUDGE_BASE_URL", "http://localhost:7071")
DEFAULT_SESSION_SECRET = os.getenv("DEVJUDGE_SESSION_SECRET", "devjudge-super-secret-key-2024")
DEFAULT_RUNTIME_ENV = os.getenv("DEVJUDGE_ENV", "supabase")
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


@dataclass(frozen=True)
class PostgresSettings:
    url: str


@dataclass(frozen=True)
class SupabaseSettings:
    url: str
    key: str


@dataclass(frozen=True)
class DatabaseSettings:
    environment: str
    provider: str
    postgres: PostgresSettings | None = None
    supabase: SupabaseSettings | None = None


def _get_required_setting(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_runtime_environment() -> str:
    return os.getenv("DEVJUDGE_ENV", DEFAULT_RUNTIME_ENV).strip().lower()


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


def get_database_settings() -> DatabaseSettings:
    runtime_environment = get_runtime_environment()

    if runtime_environment in {"production", "prod", "supabase", "cloud"}:
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise RuntimeError(
                "Missing Supabase Data API configuration. Set SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY."
            )

        return DatabaseSettings(
            environment=runtime_environment,
            provider="supabase",
            supabase=SupabaseSettings(
                url=supabase_url.rstrip("/"),
                key=supabase_key,
            ),
        )

    postgres_url = os.getenv("LOCAL_DATABASE_URL") or os.getenv("DATABASE_URL")

    if not postgres_url:
        raise RuntimeError(
            "Missing local database configuration. Set LOCAL_DATABASE_URL or DATABASE_URL."
        )

    return DatabaseSettings(
        environment=runtime_environment,
        provider="postgres",
        postgres=PostgresSettings(url=postgres_url),
    )
