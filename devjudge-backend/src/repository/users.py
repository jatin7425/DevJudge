from __future__ import annotations

from datetime import datetime, timezone
from typing import cast, Any

from db.connect import get_database_provider, get_postgres_connection, supabase_request
from db.models import UserDbModel
from db.schemas import DashboardStateSchema, UserUpsertSchema


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


def _build_user_model(row: dict[str, Any]) -> UserDbModel:
    return UserDbModel(
        id=int(cast(int, row["id"])),
        username=str(row["username"]),
        email=cast(str | None, row.get("email")) if isinstance(row.get("email"), str) else None,
        display_name=cast(str | None, row.get("display_name")) if isinstance(row.get("display_name"), str) else None,
        avatar_url=cast(str | None, row.get("avatar_url")) if isinstance(row.get("avatar_url"), str) else None,
        github_id=int(cast(int, row["github_id"])) if row.get("github_id") is not None else None,
        access_token=cast(str, row.get("access_token")),
        analysis_requested_at=_parse_timestamp(row.get("analysis_requested_at")),
        initial_data_collected_at=_parse_timestamp(row.get("initial_data_collected_at")),
    )


def _build_dashboard_state(user: UserDbModel) -> DashboardStateSchema:
    return DashboardStateSchema(
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        has_initial_data=user.initial_data_collected_at is not None,
        analysis_requested=user.analysis_requested_at is not None,
    )


