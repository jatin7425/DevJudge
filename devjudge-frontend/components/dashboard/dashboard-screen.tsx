"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertIcon,
  DashboardFrame,
  DashboardPanel,
  MetricCard,
  PlayIcon,
  StatusPill,
  TerminalIcon,
} from "@/components/dashboard/dashboard-frame";
import { getGitHubSignInUrl, getLogoutUrl } from "@/lib/auth-backend";
import {
  type DashboardState,
  type JobSummary,
  fetchActiveAnalysis,
  fetchDashboardState,
  fetchLatestSuccessfulJob,
  startInitialAnalysis,
} from "@/lib/dashboard-api";

type ScreenState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; dashboard: DashboardState };

type PipelineEvent = {
  id: number;
  message: string;
  progress?: number | null;
  status?: string | null;
  timestamp: string;
};

type AnalysisPayload = {
  repos?: { total_repos?: number; repos_with_readme?: number };
  score?: {
    total_score?: number;
    max_score?: number;
    label?: string;
    breakdown?: Record<string, { score?: number; max?: number; label?: string }>;
  };
  events?: { longest_streak_days?: number };
  languages?: { language_percentages?: Record<string, number> };
  contributions?: { external_merged_prs?: number };
  commit_activity?: { total_commits?: number };
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

function getResult(job: JobSummary | null): AnalysisPayload | null {
  return (job?.result as AnalysisPayload | null) ?? null;
}

function getStatusTone(status: string | null | undefined) {
  if (!status) return "default" as const;
  const value = status.toLowerCase();
  if (value === "completed" || value === "success") return "success" as const;
  if (value === "failed" || value === "error") return "danger" as const;
  if (value === "running" || value === "queued") return "warning" as const;
  return "accent" as const;
}

function getScoreTone(score: number, maxScore: number) {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.75) return "success";
  if (ratio >= 0.45) return "warning";
  return "danger";
}

function getScoreBar(score: number, maxScore: number) {
  const tone = getScoreTone(score, maxScore);
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  return "bg-danger";
}

function renderProgressBar(progress: number) {
  const safe = Math.max(0, Math.min(100, progress));
  return `[${"#".repeat(Math.round(safe / 5)).padEnd(20, ".")}] ${safe}%`;
}

