from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import threading
from typing import Any, Callable

from db.models import JobStatus
from pipeline.analyse import AnalysisPipeline
from repository.analysis_jobs import AnalysisJobsRepository
from repository.users import UsersRepository
from shared.live_logs import send_log


analysis_jobs_repository = AnalysisJobsRepository()
users_repository = UsersRepository()


@dataclass(frozen=True)
class PipelineStep:
    key: str
    label: str
    progress: int
    method_name: str


PIPELINE_STEPS: list[PipelineStep] = [
    PipelineStep("user_data", "Analyzing User Data", 45, "_analyse_user_data"),
    PipelineStep("repos", "Fetching Repositories", 60, "_analyse_repos"),
    PipelineStep("languages", "Analyzing Languages", 72, "_analyse_languages"),
    PipelineStep("commit_activity", "Processing Commits", 82, "_analyse_commit_activity"),
    PipelineStep("events", "Analyzing Events", 89, "_analyse_events"),
    PipelineStep("issues", "Analyzing Pull Requests", 95, "_analyse_issues"),
    PipelineStep("insights", "Generating Report", 99, "_derive_insights"),
]


_THREADS_BY_JOB: dict[str, threading.Thread] = {}
_THREADS_LOCK = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _coerce_meta(raw: Any) -> dict[str, Any]:
    return raw if isinstance(raw, dict) else {}


def _coerce_steps(meta: dict[str, Any]) -> dict[str, Any]:
    steps = meta.get("steps")
    return steps if isinstance(steps, dict) else {}


def _persist_meta(
    job_id: str,
    job_status: JobStatus,
    meta: dict[str, Any],
    *,
    result: dict | None = None,
    error: str | None = None,
) -> None:
    analysis_jobs_repository.update_status(
        job_id,
        job_status,
        result=result,
        error=error,
        meta=meta,
    )


def _mark_step(
    job_id: str,
    meta: dict[str, Any],
    step: PipelineStep,
    status: str,
    *,
    error: str | None = None,
) -> None:
    steps = _coerce_steps(meta)
    current = steps.get(step.key)
    payload = current if isinstance(current, dict) else {}
    payload.update(
        {
            "key": step.key,
            "label": step.label,
            "status": status,
            "updated_at": _now_iso(),
        }
    )
    if status == "running":
        payload["started_at"] = _now_iso()
    if status == "success":
        payload["completed_at"] = _now_iso()
    if error:
        payload["error"] = error
    steps[step.key] = payload
    meta["steps"] = steps
    meta["current_step"] = step.key
    meta["updated_at"] = _now_iso()


def _execute_step(pipeline: AnalysisPipeline, step: PipelineStep) -> None:
    method = getattr(pipeline, step.method_name, None)
    if not callable(method):
        raise RuntimeError(f"Pipeline step method missing: {step.method_name}")
    casted = method  # type: Callable[[], None]
    casted()


