"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AlertIcon, DashboardPanel, StatusPill } from "@/components/dashboard/dashboard-frame";
import { fetchLatestSuccessfulJob, type JobSummary } from "@/lib/dashboard-api";

type AnalyticsContentProps = {
  setPageMetadata: (metadata: { eyebrow: string; title: string; actions?: ReactNode }) => void;
};

type AnalysisPayload = {
  repos?: {
    total_forks?: number;
    total_repos?: number;
    total_stars?: number;
    original_repos?: number;
    repos_with_readme?: number;
    repos_with_description?: number;
  };
  score?: {
    total_score?: number;
    max_score?: number;
    label?: string;
    breakdown?: Record<string, { score?: number; max?: number; label?: string }>;
  };
  events?: {
    total_active_days?: number;
    current_streak_days?: number;
    longest_streak_days?: number;
  };
  languages?: {
    primary_language?: string;
    unique_languages?: number;
    language_percentages?: Record<string, number>;
  };
  contributions?: {
    total_merged_prs?: number;
    external_merged_prs?: number;
  };
  commit_activity?: {
    active_repos?: number;
    total_commits?: number;
    avg_commits_per_repo?: number;
  };
};

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  default: "#8b949e",
};

function getStatusTone(score: number, maxScore: number) {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.75) return "success" as const;
  if (ratio >= 0.45) return "warning" as const;
  return "danger" as const;
}

function getResult(job: JobSummary | null): AnalysisPayload | null {
  return (job?.result as AnalysisPayload | null) ?? null;
}

