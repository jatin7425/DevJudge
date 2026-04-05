from __future__ import annotations

from datetime import datetime

from src.db.connect import get_database_provider, get_postgres_connection, supabase_request
from src.db.models import DbMigrationDbModel


class DbMigrationRepository:
    table_name = "db_migration"

    def _parse_applied_at(self, value: object) -> datetime:
        if isinstance(value, datetime):
            return value

        if isinstance(value, str):
            normalized_value = value.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized_value)

        raise RuntimeError("Invalid applied_at value returned from the database.")

    def list_migrations(self) -> list[DbMigrationDbModel]:
        if get_database_provider() == "supabase":
            response = supabase_request(
                "GET",
                f"/{self.table_name}",
                query={
                    "select": "id,table_name,migration_version,migration_description,migration_key,migration_name,applied_at",
                    "order": "id.asc",
                },
            )

            if not isinstance(response, list):
                return []

            return [
                DbMigrationDbModel(
                    id=int(row["id"]),
                    table_name=str(row["table_name"]),
                    migration_version=str(row["migration_version"]),
                    migration_description=(
                        row.get("migration_description")
                        if isinstance(row.get("migration_description"), str)
                        else None
                    ),
                    migration_key=str(row["migration_key"]),
                    migration_name=str(row["migration_name"]),
                    applied_at=self._parse_applied_at(row["applied_at"]),
                )
                for row in response
            ]

        query = """
            SELECT
                id,
                table_name,
                migration_version,
                migration_description,
                migration_key,
                migration_name,
                applied_at
            FROM db_migration
            ORDER BY id ASC
        """

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()

        return [
            DbMigrationDbModel(
                id=row["id"],
                table_name=row["table_name"],
                migration_version=row["migration_version"],
                migration_description=row["migration_description"],
                migration_key=row["migration_key"],
                migration_name=row["migration_name"],
                applied_at=row["applied_at"],
            )
            for row in rows
        ]
