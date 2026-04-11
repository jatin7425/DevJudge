"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  DashboardFrame,
  DashboardPanel,
  MetricCard,
  StatusPill,
} from "@/components/dashboard/dashboard-frame";
import { type JobSummary, fetchLatestSuccessfulJob } from "@/lib/dashboard-api";

type AnalysisPayload = {
  repos?: {
    total_forks?: number;
    total_repos?: number;
    total_stars?: number;
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
  default: "#8b949e",
};

function getStatusTone(score: number, maxScore: number) {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.75) return "success" as const;
  if (ratio >= 0.45) return "warning" as const;
  return "danger" as const;
}

function getScoreBar(score: number, maxScore: number) {
  const tone = getStatusTone(score, maxScore);
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  return "bg-danger";
}

function getResult(job: JobSummary | null): AnalysisPayload | null {
  return (job?.result as AnalysisPayload | null) ?? null;
}

export function AnalyticsScreen() {
  const [latestJob, setLatestJob] = useState<JobSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const result = getResult(latestJob);
  const score = result?.score?.total_score ?? 0;
  const maxScore = result?.score?.max_score ?? 100;
  const scorePercent = Math.max(0, Math.min(100, (score / Math.max(maxScore, 1)) * 100));
  const breakdown = Object.entries(result?.score?.breakdown ?? {});
  const languages = Object.entries(result?.languages?.language_percentages ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 7);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const job = await fetchLatestSuccessfulJob();
        if (mounted) setLatestJob(job);
      } catch {
        if (mounted) setError("Could not load analytics right now.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <DashboardFrame
      eyebrow="Analytics"
      title="Readable GitHub report"
      description="This page keeps the analytics separate from the run screen, so users can focus on the report after the scan is complete."
      actions={(
        <>
          <Link
            href="/dashboard"
            className="rounded-full bg-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-bg-primary transition-opacity hover:opacity-90"
          >
            Run New Analysis
          </Link>
          <Link
            href="/dashboard/jobs"
            className="rounded-full border border-border-muted px-4 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
          >
            Job History
          </Link>
        </>
      )}
    >
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="h-96 animate-pulse rounded-[1.6rem] border border-border-default bg-bg-secondary/70" />
          <div className="h-96 animate-pulse rounded-[1.6rem] border border-border-default bg-bg-secondary/70" />
        </div>
      ) : null}

      {error ? (
        <DashboardPanel title="Analytics unavailable" eyebrow="Error">
          <p className="text-sm text-danger">{error}</p>
        </DashboardPanel>
      ) : null}

      {!isLoading && !error && !result ? (
        <DashboardPanel title="No analytics yet" eyebrow="Empty State">
          <p className="max-w-2xl text-sm leading-7 text-text-subtle">
            Run analysis first. When the worker completes successfully, this page will render the score report here.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-[1rem] bg-btn-primary px-5 py-3 text-sm font-bold text-bg-primary [font-family:var(--font-syne)]"
          >
            Go Run Analysis
          </Link>
        </DashboardPanel>
      ) : null}

      {result ? (
        <div className="space-y-6">
          <DashboardPanel
            title="Overall profile score"
            eyebrow="Summary"
            action={<StatusPill label={result.score?.label ?? "Unlabeled"} tone={getStatusTone(score, maxScore)} />}
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-[1.5rem] border border-border-default bg-bg-primary/80 p-6">
                <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">DevJudge Score</p>
                <div className="mt-5 flex items-end gap-3">
                  <span
                    className={`text-6xl [font-family:var(--font-syne)] ${
                      getStatusTone(score, maxScore) === "success"
                        ? "text-success"
                        : getStatusTone(score, maxScore) === "warning"
                          ? "text-warning"
                          : "text-danger"
                    }`}
                  >
                    {score}
                  </span>
                  <span className="pb-2 text-sm text-text-muted">/ {maxScore}</span>
                </div>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-bg-secondary">
                  <div className={`h-full rounded-full ${getScoreBar(score, maxScore)}`} style={{ width: `${scorePercent}%` }} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <MetricCard label="Repositories" value={result.repos?.total_repos ?? 0} subtitle={`${result.repos?.repos_with_readme ?? 0} READMEs, ${result.repos?.repos_with_description ?? 0} descriptions`} />
                <MetricCard label="Commits" value={result.commit_activity?.total_commits ?? 0} subtitle={`${result.commit_activity?.active_repos ?? 0} active repositories`} tone={(result.commit_activity?.total_commits ?? 0) > 0 ? "success" : "danger"} />
                <MetricCard label="External PRs" value={result.contributions?.external_merged_prs ?? 0} subtitle={`${result.contributions?.total_merged_prs ?? 0} total merged PRs`} tone={(result.contributions?.external_merged_prs ?? 0) > 0 ? "success" : "warning"} />
                <MetricCard label="Streak" value={`${result.events?.longest_streak_days ?? 0}d`} subtitle={`${result.events?.total_active_days ?? 0} active days`} tone={(result.events?.longest_streak_days ?? 0) > 1 ? "success" : "warning"} />
              </div>
            </div>
          </DashboardPanel>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <DashboardPanel title="Score breakdown" eyebrow="Details">
              <div className="space-y-4">
                {breakdown.map(([key, value]) => {
                  const itemScore = value.score ?? 0;
                  const itemMax = Math.max(value.max ?? 0, 1);
                  const width = Math.min(100, (itemScore / itemMax) * 100);
                  return (
                    <div key={key} className="rounded-[1rem] border border-border-default bg-bg-primary/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm capitalize text-text-primary">{key.replaceAll("_", " ")}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-text-muted">{value.label ?? "Unrated"}</p>
                        </div>
                        <p className="text-sm text-text-secondary">{itemScore}/{itemMax}</p>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-secondary">
                        <div className={`h-full rounded-full ${getScoreBar(itemScore, itemMax)}`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </DashboardPanel>

            <DashboardPanel title="Languages" eyebrow="Tech Stack">
              <div className="space-y-4">
                <div className="rounded-[1rem] border border-border-default bg-bg-primary/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Primary</p>
                  <p className="mt-2 text-2xl text-text-primary [font-family:var(--font-syne)]">
                    {result.languages?.primary_language ?? "Unknown"}
                  </p>
                  <p className="mt-1 text-sm text-text-subtle">{result.languages?.unique_languages ?? 0} languages used</p>
                </div>

                <div className="flex h-3 overflow-hidden rounded-full bg-bg-primary">
                  {languages.map(([language, percent]) => (
                    <div
                      key={language}
                      style={{
                        width: `${percent}%`,
                        backgroundColor: LANGUAGE_COLORS[language] ?? LANGUAGE_COLORS.default,
                      }}
                    />
                  ))}
                </div>

                <div className="space-y-3">
                  {languages.map(([language, percent]) => (
                    <div key={language} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: LANGUAGE_COLORS[language] ?? LANGUAGE_COLORS.default }}
                        />
                        <span className="text-sm text-text-secondary">{language}</span>
                      </div>
                      <span className="text-sm text-text-muted">{percent.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </DashboardPanel>
          </div>
        </div>
      ) : null}
    </DashboardFrame>
  );
}
