from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class UserUpsertSchema(BaseModel):
    github_id: int | None = None
    username: str
    email: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    access_token: str

    model_config = ConfigDict(str_strip_whitespace=True)


class DashboardStateSchema(BaseModel):
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
    has_initial_data: bool
    analysis_requested: bool

    model_config = ConfigDict(str_strip_whitespace=True)
