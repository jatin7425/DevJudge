from typing import cast
from .api import github_api_client, hit_endpoint, clear_cache

class GitHubClient:
    def __init__(self, access_token: str) -> None:
        self._client = github_api_client(access_token)

    def user(self) -> dict:
        return cast(dict, hit_endpoint(self._client, "get_user"))

    def repos(self) -> list[dict]:
        return cast(list[dict], hit_endpoint(
            self._client, 
            "get_user_repos",
            per_page=100,
            sort="updated"
        ))

    def repo_languages(self, owner: str, repo: str) -> dict:
        return cast(dict, hit_endpoint(
            self._client,
            "get_repo_languages",
            owner=owner,
            repo=repo,
        ))

    def repo_commit_activity(self, owner: str, repo: str) -> list:
        return cast(list, hit_endpoint(
            self._client,
            "get_repo_commit_activity",
            owner=owner,
            repo=repo,
        ))

    def user_events(self, username: str) -> list:
        return cast(list, hit_endpoint(
            self._client,
            "get_user_events",
            username=username,
        ))

    def repo_readme(self, owner: str, repo: str) -> dict:
        return cast(dict, hit_endpoint(
            self._client,
            "get_repo_readme",
            owner=owner,
            repo=repo,
        ))

    def search_issues(self, query: str) -> dict:
        return cast(dict, hit_endpoint(
            self._client,
            "search_issues",
            q=query,
        ))

    def clear(self) -> None:
        clear_cache()