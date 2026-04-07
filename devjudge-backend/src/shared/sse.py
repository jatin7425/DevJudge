from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
import json
import threading
from typing import Any

_EVENT_LIMIT_PER_JOB = 500
_EVENTS_BY_JOB: dict[str, list[dict[str, Any]]] = defaultdict(list)
_SEQUENCE_BY_JOB: dict[str, int] = defaultdict(int)
_LOCK = threading.Lock()


def publish_job_event(
    job_id: str,
    *,
    message: str,
    progress: int | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    safe_progress = _normalize_progress(progress)

    with _LOCK:
        _SEQUENCE_BY_JOB[job_id] += 1
        event_id = _SEQUENCE_BY_JOB[job_id]
        event = {
            "id": event_id,
            "job_id": job_id,
            "message": message,
            "progress": safe_progress,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        _EVENTS_BY_JOB[job_id].append(event)

        if len(_EVENTS_BY_JOB[job_id]) > _EVENT_LIMIT_PER_JOB:
            _EVENTS_BY_JOB[job_id] = _EVENTS_BY_JOB[job_id][-_EVENT_LIMIT_PER_JOB:]

    return event


def get_job_events_since(job_id: str, last_event_id: int) -> list[dict[str, Any]]:
    with _LOCK:
        events = list(_EVENTS_BY_JOB.get(job_id, []))
    return [event for event in events if int(event.get("id", 0)) > last_event_id]


def build_sse_payload(events: list[dict[str, Any]], *, retry_ms: int = 3000) -> str:
    lines = [f"retry: {retry_ms}", ""]

    if not events:
        # Keep EventSource happy even when there are no updates in this response.
        lines.extend([": keep-alive", ""])
        return "\n".join(lines)

    for event in events:
        lines.append(f"id: {event['id']}")
        lines.append("event: job-update")
        lines.append(f"data: {json.dumps(event)}")
        lines.append("")

    return "\n".join(lines)


def _normalize_progress(progress: int | None) -> int | None:
    if progress is None:
        return None

    try:
        value = int(progress)
    except (TypeError, ValueError):
        return None

    return max(0, min(100, value))