function formatNumber(value: number | undefined, digits = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPercent(value: number) {
  return `${formatNumber(value, 1)}%`;
}

export function AnalyticsContent({ setPageMetadata }: AnalyticsContentProps) {
  const [jobSummary, setJobSummary] = useState<JobSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const result = getResult(jobSummary);
  const score = result?.score?.total_score ?? 0;
  const maxScore = result?.score?.max_score ?? 100;
  const scorePercent = Math.max(0, Math.min(100, (score / Math.max(maxScore, 1)) * 100));
  const scoreBreakdown = Object.entries(result?.score?.breakdown ?? {});
  const languageDistribution = Object.entries(result?.languages?.language_percentages ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 7);

  useEffect(() => {
    setPageMetadata({
      eyebrow: "Report",
      title: "Your Latest Analysis",
      actions: (
        <Link
          href="/dashboard"
          className="rounded-full border border-border-muted px-4 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
        >
          Back to Dashboard
        </Link>
      ),
    });
  }, [setPageMetadata]);

  useEffect(() => {
    let mounted = true;

    async function loadLatestJob() {
      try {
        setIsLoading(true);
        setError(null);
        const latestJob = await fetchLatestSuccessfulJob();
        if (!mounted) return;

        if (latestJob?.result) {
          setJobSummary(latestJob);
        } else {
          setJobSummary(null);
          setError("No successful analysis found. Please run an analysis from the dashboard.");
        }
      } catch (err) {
        console.error("Failed to fetch latest successful job:", err);
        if (mounted) {
          setError("Failed to load analytics data. Please try again later.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLatestJob();
    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="h-96 animate-pulse rounded-[1.6rem] border border-border-default bg-bg-secondary/70" />
        <div className="h-96 animate-pulse rounded-[1.6rem] border border-border-default bg-bg-secondary/70" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-danger/40 bg-bg-secondary p-8 text-center text-danger">
        <AlertIcon className="mb-4 h-8 w-8" />
        <p className="text-lg font-medium">{error}</p>
        <p className="mt-2 text-sm text-text-subtle">
          If the issue persists, start a fresh run and check the Jobs page for the raw payload.
        </p>
      </div>
    );
  }

  if (!jobSummary || !result) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-bg-secondary p-8 text-center text-text-muted">
        <p className="text-lg font-medium">No analytics data available.</p>
        <p className="mt-2 text-sm text-text-subtle">
          Run your first analysis from the{" "}
          <Link href="/dashboard" className="text-accent-primary hover:underline">
            dashboard
          </Link>{" "}
          to see your report here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPanel
        title="Overview Score"
        eyebrow="Key Metric"
        action={<StatusPill label={result.score?.label ?? "Unrated"} tone={getStatusTone(score, maxScore)} />}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[1.4rem] border border-border-default bg-bg-primary/75 p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">DevJudge Score</p>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-5xl font-bold text-accent-primary">
                {formatNumber(score)}
              </span>
              <span className="pb-1 text-lg text-text-muted">/ {formatNumber(maxScore)}</span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-bg-secondary">
              <div className="h-full rounded-full bg-accent-primary transition-all duration-300" style={{ width: `${scorePercent}%` }} />
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              Your overall developer score based on GitHub profile, repository, language, streak, and PR activity.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.2rem] border border-border-default bg-bg-primary/75 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Repositories</p>
              <p className="mt-3 text-3xl font-semibold text-text-primary">
                {formatNumber(result.repos?.total_repos)}
              </p>
              <p className="mt-2 text-sm text-text-subtle">
                {formatNumber(result.repos?.repos_with_readme)} with README,{" "}
                {formatNumber(result.repos?.repos_with_description)} with description
              </p>
            </div>

            <div className="rounded-[1.2rem] border border-border-default bg-bg-primary/75 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Commit Activity</p>
              <p className="mt-3 text-3xl font-semibold text-text-primary">
                {formatNumber(result.commit_activity?.total_commits)}
              </p>
              <p className="mt-2 text-sm text-text-subtle">
                {formatNumber(result.commit_activity?.active_repos)} active repos,{" "}
                {formatNumber(result.commit_activity?.avg_commits_per_repo, 2)} avg per active repo
              </p>
            </div>

            <div className="rounded-[1.2rem] border border-border-default bg-bg-primary/75 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Merged PRs</p>
              <p className="mt-3 text-3xl font-semibold text-text-primary">
                {formatNumber(result.contributions?.external_merged_prs)}
              </p>
              <p className="mt-2 text-sm text-text-subtle">
                {formatNumber(result.contributions?.total_merged_prs)} total merged PRs
              </p>
            </div>

            <div className="rounded-[1.2rem] border border-border-default bg-bg-primary/75 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Contribution Streak</p>
              <p className="mt-3 text-3xl font-semibold text-text-primary">
                {formatNumber(result.events?.longest_streak_days)}d
              </p>
              <p className="mt-2 text-sm text-text-subtle">
                {formatNumber(result.events?.current_streak_days)}d current streak,{" "}
                {formatNumber(result.events?.total_active_days)} active days
              </p>
            </div>
          </div>
        </div>
      </DashboardPanel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <DashboardPanel title="Score Breakdown" eyebrow="Details">
          {scoreBreakdown.length > 0 ? (
            <div className="space-y-4">
              {scoreBreakdown.map(([key, value]) => {
                const itemScore = value.score ?? 0;
                const itemMax = Math.max(value.max ?? 0, 1);
                const width = Math.min(100, (itemScore / itemMax) * 100);

                return (
                  <div key={key} className="rounded-[1rem] border border-border-default bg-bg-primary/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm capitalize text-text-primary">{key.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-text-muted">
                          {value.label ?? "Unrated"}
                        </p>
                      </div>
                      <p className="text-sm text-text-secondary">
                        {formatNumber(itemScore)}/{formatNumber(itemMax)}
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-secondary">
                      <div className="h-full rounded-full bg-accent-primary transition-all duration-300" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-text-subtle">No score breakdown data available.</p>
          )}
        </DashboardPanel>

        <DashboardPanel title="Language Distribution" eyebrow="Insights">
          {languageDistribution.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-[1rem] border border-border-default bg-bg-primary/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Primary Language</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">
                  {result.languages?.primary_language ?? "Unknown"}
                </p>
                <p className="mt-1 text-sm text-text-subtle">
                  {formatNumber(result.languages?.unique_languages)} languages across analyzed repositories
                </p>
              </div>

              <div className="flex h-3 overflow-hidden rounded-full bg-bg-primary">
                {languageDistribution.map(([language, percent]) => (
                  <div
                    key={language}
                    style={{
                      width: `${percent}%`,
                      backgroundColor: LANGUAGE_COLORS[language] ?? LANGUAGE_COLORS.default,
                    }}
                  />
                ))}
              </div>

              <ul className="space-y-3">
                {languageDistribution.map(([language, percent]) => (
                  <li
                    key={language}
                    className="flex items-center justify-between rounded-lg border border-border-muted bg-bg-secondary p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: LANGUAGE_COLORS[language] ?? LANGUAGE_COLORS.default }}
                      />
                      <span className="font-medium text-text-primary">{language}</span>
                    </div>
                    <span className="font-semibold text-accent-primary">{formatPercent(percent)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-text-subtle">No language distribution data available.</p>
          )}
        </DashboardPanel>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <DashboardPanel title="Repository Engagement" eyebrow="Project Footprint">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1rem] border border-border-default bg-bg-primary/70 p-4">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Original Repos</dt>
              <dd className="mt-2 text-2xl font-semibold text-text-primary">
                {formatNumber(result.repos?.original_repos)}
              </dd>
            </div>
            <div className="rounded-[1rem] border border-border-default bg-bg-primary/70 p-4">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Total Stars</dt>
              <dd className="mt-2 text-2xl font-semibold text-text-primary">
                {formatNumber(result.repos?.total_stars)}
              </dd>
            </div>
            <div className="rounded-[1rem] border border-border-default bg-bg-primary/70 p-4">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Forks</dt>
              <dd className="mt-2 text-2xl font-semibold text-text-primary">
                {formatNumber(result.repos?.total_forks)}
              </dd>
            </div>
            <div className="rounded-[1rem] border border-border-default bg-bg-primary/70 p-4">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Readable Repos</dt>
              <dd className="mt-2 text-2xl font-semibold text-text-primary">
                {formatNumber(result.repos?.repos_with_readme)}
              </dd>
            </div>
          </dl>
        </DashboardPanel>

        <DashboardPanel
          title="Run Metadata"
          eyebrow="Latest Success"
          action={(
            <Link
              href={`/dashboard/jobs?jobId=${encodeURIComponent(jobSummary.job_id)}`}
              className="rounded-full bg-accent-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-90"
            >
              View Result
            </Link>
          )}
        >
          <dl className="space-y-4">
            <div className="rounded-[1rem] border border-border-default bg-bg-primary/70 p-4">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Completed At</dt>
              <dd className="mt-2 text-sm text-text-primary">
                {jobSummary.completed_at ? new Date(jobSummary.completed_at).toLocaleString() : "Unknown"}
              </dd>
            </div>
            <div className="rounded-[1rem] border border-border-default bg-bg-primary/70 p-4">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Job Status</dt>
              <dd className="mt-2 text-sm text-text-primary">{jobSummary.job_status}</dd>
            </div>
            <div className="rounded-[1rem] border border-border-default bg-bg-primary/70 p-4">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Job ID</dt>
              <dd className="mt-2 break-all text-xs text-text-secondary [font-family:var(--font-geist-mono)]">
                {jobSummary.job_id}
              </dd>
            </div>
          </dl>
        </DashboardPanel>
      </div>
    </div>
  );
}
