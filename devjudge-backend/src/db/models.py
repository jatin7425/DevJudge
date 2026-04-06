from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from enum import Enum

class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass(frozen=True)
class UserDbModel:
    id: int
    username: str
    email: str | None
    display_name: str | None
    avatar_url: str | None
    access_token: str
    github_id: int | None = None
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

@dataclass(frozen=True)
class AnalysisJobDbModel:
    id: int
    job_id: str
    user_id: int
    status: JobStatus
    position: int | None = None
    created_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    meta: dict[str, Any] | None = None