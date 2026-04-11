import logging

from repository.analysis_jobs import AnalysisJobsRepository
from shared.sse import publish_job_event

analysis_jobs_repository = AnalysisJobsRepository()


def send_log(
    job_id: str,
    message: str,
    *,
    progress: int | None = None,
    status: str | None = None,
) -> None:
    logging.info("[Event Logs] [job:%s] %s", job_id, message)
    event = publish_job_event(
        job_id,
        message=message,
        progress=progress,
        status=status,
    )
    try:
        analysis_jobs_repository.append_log_event(job_id, event)
    except Exception:
        logging.exception("Failed to persist log event for job %s", job_id)
