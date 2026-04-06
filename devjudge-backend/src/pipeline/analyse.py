from time import sleep

from github.client import GitHubClient
from repository.users import UserDbModel
from datetime import datetime, timezone
from collections import defaultdict
from shared.live_logs import send_log


class AnalysisPipeline:
    def __init__(self, job_id: str, user: UserDbModel) -> None:
        self.job_id: str = job_id
        self.user: UserDbModel = user
        self.insights: dict = {}
        self.git = GitHubClient(self.user.access_token)
        self.repos = None
    
    
    def pipeline_log_message(self, message: str) -> str:
        send_log(self.job_id, message)
        return message

    def _repo_owner(self, repo: dict) -> str:
        owner = repo.get("owner", {})
        return owner.get("login") or self.user.username

    def _repo_name(self, repo: dict) -> str:
        name = repo.get("name")
        if not isinstance(name, str) or not name:
            raise RuntimeError(f"Repository name missing for repo payload: {repo}")
        return name

    def _raise_repo_error(self, step: str, repo: dict, error: Exception) -> None:
        repo_name = repo.get("full_name") or repo.get("name") or "unknown repo"
        raise RuntimeError(f"{step} failed for {repo_name}: {error}") from error

    def trigger(self) -> None | dict:
        try:
            self.pipeline_log_message("Pipeline started...")
            self.repos = self.git.repos()
            self.pipeline_log_message(f"Found {len(self.repos)} repositories.")

            self.pipeline_log_message("Beginning analysis steps...")
            self._analyse_user_data()
            self.pipeline_log_message("User data analysis completed.")
            sleep(1)  # brief pause for log clarity
            self.pipeline_log_message("Analyzing repositories...")
            self._analyse_repos()
            self.pipeline_log_message("Repository analysis completed.")
            sleep(1)
            self.pipeline_log_message("Analyzing languages...")
            self._analyse_languages()
            self.pipeline_log_message("Language analysis completed.")
            sleep(1)
            self.pipeline_log_message("Analyzing commit activity...")
            self._analyse_commit_activity()
            self.pipeline_log_message("Commit activity analysis completed.")
            sleep(1)
            self.pipeline_log_message("Analyzing events...")
            self._analyse_events()
            self.pipeline_log_message("Event analysis completed.")
            sleep(1)
            self.pipeline_log_message("Analyzing issues/PRs...")
            self._analyse_issues()
            self.pipeline_log_message("Issues/PRs analysis completed.")
            sleep(1)
            self.pipeline_log_message("Deriving insights...")
            self._derive_insights()
            self.pipeline_log_message("Insights derived.")
            sleep(1)
            self.pipeline_log_message("Clearing GitHub client...")
            self.git.clear()
            self.pipeline_log_message("Pipeline completed successfully.")
            return self.insights
        except Exception as e:
            print(f"Error during analysis pipeline: {e}")
            raise e

    # ─── User Data ────────────────────────────────────────────────────────────

    def _analyse_user_data(self) -> None:
        try:
            self.pipeline_log_message("Analyzing user data...")
            user_data = self.git.user()
            self.pipeline_log_message(f"Retrieved user data for {user_data.get('login')}")

            profile_fields = {
                "has_avatar": bool(user_data.get("avatar_url")),
                "has_bio": bool(user_data.get("bio")),
                "has_location": bool(user_data.get("location")),
                "has_blog": bool(user_data.get("blog")),
                "has_name": bool(user_data.get("name")),
            }
            completed_fields = sum(profile_fields.values())
            self.pipeline_log_message(f"Profile completeness: {completed_fields}/{len(profile_fields)}")

            created_at = user_data.get("created_at", "")
            account_age_days = 0
            if created_at:
                created_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                account_age_days = (datetime.now(timezone.utc) - created_date).days

            experience_level, experience_description = self._get_experience_level(
                account_age_days,
                user_data.get("public_repos", 0),
                user_data.get("followers", 0),
            )
            self.pipeline_log_message(f"User experience: {experience_description}")

            self.insights["profile"] = {
                **profile_fields,
                "stats": {
                    "completed_fields": completed_fields,
                    "total_fields": len(profile_fields),
                    "public_repos": user_data.get("public_repos", 0),
                    "followers": user_data.get("followers", 0),
                    "account_age_days": account_age_days,
                    "user_experience_level": experience_level,
                    "user_experience_description": experience_description,
                },
            }
            self.pipeline_log_message("User data analysis completed.")
        except Exception as e:
            print(f"Error analyzing user data: {e}")
            raise e

    def _get_experience_level(
        self,
        account_age_days: int,
        public_repos: int,
        followers: int,
    ) -> tuple[str, str]:
        self.pipeline_log_message("Determining user experience level...")
        if account_age_days > 1825 and public_repos > 20 and followers > 50:
            return "Senior", "5+ years of active development"
        elif account_age_days > 730 and public_repos > 10:
            return "Mid-level", "2-5 years of development experience"
        elif account_age_days > 365 and public_repos > 5:
            return "Junior", "1-2 years of development experience"
        return "Beginner", "Less than 1 year of experience"

    # ─── Repos ────────────────────────────────────────────────────────────────

    def _analyse_repos(self) -> None:
        assert self.repos is not None
        try:
            self.pipeline_log_message("Analyzing repositories...")

            total_stars = 0
            total_forks = 0
            repos_with_description = 0
            forked_repos = 0
            readme_count = 0

            for idx, repo in enumerate(self.repos, start=1):
                name = self._repo_name(repo)
                owner = self._repo_owner(repo)

                self.pipeline_log_message(f"[{idx}/{len(self.repos)}] Processing {owner}/{name}")

                total_stars += repo.get("stargazers_count", 0)
                total_forks += repo.get("forks_count", 0)

                if repo.get("description"):
                    repos_with_description += 1

                if repo.get("fork"):
                    forked_repos += 1
                    self.pipeline_log_message(f"Skipping fork: {owner}/{name}")
                    continue

                try:
                    readme = self.git.repo_readme(owner=owner, repo=name)

                    if readme:
                        readme_count += 1
                        self.pipeline_log_message(f"README found: {owner}/{name}")
                    else:
                        self.pipeline_log_message(f"No README: {owner}/{name}")

                except Exception as e:
                    if "404" in str(e):
                        self.pipeline_log_message(f"No README (404): {owner}/{name}")
                        continue

                    self.pipeline_log_message(f"README error for {owner}/{name}: {e}")
                    continue

            original_repos = len(self.repos) - forked_repos

            self.pipeline_log_message(
                f"Repository summary: stars={total_stars}, forks={total_forks}, readmes={readme_count}"
            )

            self.insights["repos"] = {
                "total_repos": len(self.repos),
                "original_repos": original_repos,
                "forked_repos": forked_repos,
                "total_stars": total_stars,
                "total_forks": total_forks,
                "repos_with_description": repos_with_description,
                "repos_with_readme": readme_count,
            }

        except Exception as e:
            self.pipeline_log_message(f"Fatal error in repository analysis: {e}")
            raise e
    # ─── Languages ────────────────────────────────────────────────────────────

    def _analyse_languages(self) -> None:
        assert self.repos is not None
        try:
            self.pipeline_log_message("Analyzing languages...")
            language_bytes: dict[str, int] = defaultdict(int)

            for repo in self.repos:
                if repo.get("fork"):
                    continue
                try:
                    langs = self.git.repo_languages(
                        owner=self._repo_owner(repo),
                        repo=self._repo_name(repo),
                    )
                    for lang, byte_count in langs.items():
                        language_bytes[lang] += byte_count
                except Exception as e:
                    self._raise_repo_error("Language analysis", repo, e)

            total_bytes = sum(language_bytes.values()) or 1
            language_percentages = {
                lang: round((b / total_bytes) * 100, 2)
                for lang, b in sorted(language_bytes.items(), key=lambda x: -x[1])
            }
            primary_language = max(language_bytes, key=lambda k: language_bytes[k]) if language_bytes else None

            self.pipeline_log_message(f"Found {len(language_bytes)} unique languages. Primary: {primary_language}")

            self.insights["languages"] = {
                "unique_languages": len(language_bytes),
                "primary_language": primary_language,
                "language_percentages": language_percentages,
            }
            self.pipeline_log_message("Language analysis completed.")
        except Exception as e:
            print(f"Error analyzing languages: {e}")
            raise e

    # ─── Commit Activity ──────────────────────────────────────────────────────

    def _analyse_commit_activity(self) -> None:
        assert self.repos is not None
        try:
            self.pipeline_log_message("Analyzing commit activity...")

            total_commits = 0
            active_repos = 0

            for idx, repo in enumerate(self.repos, start=1):
                if repo.get("fork"):
                    continue

                owner = self._repo_owner(repo)
                name = self._repo_name(repo)

                self.pipeline_log_message(f"[{idx}/{len(self.repos)}] Fetching commit data for {owner}/{name}")

                try:
                    activity = self.git.repo_commit_activity(owner=owner, repo=name)

                    if not activity or not isinstance(activity, list):
                        self.pipeline_log_message(f"No commit data available for {owner}/{name}")
                        continue

                    repo_commit_count = sum(week.get("total", 0) for week in activity)

                    if repo_commit_count > 0:
                        active_repos += 1

                    total_commits += repo_commit_count

                    self.pipeline_log_message(f"{owner}/{name} commits: {repo_commit_count}")

                except Exception as e:
                    self.pipeline_log_message(f"Commit analysis failed for {owner}/{name}: {e}")
                    continue

            avg_commits = round(total_commits / max(active_repos, 1), 2)

            self.pipeline_log_message(
                f"Commit summary: total={total_commits}, active_repos={active_repos}, avg_per_repo={avg_commits}"
            )

            self.insights["commit_activity"] = {
                "total_commits": total_commits,
                "active_repos": active_repos,
                "avg_commits_per_repo": avg_commits,
            }

        except Exception as e:
            self.pipeline_log_message(f"Fatal error in commit analysis: {e}")
            raise e
        
    # ─── Events / Streak ──────────────────────────────────────────────────────

    def _analyse_events(self) -> None:
        try:
            self.pipeline_log_message("Analyzing user events for contribution streak...")
            events = self.git.user_events(username=self.user.username)

            push_dates: set[str] = set()
            for event in events:
                if event.get("type") == "PushEvent":
                    created_at = event.get("created_at", "")
                    if created_at:
                        day = created_at[:10]  # "YYYY-MM-DD"
                        push_dates.add(day)

            sorted_dates = sorted(push_dates, reverse=True)

            current_streak = 0
            longest_streak = 0
            streak = 0
            prev_date = None

            for date_str in sorted_dates:
                date = datetime.strptime(date_str, "%Y-%m-%d").date()
                if prev_date is None:
                    streak = 1
                elif (prev_date - date).days == 1:
                    streak += 1
                else:
                    longest_streak = max(longest_streak, streak)
                    streak = 1
                prev_date = date

            longest_streak = max(longest_streak, streak)
            current_streak = streak if sorted_dates else 0

            self.pipeline_log_message(f"Current streak: {current_streak} days, Longest: {longest_streak} days")

            self.insights["events"] = {
                "current_streak_days": current_streak,
                "longest_streak_days": longest_streak,
                "total_active_days": len(push_dates),
            }
            self.pipeline_log_message("Event analysis completed.")
        except Exception as e:
            print(f"Error analyzing user events: {e}")
            raise e

    # ─── Issues / PRs ─────────────────────────────────────────────────────────

    def _analyse_issues(self) -> None:
        assert self.repos is not None
        try:
            self.pipeline_log_message("Analyzing open source contributions (PRs)...")
            result = self.git.search_issues(
                query=f"author:{self.user.username} type:pr is:merged"
            )
            all_prs = result.get("items", [])

            own_repo_names = {repo["full_name"] for repo in self.repos}

            external_prs = [
                pr for pr in all_prs
                if pr.get("repository_url", "").replace("https://api.github.com/repos/", "") not in own_repo_names
            ]

            self.pipeline_log_message(
                f"Total merged PRs: {len(all_prs)}, External (open source): {len(external_prs)}"
            )

            self.insights["contributions"] = {
                "total_merged_prs": len(all_prs),
                "external_merged_prs": len(external_prs),
            }
            self.pipeline_log_message("PR/contribution analysis completed.")
        except Exception as e:
            print(f"Error analyzing issues: {e}")
            raise e

    # ─── Derive Final Insights ────────────────────────────────────────────────

    def _derive_insights(self) -> None:
        try:
            self.pipeline_log_message("Deriving final insights and score...")

            profile = self.insights.get("profile", {})
            repos = self.insights.get("repos", {})
            languages = self.insights.get("languages", {})
            commit_activity = self.insights.get("commit_activity", {})
            events = self.insights.get("events", {})
            contributions = self.insights.get("contributions", {})

            # ── Profile Completeness (5 pts) ──
            completed = profile.get("stats", {}).get("completed_fields", 0)
            total_fields = profile.get("stats", {}).get("total_fields", 5)
            profile_score = round((completed / total_fields) * 5)

            # ── Repo Quality (20 pts) ──
            original_repos = repos.get("original_repos", 0)
            readme_ratio = repos.get("repos_with_readme", 0) / max(original_repos, 1)
            stars = min(repos.get("total_stars", 0), 50)  # cap at 50
            repo_score = round((readme_ratio * 10) + (stars / 50 * 10))
            repo_score = min(repo_score, 20)

            # ── Language Diversity (15 pts) ──
            unique_langs = languages.get("unique_languages", 0)
            lang_score = min(unique_langs * 2, 15)  # 2 pts per language, max 15

            # ── Commit Frequency & Consistency (25 pts) ──
            avg_commits = commit_activity.get("avg_commits_per_week", 0)
            consistent_weeks = commit_activity.get("consistent_weeks_last_12", 0)
            frequency_score = min(avg_commits * 2, 12)       # max 12
            consistency_score = round((consistent_weeks / 12) * 13)  # max 13
            commit_score = round(frequency_score + consistency_score)
            commit_score = min(commit_score, 25)

            # ── Contribution Streak (20 pts) ──
            current_streak = events.get("current_streak_days", 0)
            longest_streak = events.get("longest_streak_days", 0)
            streak_score = min(current_streak // 3, 10) + min(longest_streak // 7, 10)
            streak_score = min(streak_score, 20)

            # ── Open Source PRs (15 pts) ──
            external_prs = contributions.get("external_merged_prs", 0)
            pr_score = min(external_prs * 3, 15)

            total_score = (
                profile_score
                + repo_score
                + lang_score
                + commit_score
                + streak_score
                + pr_score
            )

            def label(score: int, max_score: int) -> str:
                ratio = score / max_score if max_score else 0
                if ratio >= 0.8:
                    return "Excellent"
                elif ratio >= 0.6:
                    return "Good"
                elif ratio >= 0.4:
                    return "Average"
                return "Needs Work"

            self.insights["score"] = {
                "total_score": total_score,
                "max_score": 100,
                "label": label(total_score, 100),
                "breakdown": {
                    "profile_completeness": {"score": profile_score, "max": 5, "label": label(profile_score, 5)},
                    "repo_quality": {"score": repo_score, "max": 20, "label": label(repo_score, 20)},
                    "language_diversity": {"score": lang_score, "max": 15, "label": label(lang_score, 15)},
                    "commit_activity": {"score": commit_score, "max": 25, "label": label(commit_score, 25)},
                    "contribution_streak": {"score": streak_score, "max": 20, "label": label(streak_score, 20)},
                    "open_source_prs": {"score": pr_score, "max": 15, "label": label(pr_score, 15)},
                },
            }

            self.pipeline_log_message(f"Final DevJudge Score: {total_score}/100 — {label(total_score, 100)}")
        except Exception as e:
            print(f"Error deriving insights: {e}")
            raise e
