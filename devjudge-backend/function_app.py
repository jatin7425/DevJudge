import json
import logging
import sys
import os
import threading
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
    should_run_worker_inline,
)
from repository.users import UsersRepository
from repository.analysis_jobs import AnalysisJobsRepository, JobStatus
from shared.queue import get_analysis_queue
from shared.live_logs import send_log
from shared.sse import build_sse_payload, get_job_events_since
from shared.job_runner import run_analysis_job, run_analysis_job_async, resume_active_jobs_inline
from shared.http import json_response, redirect_response
from db.schemas import UserUpsertSchema
from repository.users import UsersRepository
from shared.cookies import build_cookie, build_expired_cookie, parse_cookie_header
from shared.http import json_response, redirect_response

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
users_repository = UsersRepository()
_inline_recovery_started = False
_inline_recovery_lock = threading.Lock()


def _get_authenticated_username(req: func.HttpRequest) -> str | None:
    cookies = parse_cookie_header(req.headers.get("cookie"))
    session_payload = read_session_cookie(cookies.get(SESSION_COOKIE_NAME))

    if session_payload is None:
        return None

    return session_payload.username


def _ensure_inline_recovery_once() -> None:
    global _inline_recovery_started

    if _inline_recovery_started or not should_run_worker_inline():
        return

    with _inline_recovery_lock:
        if _inline_recovery_started:
            return
        resumed = resume_active_jobs_inline()
        logging.info("Inline worker recovery resumed %s active job(s).", resumed)
        _inline_recovery_started = True


