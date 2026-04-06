import json
import logging
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from urllib.parse import quote

import azure.functions as func

from auth.github import (
    GitHubOAuthError,
    build_authorization_url,
    exchange_code_for_access_token,
    fetch_github_user,
    generate_oauth_state,
)
from auth.session import create_session_cookie, read_session_cookie
from config.app import APP_INFO
from config.settings import (
    SESSION_COOKIE_NAME,
    STATE_COOKIE_NAME,
    STATE_COOKIE_PATH,
    STATE_MAX_AGE_SECONDS,
    get_database_settings,
    get_frontend_url,
)
from repository.users import UsersRepository
from repository.analysis_jobs import AnalysisJobsRepository, JobStatus
from shared.queue import get_analysis_queue
from shared.http import json_response, redirect_response
from db.schemas import UserUpsertSchema
from repository.users import UsersRepository
from shared.cookies import build_cookie, build_expired_cookie, parse_cookie_header
from shared.http import json_response, redirect_response

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
users_repository = UsersRepository()


def _get_authenticated_username(req: func.HttpRequest) -> str | None:
    cookies = parse_cookie_header(req.headers.get("cookie"))
    session_payload = read_session_cookie(cookies.get(SESSION_COOKIE_NAME))

    if session_payload is None:
        return None

    return session_payload.username


@app.route(route="health", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def health(req: func.HttpRequest) -> func.HttpResponse:
    database_status = "unconfigured"
    database_environment = None

    try:
        database_settings = get_database_settings()
        database_environment = database_settings.environment
        database_status = "connected" if users_repository.check_connection() else "disconnected"
    except RuntimeError:
        database_status = "unconfigured"
    except Exception:
        database_status = "error"

    return json_response(
        {
            "name": APP_INFO["name"],
            "version": APP_INFO["version"],
            "status": "ok",
            "database": {
                "environment": database_environment,
                "status": database_status,
            },
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
        users_repository.upsert_user(
            UserUpsertSchema(
                github_id=user.github_id,
                username=user.username,
                email=user.email,
                display_name=user.name,
                avatar_url=user.avatar_url,
                access_token=access_token,
            )
        )
    except GitHubOAuthError:
        logging.exception("GitHub OAuth callback failed during provider exchange or profile fetch.")
        expired_state_cookie = build_expired_cookie(STATE_COOKIE_NAME, path=STATE_COOKIE_PATH)
        return redirect_response(f"{frontend_url}/?auth=error&reason=github", cookie=expired_state_cookie)
    except Exception:
        logging.exception("GitHub OAuth callback failed while persisting the authenticated user.")
        expired_state_cookie = build_expired_cookie(STATE_COOKIE_NAME, path=STATE_COOKIE_PATH)
        return redirect_response(f"{frontend_url}/?auth=error&reason=database", cookie=expired_state_cookie)

    session_cookie = create_session_cookie(access_token, user.username)
    success_url = f"{frontend_url}/dashboard?auth=success&username={quote(user.username)}"
    return redirect_response(success_url, cookie=session_cookie)


@app.route(route="auth/session", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def auth_session(req: func.HttpRequest) -> func.HttpResponse:
    username = _get_authenticated_username(req)

    if username is None:
        return json_response({"authenticated": False}, status_code=401)

    return json_response(
        {
            "authenticated": True,
            "user": {
                "username": username,
            },
        }
    )


@app.route(route="dashboard", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def dashboard(req: func.HttpRequest) -> func.HttpResponse:
    username = _get_authenticated_username(req)

    if username is None:
        return json_response({"authenticated": False}, status_code=401)

    state = users_repository.get_dashboard_state(username)

    if state is None:
        return json_response({"authenticated": False}, status_code=404)

    return json_response(
        {
            "authenticated": True,
            "dashboard": {
                "username": state.username,
                "displayName": state.display_name,
                "avatarUrl": state.avatar_url,
                "hasInitialData": state.has_initial_data,
                "analysisRequested": state.analysis_requested,
            },
        }
    )


@app.route(route="dashboard/analysis/start", methods=[func.HttpMethod.POST], auth_level=func.AuthLevel.ANONYMOUS)
def start_dashboard_analysis(req: func.HttpRequest) -> func.HttpResponse:
    try:
        analysis_jobs_repository = AnalysisJobsRepository()
        queue = get_analysis_queue()
        username = _get_authenticated_username(req)
        if username is None:
            return json_response({"success": False, "message": "Unauthorized"}, status_code=401)

        user = users_repository.get_user_by_username(username)
        if user is None:
            return json_response({"success": False, "message": "User not found"}, status_code=404)

        # 1. Create job
        job = analysis_jobs_repository.create_job(user.id)

        # 2. Check running slots
        MAX_PARALLEL = 5  # later move to admin config

        running_count = analysis_jobs_repository.get_running_jobs_count()

        # 3. Decide execution
        if running_count < MAX_PARALLEL:
            status = "running"
        else:
            status = "queued"

        # update status if running
        if status == "running":
            analysis_jobs_repository.update_status(job.job_id, JobStatus.RUNNING)

        # 4. Push to Azure Queue
        queue.send_message(json.dumps({
            "job_id": job.job_id,
            "user_id": user.id,
            "username": user.username
        }))

        # 5. Get queue position (if queued)
        position = None
        if status == "queued":
            position = analysis_jobs_repository.get_queue_position(job.job_id)

        return json_response({
            "success": True,
            "message": "Analysis triggered successfully",
            "data": {
                "job_id": job.job_id,
                "status": status,
                "position": position
            }
        })

    except Exception as e:
        logging.exception("Failed to start dashboard analysis.")
        return json_response(
            {
                "success": False,
                "message": "Failed to start analysis.",
                "error": str(e),
            },
            status_code=500,
        )


@app.route(route="auth/logout", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def auth_logout(req: func.HttpRequest) -> func.HttpResponse:
    expired_session_cookie = build_expired_cookie(
        SESSION_COOKIE_NAME,
        same_site="None",
        secure=True,
    )
    return redirect_response(f"{get_frontend_url()}/", cookie=expired_session_cookie)
