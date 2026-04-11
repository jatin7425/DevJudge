from __future__ import annotations

from datetime import datetime, timezone
from typing import cast, Any
import uuid

from db.connect import get_database_provider, get_postgres_connection, supabase_request
from db.models import AnalysisJobDbModel, JobStatus


def _coerce_meta(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _merge_meta(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    merged = dict(existing)

    for key, incoming_value in incoming.items():
        existing_value = merged.get(key)
        if isinstance(existing_value, dict) and isinstance(incoming_value, dict):
            merged[key] = _merge_meta(existing_value, incoming_value)
        else:
            merged[key] = incoming_value

    return merged


def _parse_timestamp(value: object) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value

    if isinstance(value, str):
        normalized_value = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized_value)
        except ValueError:
            return None

    return None


def _build_job_model(row: dict[str, Any]) -> AnalysisJobDbModel:
    return AnalysisJobDbModel(
        id=int(row["id"]),
        job_id=str(row["job_id"]),
        user_id=int(row["user_id"]),
        status=JobStatus(row["status"]),
        position=None,
        created_at=_parse_timestamp(row.get("created_at")),
        started_at=_parse_timestamp(row.get("started_at")),
        completed_at=_parse_timestamp(row.get("completed_at")),
        result=row.get("result"),
        error=row.get("error"),
        meta=row.get("meta"),
    )


class AnalysisJobsRepository:
    table_name = "analysis_jobs"

    def update_meta(self, job_id: str, meta: dict[str, Any]) -> None:
        current_job = self.get_job(job_id)
        existing_meta = _coerce_meta(current_job.meta if current_job else {})
        merged_meta = _merge_meta(existing_meta, meta)

        if get_database_provider() == "supabase":
            supabase_request(
                "PATCH",
                f"/{self.table_name}",
                query={"job_id": f"eq.{job_id}"},
                body={"meta": merged_meta},
            )
            return

        query = """
            UPDATE analysis_jobs
            SET meta = %(meta)s
            WHERE job_id = %(job_id)s
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {"job_id": job_id, "meta": merged_meta})
            connection.commit()

    def append_log_event(self, job_id: str, event: dict[str, Any], *, limit: int = 500) -> None:
        # Use a more robust update pattern to avoid race conditions during high-frequency logging
        current_job = self.get_job(job_id)
        if not current_job:
            return
            
        meta = _coerce_meta(current_job.meta)
        logs = meta.get("logs", [])
        if not isinstance(logs, list):
            logs = []
            
        # Ensure basic fields exist for frontend compatibility
        log_entry = {
            "id": event.get("id", len(logs) + 1),
            "job_id": job_id,
            "timestamp": event.get("timestamp", datetime.now(timezone.utc).isoformat()),
            **event
        }
        
        logs.append(log_entry)
        meta["logs"] = logs[-limit:]
        meta["last_log_at"] = log_entry["timestamp"]
        self.update_meta(job_id, meta)

    # Create Job
    def create_job(self, user_id: int) -> AnalysisJobDbModel:
        job_id = str(uuid.uuid4())

        if get_database_provider() == "supabase":
            response = cast(list[dict[str, Any]], supabase_request(
                "POST",
                f"/{self.table_name}",
                body={
                    "job_id": job_id,
                    "user_id": user_id,
                    "status": JobStatus.QUEUED.value,
                },
                query={"select": "*"},
                prefer="return=representation",
            ))

            if not response:
                raise RuntimeError("Failed to create job (supabase).")

            return _build_job_model(response[0])

        query = """
            INSERT INTO analysis_jobs (job_id, user_id, status)
            VALUES (%(job_id)s, %(user_id)s, %(status)s)
            RETURNING *
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {
                    "job_id": job_id,
                    "user_id": user_id,
                    "status": JobStatus.QUEUED.value,
                })
                row = cast(dict[str, Any], cursor.fetchone())
            connection.commit()

        if row is None:
            raise RuntimeError("Failed to create job.")

        return _build_job_model(row)

    # Get Job
    def get_job(self, job_id: str) -> AnalysisJobDbModel | None:
        if get_database_provider() == "supabase":
            response = cast(list[dict[str, Any]], supabase_request(
                "GET",
                f"/{self.table_name}",
                query={
                    "job_id": f"eq.{job_id}",
                    "select": "*",
                    "limit": "1",
                },
            ))

            if not response:
                return None

            return _build_job_model(response[0])

        query = "SELECT * FROM analysis_jobs WHERE job_id = %(job_id)s LIMIT 1"

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {"job_id": job_id})
                row = cast(dict[str, Any], cursor.fetchone())

        if row is None:
            return None

        return _build_job_model(row)

    # Update Status
    def update_status(
        self,
        job_id: str,
        status: JobStatus,
        result: dict | None = None,
        error: str | None = None,
        meta: dict | None = None,
    ) -> None:

        now = datetime.now(timezone.utc)

        updates: dict[str, Any] = {
            "status": status.value,
        }

        if status == JobStatus.RUNNING:
            updates["started_at"] = now

        if status in (JobStatus.COMPLETED, JobStatus.FAILED):
            updates["completed_at"] = now

        if result is not None:
            updates["result"] = result

        if error is not None:
            updates["error"] = error

        if meta is not None:
            current_job = self.get_job(job_id)
            existing_meta = _coerce_meta(current_job.meta if current_job else {})
            updates["meta"] = _merge_meta(existing_meta, meta)

        if get_database_provider() == "supabase":
            supabase_updates = {
                key: value.isoformat() if isinstance(value, datetime) else value
                for key, value in updates.items()
            }
            supabase_request(
                "PATCH",
                f"/{self.table_name}",
                query={"job_id": f"eq.{job_id}"},
                body=supabase_updates,
            )
            return

        set_clause = ", ".join(f"{k} = %({k})s" for k in updates.keys())

        query = f"""
            UPDATE analysis_jobs
            SET {set_clause}
            WHERE job_id = %(job_id)s
        """

        updates["job_id"] = job_id

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, updates)
            connection.commit()

    # Get Queue Position
    def get_queue_position(self, job_id: str) -> int | None:

        if get_database_provider() == "supabase":
            # fallback (less efficient)
            jobs = cast(list[dict[str, Any]], supabase_request(
                "GET",
                f"/{self.table_name}",
                query={
                    "status": "eq.queued",
                    "select": "job_id,created_at",
                    "order": "created_at.asc",
                },
            ))

            for i, job in enumerate(jobs, start=1):
                if job["job_id"] == job_id:
                    return i

            return None

        query = """
            SELECT COUNT(*) + 1 AS position
            FROM analysis_jobs
            WHERE status = 'queued'
            AND created_at < (
                SELECT created_at
                FROM analysis_jobs
                WHERE job_id = %(job_id)s
            )
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {"job_id": job_id})
                row = cast(dict[str, Any], cursor.fetchone())

        return int(row["position"]) if row else None
    
    def get_running_jobs_count(self) -> int:
        if get_database_provider() == "supabase":
            jobs = cast(list[dict[str, Any]], supabase_request(
                "GET",
                f"/{self.table_name}",
                query={
                    "status": "eq.running",
                    "select": "id",
                },
            ))
            return len(jobs)

        query = """
            SELECT COUNT(*) AS count
            FROM analysis_jobs
            WHERE status = 'running'
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                row = cursor.fetchone()

        return int(row["count"])

    def get_latest_active_job_for_user(self, user_id: int) -> AnalysisJobDbModel | None:
        if get_database_provider() == "supabase":
            response = cast(list[dict[str, Any]], supabase_request(
                "GET",
                f"/{self.table_name}",
                query={
                    "user_id": f"eq.{user_id}",
                    "status": "in.(queued,running)",
                    "order": "created_at.desc",
                    "select": "*",
                    "limit": "1",
                },
            ))

            if not response:
                return None

            return _build_job_model(response[0])

        query = """
            SELECT *
            FROM analysis_jobs
            WHERE user_id = %(user_id)s
            AND status IN ('queued', 'running')
            ORDER BY created_at DESC
            LIMIT 1
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {"user_id": user_id})
                row = cast(dict[str, Any], cursor.fetchone())

        if row is None:
            return None

        return _build_job_model(row)

    def get_latest_completed_job_for_user(self, user_id: int) -> AnalysisJobDbModel | None:
        if get_database_provider() == "supabase":
            response = cast(list[dict[str, Any]], supabase_request(
                "GET",
                f"/{self.table_name}",
                query={
                    "user_id": f"eq.{user_id}",
                    "status": "eq.completed",
                    "order": "completed_at.desc",
                    "select": "*",
                    "limit": "1",
                },
            ))

            if not response:
                return None

            return _build_job_model(response[0])

        query = """
            SELECT *
            FROM analysis_jobs
            WHERE user_id = %(user_id)s
            AND status = 'completed'
            ORDER BY completed_at DESC NULLS LAST, created_at DESC
            LIMIT 1
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {"user_id": user_id})
                row = cast(dict[str, Any], cursor.fetchone())

        if row is None:
            return None

        return _build_job_model(row)

    def list_active_jobs(self, *, limit: int = 50) -> list[AnalysisJobDbModel]:
        if get_database_provider() == "supabase":
            response = cast(list[dict[str, Any]], supabase_request(
                "GET",
                f"/{self.table_name}",
                query={
                    "status": "in.(queued,running)",
                    "order": "created_at.asc",
                    "select": "*",
                    "limit": str(limit),
                },
            ))
            return [_build_job_model(row) for row in response] if response else []

        query = """
            SELECT *
            FROM analysis_jobs
            WHERE status IN ('queued', 'running')
            ORDER BY created_at ASC
            LIMIT %(limit)s
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {"limit": limit})
                rows = cast(list[dict[str, Any]], cursor.fetchall())

        return [_build_job_model(row) for row in rows]

    def list_jobs_for_user(self, user_id: int, *, limit: int = 20) -> list[AnalysisJobDbModel]:
        if get_database_provider() == "supabase":
            response = cast(list[dict[str, Any]], supabase_request(
                "GET",
                f"/{self.table_name}",
                query={
                    "user_id": f"eq.{user_id}",
                    "order": "created_at.desc",
                    "select": "*",
                    "limit": str(limit),
                },
            ))
            return [_build_job_model(row) for row in response] if response else []

        query = """
            SELECT *
            FROM analysis_jobs
            WHERE user_id = %(user_id)s
            ORDER BY created_at DESC
            LIMIT %(limit)s
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {"user_id": user_id, "limit": limit})
                rows = cast(list[dict[str, Any]], cursor.fetchall())

        return [_build_job_model(row) for row in rows]

    def get_job_counts_for_user(self, user_id: int) -> dict[str, int]:
        if get_database_provider() == "supabase":
            rows = cast(list[dict[str, Any]], supabase_request(
                "GET",
                f"/{self.table_name}",
                query={
                    "user_id": f"eq.{user_id}",
                    "select": "status",
                },
            ))
            counts = {"total": 0, "queued": 0, "running": 0, "completed": 0, "failed": 0}
            for row in rows or []:
                status = str(row.get("status", ""))
                counts["total"] += 1
                if status in counts:
                    counts[status] += 1
            return counts

        query = """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'queued') AS queued,
                COUNT(*) FILTER (WHERE status = 'running') AS running,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed,
                COUNT(*) FILTER (WHERE status = 'failed') AS failed
            FROM analysis_jobs
            WHERE user_id = %(user_id)s
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {"user_id": user_id})
                row = cast(dict[str, Any], cursor.fetchone())

        return {
            "total": int(row.get("total", 0)),
            "queued": int(row.get("queued", 0)),
            "running": int(row.get("running", 0)),
            "completed": int(row.get("completed", 0)),
            "failed": int(row.get("failed", 0)),
        }