export function DashboardScreen() {
  const [screenState, setScreenState] = useState<ScreenState>({ status: "loading" });
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisLogs, setAnalysisLogs] = useState<PipelineEvent[]>([]);
  const [latestSuccessfulJob, setLatestSuccessfulJob] = useState<JobSummary | null>(null);
  const [isStreamConnected, setIsStreamConnected] = useState(false);
  const streamRef = useRef<EventSource | null>(null);
  const signInHref = getGitHubSignInUrl();
  const logoutHref = getLogoutUrl();

  const result = getResult(latestSuccessfulJob);
  const score = result?.score?.total_score ?? 0;
  const maxScore = result?.score?.max_score ?? 100;
  const scorePercent = Math.max(0, Math.min(100, (score / Math.max(maxScore, 1)) * 100));
  const topLanguages = Object.entries(result?.languages?.language_percentages ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);
  const breakdown = Object.entries(result?.score?.breakdown ?? {});
  const isJobActive =
    Boolean(analysisJobId) &&
    analysisStatus !== "completed" &&
    analysisStatus !== "failed";

  const closeStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    setIsStreamConnected(false);
  }, []);

  const connectStream = useCallback((streamUrl: string) => {
    closeStream();
    const source = new EventSource(streamUrl, { withCredentials: true });
    streamRef.current = source;
    source.onopen = () => setIsStreamConnected(true);
    source.addEventListener("job-update", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as PipelineEvent;
        setAnalysisLogs((current) => {
          const next = [...current.filter((item) => item.id !== payload.id), payload];
          return next.sort((a, b) => a.id - b.id).slice(-80);
        });
        if (typeof payload.progress === "number") {
          setAnalysisProgress(Math.max(0, Math.min(100, payload.progress)));
        }
        if (payload.status) {
          setAnalysisStatus(payload.status);
        }
        if (
          payload.status === "completed" ||
          payload.status === "failed" ||
          payload.progress === 100
        ) {
          closeStream();
        }
      } catch {
        // Ignore malformed events.
      }
    });
  }, [closeStream]);

  const applyStartedAnalysis = useCallback((
    job: { jobId: string; status: string; streamUrl: string },
    clearLogs: boolean,
  ) => {
    setAnalysisJobId(job.jobId);
    setAnalysisStatus(job.status);
    setAnalysisProgress(job.status === "queued" ? 5 : 10);
    if (clearLogs) setAnalysisLogs([]);
    connectStream(job.streamUrl);
  }, [connectStream]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const dashboardResult = await fetchDashboardState();
        if (!mounted) return;

        if (dashboardResult.kind === "authenticated") {
          setScreenState({ status: "ready", dashboard: dashboardResult.dashboard });
          setLatestSuccessfulJob(await fetchLatestSuccessfulJob());

          if (dashboardResult.dashboard.analysisRequested) {
            const active = await fetchActiveAnalysis();
            if (!mounted) return;
            if (active.kind === "started") {
              applyStartedAnalysis(active, true);
            }
          }
          return;
        }

        setScreenState({ status: dashboardResult.kind });
      } catch {
        if (mounted) setScreenState({ status: "error" });
      }
    }

    void load();
    return () => {
      mounted = false;
      closeStream();
    };
  }, [applyStartedAnalysis, closeStream]);

  async function handleStartAnalysis() {
    if (screenState.status !== "ready" || isJobActive) return;
    setActionError(null);
    setIsStartingAnalysis(true);

    try {
      const started = await startInitialAnalysis();
      if (started.kind === "started") {
        applyStartedAnalysis(started, true);
        setScreenState((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                dashboard: { ...current.dashboard, analysisRequested: true },
              }
            : current,
        );
      } else {
        setScreenState({ status: started.kind });
      }
    } catch {
      setActionError("Could not start analysis right now. Try again.");
    } finally {
      setIsStartingAnalysis(false);
    }
  }

  return (
    <DashboardFrame
      eyebrow="DevJudge Console"
      title="GitHub Analysis Dashboard"
      description="A dashboard-style analysis page with a run button, live logs, and a matching jobs page for rendered history."
      actions={(
        <>
          <Link
            href="/dashboard/jobs"
            className="rounded-full border border-border-muted px-4 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
          >
            Open Jobs
          </Link>
          <a
            href={logoutHref}
            className="rounded-full border border-border-muted px-4 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
          >
            Logout
          </a>
        </>
      )}
    >
      {screenState.status === "loading" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
          <div className="space-y-6">
            <div className="h-44 animate-pulse rounded-[1.6rem] border border-border-default bg-bg-secondary/70" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-[1.35rem] border border-border-default bg-bg-secondary/70" />
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="h-64 animate-pulse rounded-[1.6rem] border border-border-default bg-bg-secondary/70" />
            <div className="h-80 animate-pulse rounded-[1.6rem] border border-border-default bg-bg-secondary/70" />
          </div>
        </div>
      ) : null}

      {screenState.status === "unauthenticated" ? (
        <DashboardPanel title="Sign in to open your dashboard" eyebrow="Analysis State">
          <p className="max-w-2xl text-sm leading-7 text-text-subtle">
            Reconnect with GitHub to run analysis and stream the live pipeline logs.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={signInHref}
              className="inline-flex items-center justify-center rounded-[1rem] bg-btn-primary px-5 py-3 text-sm font-bold text-bg-primary [font-family:var(--font-syne)]"
            >
              Continue with GitHub
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-[1rem] border border-border-muted px-5 py-3 text-sm text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
            >
              Back to Home
            </Link>
          </div>
        </DashboardPanel>
      ) : null}

      {screenState.status === "missing" ? (
        <DashboardPanel title="Profile record was not found" eyebrow="Analysis State">
          <p className="text-sm leading-7 text-text-subtle">
            The session exists, but the persisted dashboard profile is missing. Reconnect GitHub and try again.
          </p>
        </DashboardPanel>
      ) : null}

      {screenState.status === "error" ? (
        <DashboardPanel title="Could not load the current dashboard state" eyebrow="Analysis State">
          <p className="text-sm leading-7 text-text-subtle">
            Check that the backend is running and reachable from the browser.
          </p>
        </DashboardPanel>
      ) : null}

      {screenState.status === "ready" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
          <div className="space-y-6">
            <DashboardPanel
              title={screenState.dashboard.displayName ?? screenState.dashboard.username}
              eyebrow="Connected Profile"
              action={
                <div className="flex flex-wrap gap-2">
                  <StatusPill
                    label={screenState.dashboard.analysisRequested ? "Run Active" : result ? "Result Ready" : "Awaiting First Run"}
                    tone={screenState.dashboard.analysisRequested ? "warning" : result ? "success" : "accent"}
                  />
                  {result?.score?.label ? (
                    <StatusPill label={result.score.label} tone={getScoreTone(score, maxScore)} />
                  ) : null}
                </div>
              }
            >
              <p className="max-w-3xl text-sm leading-7 text-text-subtle">
                {screenState.dashboard.analysisRequested
                  ? "A run is in progress and the live console is active."
                  : result
                    ? "The latest successful analysis is loaded below, and you can trigger a new run any time."
                    : "This user is connected, but DevJudge still needs the first GitHub scan before rendering the full scoring UI."}
              </p>

              <div className="mt-6 rounded-[1.4rem] border border-border-default bg-bg-primary/80 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Total Score</p>
                <div className="mt-4 flex items-end gap-3">
                  <span
                    className={`text-5xl [font-family:var(--font-syne)] ${
                      getScoreTone(score, maxScore) === "success"
                        ? "text-success"
                        : getScoreTone(score, maxScore) === "warning"
                          ? "text-warning"
                          : "text-danger"
                    }`}
                  >
                    {score}
                  </span>
                  <span className="pb-1 text-sm text-text-muted">/ {maxScore}</span>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-bg-secondary">
                  <div className={`h-full rounded-full ${getScoreBar(score, maxScore)}`} style={{ width: `${scorePercent}%` }} />
                </div>
              </div>
            </DashboardPanel>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Commit Activity"
                value={result?.commit_activity?.total_commits ?? 0}
                subtitle="Total commits detected"
                tone={(result?.commit_activity?.total_commits ?? 0) > 0 ? "success" : "danger"}
              />
              <MetricCard
                label="External PRs"
                value={result?.contributions?.external_merged_prs ?? 0}
                subtitle="Merged outside owned repos"
                tone={(result?.contributions?.external_merged_prs ?? 0) > 0 ? "success" : "warning"}
              />
              <MetricCard
                label="Streak"
                value={`${result?.events?.longest_streak_days ?? 0}d`}
                subtitle="Longest active streak"
                tone={(result?.events?.longest_streak_days ?? 0) > 1 ? "success" : "warning"}
              />
              <MetricCard
                label="Repositories"
                value={result?.repos?.total_repos ?? 0}
                subtitle={`${result?.repos?.repos_with_readme ?? 0} with README`}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <DashboardPanel title="Score Breakdown" eyebrow="Scoring">
                {breakdown.length > 0 ? (
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
                ) : (
                  <p className="text-sm leading-7 text-text-subtle">Breakdown cards will appear after the first successful run.</p>
                )}
              </DashboardPanel>

              <DashboardPanel title="Language Distribution" eyebrow="Tech Stack">
                {topLanguages.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex h-3 overflow-hidden rounded-full bg-bg-primary">
                      {topLanguages.map(([language, percent]) => (
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
                      {topLanguages.map(([language, percent]) => (
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
                ) : (
                  <p className="text-sm leading-7 text-text-subtle">Language data will appear after the first successful run.</p>
                )}
              </DashboardPanel>
            </div>
          </div>

          <div className="space-y-6">
            <DashboardPanel
              title={result ? "Run a fresh analysis" : "Start the first GitHub scan"}
              eyebrow="Run Analysis"
              action={<StatusPill label={analysisStatus} tone={getStatusTone(analysisStatus)} />}
            >
              <p className="text-sm leading-7 text-text-subtle">
                Use this page as the main dashboard entry point: click the run button, watch the logs, then open the jobs page to inspect full history and payloads.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={isStartingAnalysis || isJobActive}
                  className="inline-flex items-center justify-center gap-2 rounded-[1rem] bg-btn-primary px-5 py-3 text-sm font-bold text-bg-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-70 [font-family:var(--font-syne)]"
                >
                  <PlayIcon className="h-4 w-4" />
                  {isJobActive ? "Analysis Running" : isStartingAnalysis ? "Starting Analysis" : "Run Analysis"}
                </button>

                <Link
                  href="/dashboard/jobs"
                  className="inline-flex items-center justify-center rounded-[1rem] border border-border-muted px-5 py-3 text-sm text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
                >
                  Open Jobs Page
                </Link>
              </div>

              {actionError ? (
                <div className="mt-4 flex items-start gap-3 rounded-[1rem] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              ) : null}

              <div className="mt-6 rounded-[1.2rem] border border-border-default bg-bg-primary/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-text-muted">Pipeline Progress</p>
                  <p className="text-sm text-text-secondary">
                    {analysisProgress}% {isStreamConnected ? "live" : "standby"}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-secondary">
                  <div className="h-full rounded-full bg-accent-primary transition-all duration-300" style={{ width: `${analysisProgress}%` }} />
                </div>
                <pre className="mt-4 overflow-x-auto text-xs leading-6 text-text-secondary [font-family:var(--font-dm-mono)]">
{`${renderProgressBar(analysisProgress)}
Job: ${analysisJobId ?? "No active job"}
Status: ${analysisStatus}`}
                </pre>
              </div>
            </DashboardPanel>

            <DashboardPanel title="Live Pipeline Logs" eyebrow="Console">
              <div className="rounded-[1.1rem] border border-border-default bg-[#0b0f14] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-muted">
                    <TerminalIcon className="h-4 w-4 text-accent-primary" />
                    Logs
                  </div>
                  <StatusPill label={isStreamConnected ? "Stream Connected" : "Idle"} tone={isStreamConnected ? "accent" : "default"} />
                </div>

                <div className="mt-4 max-h-[32rem] overflow-y-auto pr-1">
                  {analysisLogs.length === 0 ? (
                    <p className="text-sm leading-7 text-text-subtle">
                      Start a run to stream logs into this panel. The jobs page will keep the full history.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {analysisLogs.map((log) => (
                        <li
                          key={log.id}
                          className="rounded-[0.95rem] border border-border-default bg-bg-primary/80 px-3 py-2 text-xs leading-6 text-text-secondary [font-family:var(--font-dm-mono)]"
                        >
                          <span className="text-text-muted">
                            [{new Date(log.timestamp).toLocaleTimeString()}]
                          </span>{" "}
                          {log.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </DashboardPanel>
          </div>
        </div>
      ) : null}
    </DashboardFrame>
  );
}
