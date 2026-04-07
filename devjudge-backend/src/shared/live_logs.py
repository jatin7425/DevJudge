import logging

from shared.sse import publish_job_event


def send_log(
    job_id: str,
    message: str,
    *,
    progress: int | None = None,
    status: str | None = None,
) -> None:
    logging.info("[Event Logs] [job:%s] %s", job_id, message)
    publish_job_event(
        job_id,
        message=message,
        progress=progress,
        status=status,
    )