class UsersRepository:
    table_name = "users"

    def check_connection(self) -> bool:
        if get_database_provider() == "supabase":
            supabase_request("GET", f"/{self.table_name}", query={"select": "id", "limit": "1"})
            return True

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1 AS ok")
                row = cast(dict[str, Any], cursor.fetchone())

        return bool(row) and row["ok"] == 1

    def upsert_user(self, payload: UserUpsertSchema) -> UserDbModel:
        if get_database_provider() == "supabase":
            response = cast(list[dict[str, Any]], supabase_request(
                "POST",
                f"/{self.table_name}",
                query={
                    "on_conflict": "username",
                    "select": "id,github_id,username,email,display_name,avatar_url,access_token,analysis_requested_at,initial_data_collected_at",
                },
                body=payload.model_dump(),
                prefer="resolution=merge-duplicates,return=representation",
            ))

            if not isinstance(response, list) or not response:
                raise RuntimeError("Failed to persist user through Supabase Data API.")

            return _build_user_model(response[0])

        query = """
            INSERT INTO users (
                github_id,
                username,
                email,
                display_name,
                avatar_url,
                access_token
            )
            VALUES (
                %(github_id)s,
                %(username)s,
                %(email)s,
                %(display_name)s,
                %(avatar_url)s,
                %(access_token)s
            )
            ON CONFLICT (username)
            DO UPDATE SET
                github_id = EXCLUDED.github_id,
                email = EXCLUDED.email,
                display_name = EXCLUDED.display_name,
                avatar_url = EXCLUDED.avatar_url,
                access_token = EXCLUDED.access_token,
                updated_at = NOW()
            RETURNING
                id,
                github_id,
                username,
                email,
                display_name,
                avatar_url,
                access_token,
                analysis_requested_at,
                initial_data_collected_at
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, payload.model_dump())
                row = cast(dict[str, Any], cursor.fetchone())
            connection.commit()

        if row is None:
            raise RuntimeError("Failed to persist user.")

        return _build_user_model(row)

    def get_dashboard_state(self, username: str) -> DashboardStateSchema | None:
        if get_database_provider() == "supabase":
            response = cast(list[dict[str, Any]], supabase_request(
                "GET",
                f"/{self.table_name}",
                query={
                    "username": f"eq.{username}",
                    "select": "id,github_id,username,email,display_name,avatar_url,access_token,analysis_requested_at,initial_data_collected_at",
                    "limit": "1",
                },
            ))

            if not isinstance(response, list) or not response:
                return None

            return _build_dashboard_state(_build_user_model(response[0]))

        query = """
            SELECT
                id,
                github_id,
                username,
                email,
                display_name,
                avatar_url,
                access_token,
                analysis_requested_at,
                initial_data_collected_at
            FROM users
            WHERE username = %(username)s
            LIMIT 1
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {"username": username})
                row = cast(dict[str, Any], cursor.fetchone())

        if row is None:
            return None

        return _build_dashboard_state(_build_user_model(row))

    def request_initial_analysis(self, username: str) -> DashboardStateSchema | None:
        requested_at = datetime.now(timezone.utc)

        if get_database_provider() == "supabase":
            response = cast(list[dict[str, Any]], supabase_request(
                "PATCH",
                f"/{self.table_name}",
                query={
                    "username": f"eq.{username}",
                    "select": "id,github_id,username,email,display_name,avatar_url,access_token,analysis_requested_at,initial_data_collected_at",
                },
                body={"analysis_requested_at": requested_at.isoformat()},
                prefer="return=representation",
            ))

            if not isinstance(response, list) or not response:
                return None

            return _build_dashboard_state(_build_user_model(response[0]))

        query = """
            UPDATE users
            SET
                analysis_requested_at = COALESCE(analysis_requested_at, %(requested_at)s),
                updated_at = NOW()
            WHERE username = %(username)s
            RETURNING
                id,
                github_id,
                username,
                email,
                display_name,
                avatar_url,
                access_token,
                analysis_requested_at,
                initial_data_collected_at
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    {
                        "username": username,
                        "requested_at": requested_at,
                    },
                )
                row = cast(dict[str, Any], cursor.fetchone())
            connection.commit()

        if row is None:
            return None

        return _build_dashboard_state(_build_user_model(row))
    
    def get_user_by_username(self, username: str) -> UserDbModel | None:
        if get_database_provider() == "supabase":
            response = cast(list[dict[str, Any]], supabase_request(
                "GET",
                f"/{self.table_name}",
                query={
                    "username": f"eq.{username}",
                    "select": "id,github_id,username,email,display_name,avatar_url,access_token,analysis_requested_at,initial_data_collected_at",
                    "limit": "1",
                },
            ))

            if not isinstance(response, list) or not response:
                return None

            return _build_user_model(response[0])

        query = """
            SELECT
                id,
                github_id,
                username,
                email,
                display_name,
                avatar_url,
                access_token,
                analysis_requested_at,
                initial_data_collected_at
            FROM users
            WHERE username = %(username)s
            LIMIT 1
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {"username": username})
                row = cast(dict[str, Any], cursor.fetchone())

        if row is None:
            return None

        return _build_user_model(row)

    def mark_initial_analysis_completed(self, username: str) -> None:
        completed_at = datetime.now(timezone.utc)

        if get_database_provider() == "supabase":
            supabase_request(
                "PATCH",
                f"/{self.table_name}",
                query={"username": f"eq.{username}"},
                body={
                    "analysis_requested_at": None,
                    "initial_data_collected_at": completed_at.isoformat(),
                },
            )
            return

        query = """
            UPDATE users
            SET
                analysis_requested_at = NULL,
                initial_data_collected_at = %(completed_at)s,
                updated_at = NOW()
            WHERE username = %(username)s
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    {
                        "username": username,
                        "completed_at": completed_at,
                    },
                )
            connection.commit()

    def mark_initial_analysis_failed(self, username: str) -> None:
        if get_database_provider() == "supabase":
            supabase_request(
                "PATCH",
                f"/{self.table_name}",
                query={"username": f"eq.{username}"},
                body={"analysis_requested_at": None},
            )
            return

        query = """
            UPDATE users
            SET
                analysis_requested_at = NULL,
                updated_at = NOW()
            WHERE username = %(username)s
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {"username": username})
            connection.commit()
