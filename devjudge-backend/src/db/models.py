from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class UserDbModel:
    id: int
    username: str
    email: str | None
    display_name: str | None
    avatar_url: str | None
    github_id: int | None = None
    access_token: str | None = None
    analysis_requested_at: datetime | None = None
    initial_data_collected_at: datetime | None = None


@dataclass(frozen=True)
class DbMigrationDbModel:
    id: int
    table_name: str
    migration_version: str
    migration_description: str | None
    migration_key: str
    migration_name: str
    applied_at: datetime