def run_analysis_job(job_id: str, username: str) -> None:
    try:
        job = analysis_jobs_repository.get_job(job_id)
        if job is None:
            raise RuntimeError("Job not found")

        if job.status == JobStatus.COMPLETED:
            return

        meta = _coerce_meta(job.meta)
        steps_state = _coerce_steps(meta)

        user = users_repository.get_user_by_username(username)
        if user is None:
            raise RuntimeError("User not found")

        send_log(job_id, f"Worker started for {username}", progress=12, status="running")

        meta["job_status"] = JobStatus.RUNNING.value
        meta["started_at"] = meta.get("started_at") or _now_iso()
        _persist_meta(job_id, JobStatus.RUNNING, meta)

        pipeline = AnalysisPipeline(job_id, user)
        pipeline.insights = meta.get("insights_partial") if isinstance(meta.get("insights_partial"), dict) else {}

        send_log(job_id, "Pipeline execution started", progress=20, status="running")
        pipeline.repos = pipeline.git.repos()
        send_log(job_id, f"Found {len(pipeline.repos)} repositories.", progress=30, status="running")

        for step in PIPELINE_STEPS:
            status = steps_state.get(step.key, {}).get("status") if isinstance(steps_state.get(step.key), dict) else None
            if status == "success":
                continue

            _mark_step(job_id, meta, step, "running")
            _persist_meta(job_id, JobStatus.RUNNING, meta)
            send_log(job_id, f"Current Step: {step.label}", progress=step.progress, status="running")

            try:
                _execute_step(pipeline, step)
            except Exception as step_error:
                _mark_step(job_id, meta, step, "failed", error=str(step_error))
                meta["job_status"] = JobStatus.FAILED.value
                meta["last_error"] = str(step_error)
                meta["insights_partial"] = pipeline.insights
                _persist_meta(job_id, JobStatus.FAILED, meta, error=str(step_error))
                users_repository.mark_initial_analysis_failed(username)
                send_log(job_id, f"Step failed: {step.label}", progress=step.progress, status="failed")
                raise

            _mark_step(job_id, meta, step, "success")
            meta["insights_partial"] = pipeline.insights
            _persist_meta(job_id, JobStatus.RUNNING, meta)

        pipeline.git.clear()

        meta["job_status"] = JobStatus.COMPLETED.value
        meta["completed_at"] = _now_iso()
        meta["insights_partial"] = pipeline.insights
        _persist_meta(job_id, JobStatus.COMPLETED, meta, result=pipeline.insights)
        users_repository.mark_initial_analysis_completed(username)
        send_log(job_id, "Job completed successfully", progress=100, status="completed")

    except Exception as error:
        logging.exception("Worker failed")
        # Ensure the job is marked as failed in the database so the UI stops waiting
        analysis_jobs_repository.update_status(
            job_id,
            JobStatus.FAILED,
            error=str(error)
        )
        # Update user record to allow retries
        users_repository.mark_initial_analysis_failed(username)
        # Notify the live stream
        send_log(job_id, f"Job failed: {str(error)}", status="failed")
    finally:
        with _THREADS_LOCK:
            _THREADS_BY_JOB.pop(job_id, None)


def run_analysis_job_async(job_id: str, username: str) -> None:
    with _THREADS_LOCK:
        existing = _THREADS_BY_JOB.get(job_id)
        if existing and existing.is_alive():
            return

        thread = threading.Thread(
            target=run_analysis_job,
            args=(job_id, username),
            daemon=True,
            name=f"analysis-job-{job_id[:8]}",
        )
        _THREADS_BY_JOB[job_id] = thread
        thread.start()


def resume_active_jobs_inline() -> int:
    active_jobs = analysis_jobs_repository.list_active_jobs(limit=100)
    resumed = 0

    for job in active_jobs:
        if job.status not in (JobStatus.QUEUED, JobStatus.RUNNING):
            continue

        # Recover username from the owning user record.
        # We only have user_id on job table, so we search through users table by id via username lookup path.
        # Current repository has get_user_by_username only, so we query using Supabase/Postgres in-place below.
        username = _resolve_username_from_user_id(job.user_id)
        if not username:
            continue

        run_analysis_job_async(job.job_id, username)
        resumed += 1

    return resumed


def _resolve_username_from_user_id(user_id: int) -> str | None:
    # Keep this helper local to avoid widening repository interface for one startup path.
    from db.connect import get_database_provider, get_postgres_connection, supabase_request

    if get_database_provider() == "supabase":
        rows = supabase_request(
            "GET",
            "/users",
            query={"id": f"eq.{user_id}", "select": "username", "limit": "1"},
        )
        if isinstance(rows, list) and rows:
            value = rows[0].get("username")
            return str(value) if isinstance(value, str) else None
        return None

    query = "SELECT username FROM users WHERE id = %(id)s LIMIT 1"
    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, {"id": user_id})
            row = cursor.fetchone()
    if not row:
        return None
    value = row.get("username")
    return str(value) if isinstance(value, str) else None
