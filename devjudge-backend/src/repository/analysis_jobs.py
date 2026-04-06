from __future__ import annotations

from datetime import datetime, timezone
from typing import cast, Any
import uuid

from db.connect import get_database_provider, get_postgres_connection, supabase_request
from db.models import AnalysisJobDbModel, JobStatus


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

        if get_database_provider() == "supabase":
            supabase_request(
                "PATCH",
                f"/{self.table_name}",
                query={"job_id": f"eq.{job_id}"},
                body=updates,
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