def _serialize_job(job, *, include_result: bool = False, include_meta: bool = True) -> dict:
    meta = job.meta if isinstance(job.meta, dict) else {}
    data = {
        "job_id": job.job_id,
        "job_status": job.status.value,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "error": job.error,
        "meta": meta if include_meta else {},
        "steps": meta.get("steps", {}) if include_meta else {},
    }
    if include_result:
        data["result"] = job.result
    return data


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
    _ensure_inline_recovery_once()
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
        _ensure_inline_recovery_once()
        analysis_jobs_repository = AnalysisJobsRepository()
        username = _get_authenticated_username(req)
        if username is None:
            return json_response({"success": False, "message": "Unauthorized"}, status_code=401)

        user = users_repository.get_user_by_username(username)
        if user is None:
            return json_response({"success": False, "message": "User not found"}, status_code=404)

        users_repository.request_initial_analysis(username)

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

        inline_worker = should_run_worker_inline()
        if inline_worker:
            run_analysis_job_async(job.job_id, user.username)
        else:
            queue = get_analysis_queue()
            queue.send_message(json.dumps({
                "job_id": job.job_id,
                "user_id": user.id,
                "username": user.username
            }))

        # 5. Get queue position (if queued)
        position = None
        if status == "queued":
            position = analysis_jobs_repository.get_queue_position(job.job_id)

        start_progress = 5 if status == "queued" else 10
        send_log(
            job.job_id,
            f"Analysis request accepted ({status}).",
            progress=start_progress,
            status=status,
        )

        return json_response({
            "success": True,
            "message": "Analysis triggered successfully",
            "data": {
                "job_id": job.job_id,
                "status": status,
                "position": position,
                "stream_url": f"/api/dashboard/analysis/stream?job_id={job.job_id}",
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


@app.route(route="dashboard/analysis/active", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def get_active_dashboard_analysis(req: func.HttpRequest) -> func.HttpResponse:
    _ensure_inline_recovery_once()
    username = _get_authenticated_username(req)
    if username is None:
        return json_response({"success": False, "message": "Unauthorized"}, status_code=401)

    user = users_repository.get_user_by_username(username)
    if user is None:
        return json_response({"success": False, "message": "User not found"}, status_code=404)

    analysis_jobs_repository = AnalysisJobsRepository()
    job = analysis_jobs_repository.get_latest_active_job_for_user(user.id)

    if job is None:
        return json_response(
            {
                "success": True,
                "message": "No active analysis job.",
                "data": None,
            }
        )

    queue_position = (
        analysis_jobs_repository.get_queue_position(job.job_id)
        if job.status == JobStatus.QUEUED else None
    )

    return json_response(
        {
            "success": True,
            "message": "Active analysis job found.",
            "data": {
                "job_id": job.job_id,
                "status": job.status.value,
                "job_status": job.status.value,
                "position": queue_position,
                "stream_url": f"/api/dashboard/analysis/stream?job_id={job.job_id}",
                "meta": job.meta if isinstance(job.meta, dict) else {},
                "steps": (job.meta or {}).get("steps", {}) if isinstance(job.meta, dict) else {},
            },
        }
    )


@app.route(route="dashboard/analysis/jobs", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def list_dashboard_analysis_jobs(req: func.HttpRequest) -> func.HttpResponse:
    _ensure_inline_recovery_once()
    username = _get_authenticated_username(req)
    if username is None:
        return json_response({"success": False, "message": "Unauthorized"}, status_code=401)

    user = users_repository.get_user_by_username(username)
    if user is None:
        return json_response({"success": False, "message": "User not found"}, status_code=404)

    limit_raw = req.params.get("limit", "20")
    try:
        limit = max(1, min(100, int(limit_raw)))
    except ValueError:
        limit = 20

    repository = AnalysisJobsRepository()
    jobs = repository.list_jobs_for_user(user.id, limit=limit)
    return json_response(
        {
            "success": True,
            "data": {
                "jobs": [_serialize_job(job, include_result=False, include_meta=False) for job in jobs],
            },
        }
    )


@app.route(route="dashboard/analysis/stats", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def get_dashboard_analysis_stats(req: func.HttpRequest) -> func.HttpResponse:
    _ensure_inline_recovery_once()
    username = _get_authenticated_username(req)
    if username is None:
        return json_response({"success": False, "message": "Unauthorized"}, status_code=401)

    user = users_repository.get_user_by_username(username)
    if user is None:
        return json_response({"success": False, "message": "User not found"}, status_code=404)

    repository = AnalysisJobsRepository()
    counts = repository.get_job_counts_for_user(user.id)
    return json_response(
        {
            "success": True,
            "data": counts,
        }
    )


@app.route(route="dashboard/analysis/latest-success", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def get_latest_successful_analysis(req: func.HttpRequest) -> func.HttpResponse:
    _ensure_inline_recovery_once()
    username = _get_authenticated_username(req)
    if username is None:
        return json_response({"success": False, "message": "Unauthorized"}, status_code=401)

    user = users_repository.get_user_by_username(username)
    if user is None:
        return json_response({"success": False, "message": "User not found"}, status_code=404)

    repository = AnalysisJobsRepository()
    job = repository.get_latest_completed_job_for_user(user.id)
    if job is None:
        return json_response({"success": True, "data": None})

    return json_response(
        {
            "success": True,
            "data": _serialize_job(job, include_result=True),
        }
    )


@app.route(route="dashboard/analysis/job", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def get_dashboard_analysis_job(req: func.HttpRequest) -> func.HttpResponse:
    _ensure_inline_recovery_once()
    username = _get_authenticated_username(req)
    if username is None:
        return json_response({"success": False, "message": "Unauthorized"}, status_code=401)

    job_id = (req.params.get("job_id") or "").strip()
    if not job_id:
        return json_response({"success": False, "message": "Missing required query param: job_id"}, status_code=400)

    user = users_repository.get_user_by_username(username)
    if user is None:
        return json_response({"success": False, "message": "User not found"}, status_code=404)

    repository = AnalysisJobsRepository()
    job = repository.get_job(job_id)
    if job is None or job.user_id != user.id:
        return json_response({"success": False, "message": "Job not found"}, status_code=404)

    return json_response(
        {
            "success": True,
            "data": _serialize_job(job, include_result=True, include_meta=True),
        }
    )


@app.route(route="dashboard/analysis/stream", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def stream_dashboard_analysis(req: func.HttpRequest) -> func.HttpResponse:
    _ensure_inline_recovery_once()
    username = _get_authenticated_username(req)
    if username is None:
        return json_response({"success": False, "message": "Unauthorized"}, status_code=401)

    job_id = (req.params.get("job_id") or "").strip()
    if not job_id:
        return json_response(
            {"success": False, "message": "Missing required query param: job_id"},
            status_code=400,
        )

    user = users_repository.get_user_by_username(username)
    if user is None:
        return json_response({"success": False, "message": "User not found"}, status_code=404)

    analysis_jobs_repository = AnalysisJobsRepository()
    job = analysis_jobs_repository.get_job(job_id)
    if job is None or job.user_id != user.id:
        return json_response({"success": False, "message": "Job not found"}, status_code=404)

    last_event_id_raw = (req.headers.get("Last-Event-ID") or req.params.get("last_event_id") or "0").strip()
    try:
        last_event_id = int(last_event_id_raw)
    except ValueError:
        last_event_id = 0

    events = get_job_events_since(job_id, last_event_id)
    payload = build_sse_payload(events)

    return func.HttpResponse(
        body=payload,
        status_code=200,
        mimetype="text/event-stream",
        headers={
            "Access-Control-Allow-Origin": get_frontend_url(),
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Vary": "Origin",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.route(route="auth/logout", methods=[func.HttpMethod.GET], auth_level=func.AuthLevel.ANONYMOUS)
def auth_logout(req: func.HttpRequest) -> func.HttpResponse:
    expired_session_cookie = build_expired_cookie(
        SESSION_COOKIE_NAME,
        same_site="None",
        secure=True,
    )
    return redirect_response(f"{get_frontend_url()}/", cookie=expired_session_cookie)


@app.queue_trigger(
    arg_name="msg",
    queue_name="analysis-queue",
    connection="AzureWebJobsStorage",
)
def run_analysis_worker(msg: func.QueueMessage) -> None:
    data = json.loads(msg.get_body().decode())
    run_analysis_job(data["job_id"], data["username"])
