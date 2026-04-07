"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { getGitHubSignInUrl, getLogoutUrl } from "@/lib/auth-backend";
import { AppNav } from "@/components/navigation/app-nav";
import { PageHeader } from "@/components/navigation/page-header";
import {
  type DashboardState,
  type JobSummary,
  fetchActiveAnalysis,
  fetchDashboardState,
  fetchLatestSuccessfulJob,
  startInitialAnalysis,
} from "@/lib/dashboard-api";

type DashboardScreenState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; dashboard: DashboardState };

type PipelineEvent = {
  id: number;
  job_id: string;
  message: string;
  progress?: number | null;
  status?: string | null;
  timestamp: string;
};

type StepState = {
  key?: string;
  label?: string;
  status?: string;
  updated_at?: string;
  error?: string;
};

function getInitials(username: string, displayName: string | null): string {
  const source = displayName?.trim() || username.trim();
  return source.slice(0, 2).toUpperCase();
}

function DashboardStatusCard({ dashboard }: { dashboard: DashboardState }) {
  const statusLabel = dashboard.analysisRequested
    ? "Analysis running"
    : dashboard.hasInitialData
      ? "Latest result available"
      : "Needs first analysis";

  const statusTone = dashboard.analysisRequested
    ? "text-warning"
    : dashboard.hasInitialData
      ? "text-success"
      : "text-accent-primary";

  return (
    <div className="rounded-[1.5rem] border border-border-default bg-bg-secondary p-6">
      <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">
        Status
      </p>
      <p className={`mt-4 text-2xl [font-family:var(--font-syne)] ${statusTone}`}>
        {statusLabel}
      </p>
      <p className="mt-3 max-w-lg text-sm leading-7 text-text-subtle">
        {dashboard.analysisRequested
          ? "The pipeline is processing now. Open logs sidebar to watch each step in real time."
          : dashboard.hasInitialData
            ? "A successful run exists for this account. You can trigger a fresh run any time."
            : "DevJudge has the account, but it still needs the first GitHub data pull before scoring can start."}
      </p>
    </div>
  );
}

export function DashboardScreen() {
  const [screenState, setScreenState] = useState<DashboardScreenState>({
    status: "loading",
  });
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>("idle");
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisLogs, setAnalysisLogs] = useState<PipelineEvent[]>([]);
  const [analysisSteps, setAnalysisSteps] = useState<Record<string, StepState>>({});
  const [latestSuccessfulJob, setLatestSuccessfulJob] = useState<JobSummary | null>(null);
  const [isLogSidebarOpen, setIsLogSidebarOpen] = useState(true);
  const [isStreamConnected, setIsStreamConnected] = useState(false);
  const streamRef = useRef<EventSource | null>(null);
  const signInHref = getGitHubSignInUrl();
  const logoutHref = getLogoutUrl();
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

  const connectAnalysisStream = useCallback((streamUrl: string) => {
    closeStream();

    const source = new EventSource(streamUrl, { withCredentials: true });
    streamRef.current = source;

    source.onopen = () => {
      setIsStreamConnected(true);
    };

    source.addEventListener("job-update", (event) => {
      const messageEvent = event as MessageEvent;
      try {
        const payload = JSON.parse(messageEvent.data) as PipelineEvent;
        setAnalysisLogs((current) => {
          const byId = new Map<number, PipelineEvent>();
          for (const entry of current) {
            byId.set(entry.id, entry);
          }
          byId.set(payload.id, payload);
          return Array.from(byId.values())
            .sort((left, right) => left.id - right.id)
            .slice(-80);
        });

        if (typeof payload.progress === "number") {
          setAnalysisProgress(Math.max(0, Math.min(100, payload.progress)));
        }

        if (payload.status) {
          setAnalysisStatus(payload.status);
        }

        if (payload.message.startsWith("Current Step: ")) {
          const label = payload.message.replace("Current Step: ", "");
          setAnalysisSteps((prev) => {
            const next = { ...prev };
            const key = label.toLowerCase().replace(/\s+/g, "_");
            next[key] = {
              ...(next[key] ?? {}),
              key,
              label,
              status: "running",
              updated_at: payload.timestamp,
            };
            return next;
          });
        }

        if (payload.status === "completed" || payload.status === "failed" || payload.progress === 100) {
          closeStream();
        }
      } catch {
        // Ignore malformed event payloads.
      }
    });

    source.onerror = () => {
      // EventSource auto-reconnects; keep the UI stable instead of flickering.
    };
  }, [closeStream]);

  const applyStartedAnalysis = useCallback((
    result: {
      jobId: string;
      status: string;
      streamUrl: string;
      steps?: Record<string, unknown>;
    },
    clearLogs: boolean,
  ) => {
    setAnalysisJobId(result.jobId);
    setAnalysisStatus(result.status);
    setAnalysisProgress(result.status === "queued" ? 5 : 10);
    setIsLogSidebarOpen(true);
    if (clearLogs) {
      setAnalysisLogs([]);
    }
    const stepEntries = (result.steps ?? {}) as Record<string, StepState>;
    setAnalysisSteps(stepEntries);
    connectAnalysisStream(result.streamUrl);
  }, [connectAnalysisStream]);

  useEffect(() => {
    if (!isJobActive) {
      setIsLogSidebarOpen(false);
    }
  }, [isJobActive]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const result = await fetchDashboardState();

        if (!isMounted) {
          return;
        }

        if (result.kind === "authenticated") {
          setScreenState({
            status: "ready",
            dashboard: result.dashboard,
          });

          const latestSuccessful = await fetchLatestSuccessfulJob();
          if (!isMounted) {
            return;
          }
          setLatestSuccessfulJob(latestSuccessful);

          if (result.dashboard.analysisRequested) {
            const activeAnalysis = await fetchActiveAnalysis();
            if (!isMounted) {
              return;
            }

            if (activeAnalysis.kind === "started") {
              applyStartedAnalysis(activeAnalysis, true);
            } else if (activeAnalysis.kind === "unauthenticated") {
              setScreenState({ status: "unauthenticated" });
            }
          }
          return;
        }

        if (result.kind === "unauthenticated") {
          setScreenState({ status: "unauthenticated" });
          return;
        }

        setScreenState({ status: "missing" });
      } catch {
        if (isMounted) {
          setScreenState({ status: "error" });
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
      closeStream();
    };
  }, [applyStartedAnalysis, closeStream]);

  async function handleStartAnalysis() {
    if (screenState.status !== "ready") {
      return;
    }

    if (isJobActive) {
      return;
    }

    setActionError(null);
    setIsStartingAnalysis(true);

    try {
      const result = await startInitialAnalysis();

      if (result.kind === "started") {
        applyStartedAnalysis(result, true);

        setScreenState((current) => {
          if (current.status !== "ready") {
            return current;
          }

          return {
            status: "ready",
            dashboard: {
              ...current.dashboard,
              analysisRequested: true,
            },
          };
        });
        return;
      }

      if (result.kind === "unauthenticated") {
        setScreenState({ status: "unauthenticated" });
        return;
      }
      setScreenState({ status: "missing" });
    } catch {
      setActionError("Could not start analysis right now. Try again.");
    } finally {
      setIsStartingAnalysis(false);
    }
  }

  return (
    <main className="relative isolate min-h-[100dvh] overflow-hidden bg-bg-primary">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,166,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(188,140,255,0.12),transparent_28%)]" />

      <section className="relative flex min-h-[100dvh] w-full flex-col border border-border-default bg-bg-secondary/95 shadow-[0_28px_120px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:32px_32px] sm:[background-size:44px_44px]" />

        <PageHeader
          eyebrow="DevJudge"
          title="Dashboard"
          actions={(
            <>
              <AppNav />
              <a
                href={logoutHref}
                className="rounded-full border border-border-muted px-4 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
              >
                Logout
              </a>
            </>
          )}
        />

        <div className="relative flex flex-1 flex-col px-5 py-5 sm:px-8 sm:py-8">
          {screenState.status === "loading" ? (
            <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
              <div className="rounded-[1.5rem] border border-border-default bg-bg-primary/70 p-6" />
              <div className="space-y-5">
                <div className="h-44 rounded-[1.5rem] border border-border-default bg-bg-primary/70" />
                <div className="h-56 rounded-[1.5rem] border border-border-default bg-bg-primary/70" />
              </div>
            </div>
          ) : null}

          {screenState.status === "unauthenticated" ? (
            <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center">
              <div className="w-full rounded-[1.5rem] border border-border-default bg-bg-primary p-8 text-center">
                <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">
                  Session required
                </p>
                <h2 className="mt-4 text-3xl text-text-primary [font-family:var(--font-syne)]">
                  Sign in to open your dashboard
                </h2>
                <p className="mt-4 text-sm leading-7 text-text-subtle">
                  Your dashboard is backed by the Azure Functions auth session.
                  Login with GitHub again to continue.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <a
                    href={signInHref}
                    className="rounded-xl bg-btn-primary px-5 py-3 text-sm font-bold text-bg-primary transition-transform hover:-translate-y-0.5 [font-family:var(--font-syne)]"
                  >
                    Continue with GitHub
                  </a>
                  <Link
                    href="/"
                    className="rounded-xl border border-border-muted px-5 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
                  >
                    Back to home
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {screenState.status === "missing" ? (
            <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center">
              <div className="w-full rounded-[1.5rem] border border-danger/40 bg-bg-primary p-8 text-center">
                <p className="text-[11px] uppercase tracking-[0.24em] text-danger">
                  Profile missing
                </p>
                <h2 className="mt-4 text-3xl text-text-primary [font-family:var(--font-syne)]">
                  User record was not found
                </h2>
                <p className="mt-4 text-sm leading-7 text-text-subtle">
                  The session is present, but the persisted dashboard profile is
                  missing. Sign in again to recreate it.
                </p>
                <a
                  href={signInHref}
                  className="mt-8 inline-flex rounded-xl bg-btn-primary px-5 py-3 text-sm font-bold text-bg-primary transition-transform hover:-translate-y-0.5 [font-family:var(--font-syne)]"
                >
                  Reconnect GitHub
                </a>
              </div>
            </div>
          ) : null}

          {screenState.status === "error" ? (
            <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center">
              <div className="w-full rounded-[1.5rem] border border-warning/40 bg-bg-primary p-8 text-center">
                <p className="text-[11px] uppercase tracking-[0.24em] text-warning">
                  Dashboard unavailable
                </p>
                <h2 className="mt-4 text-3xl text-text-primary [font-family:var(--font-syne)]">
                  Could not load the current state
                </h2>
                <p className="mt-4 text-sm leading-7 text-text-subtle">
                  Check that the Azure Functions backend is running and that the
                  browser can reach it from this page.
                </p>
              </div>
            </div>
          ) : null}

          {screenState.status === "ready" ? (
            <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
              <aside className="rounded-[1.5rem] border border-border-default bg-bg-primary p-6">
                <div className="flex items-center gap-4">
                  {screenState.dashboard.avatarUrl ? (
                    <img
                      src={screenState.dashboard.avatarUrl}
                      alt={screenState.dashboard.username}
                      className="h-16 w-16 rounded-2xl border border-border-muted object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border-muted bg-bg-secondary text-lg font-bold text-text-primary [font-family:var(--font-syne)]">
                      {getInitials(
                        screenState.dashboard.username,
                        screenState.dashboard.displayName,
                      )}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-xl text-text-primary [font-family:var(--font-syne)]">
                      {screenState.dashboard.displayName ??
                        screenState.dashboard.username}
                    </p>
                    <p className="mt-1 truncate text-sm text-text-subtle">
                      @{screenState.dashboard.username}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-border-default bg-bg-secondary px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
                      Snapshot
                    </p>
                    <p className="mt-3 text-sm leading-7 text-text-secondary">
                      This screen checks whether DevJudge already has the first
                      repository snapshot for your account.
                    </p>
                  </div>

                  {isJobActive ? (
                    <button
                      type="button"
                      onClick={() => setIsLogSidebarOpen((value) => !value)}
                      className="rounded-xl border border-border-default bg-bg-secondary px-4 py-3 text-sm text-text-secondary hover:text-text-primary"
                    >
                      {isLogSidebarOpen ? "Hide Live Logs" : "Open Live Logs"}
                    </button>
                  ) : null}
                </div>
              </aside>

              <div className="flex flex-col gap-5">
                <DashboardStatusCard dashboard={screenState.dashboard} />

                {!screenState.dashboard.hasInitialData ? (
                  <div className="rounded-[1.5rem] border border-border-default bg-bg-primary p-6 sm:p-8">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">
                      Initial analysis
                    </p>
                    <h2 className="mt-4 text-3xl text-text-primary [font-family:var(--font-syne)] sm:text-4xl">
                      Start the first GitHub scan
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-text-subtle sm:text-base">
                      DevJudge already knows who this user is. It still needs
                      the first pass over repositories, contribution patterns,
                      and profile metadata before the scoring dashboard can
                      render real output.
                    </p>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={handleStartAnalysis}
                        disabled={isStartingAnalysis || isJobActive}
                        className="rounded-xl bg-btn-primary px-6 py-4 text-base font-bold text-bg-primary transition-transform disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto [font-family:var(--font-syne)] cursor-pointer"
                      >
                        {isJobActive
                          ? "Analysis running"
                          : isStartingAnalysis
                            ? "Starting analysis..."
                            : latestSuccessfulJob
                              ? "Run New Analysis"
                              : "Start Analysis"}
                      </button>

                      <p className="text-sm leading-7 text-text-muted">
                        {screenState.dashboard.analysisRequested
                          ? "Analysis is in progress. Open Live Logs from sidebar."
                          : latestSuccessfulJob
                            ? "Trigger a fresh run to compare with your previous result."
                            : "Click start to queue analysis and begin live pipeline tracking."}
                      </p>
                    </div>

                    {actionError ? (
                      <p className="mt-4 text-sm text-danger">{actionError}</p>
                    ) : null}

                    {analysisJobId ? (
                      <div className="mt-6 rounded-2xl border border-border-default bg-bg-secondary p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                            Pipeline progress
                          </p>
                          <p className="text-sm text-text-secondary">
                            {analysisProgress}% {isStreamConnected ? "• live" : "• reconnecting"}
                          </p>
                        </div>

                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-primary">
                          <div
                            className="h-full rounded-full bg-btn-primary transition-all duration-300"
                            style={{ width: `${analysisProgress}%` }}
                          />
                        </div>

                        <p className="mt-3 text-sm text-text-subtle">
                          Job: {analysisJobId} • Status: {analysisStatus}
                        </p>

                        <div className="mt-3 rounded-xl border border-border-default bg-bg-primary px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                            Pipeline Progress
                          </p>
                          <pre className="mt-2 overflow-x-auto text-sm text-text-secondary [font-family:var(--font-dm-mono)]">
{`[${"█".repeat(Math.round(analysisProgress / 5)).padEnd(20, "░")}] ${analysisProgress}%
Current Step: ${
  Object.values(analysisSteps).find((step) => step.status === "running")?.label ?? "Waiting for worker..."
}`}
                          </pre>
                        </div>

                        {Object.keys(analysisSteps).length > 0 ? (
                          <div className="mt-3 rounded-xl border border-border-default bg-bg-primary px-3 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                              Step Status
                            </p>
                            <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                              {Object.entries(analysisSteps).map(([key, step]) => (
                                <li key={key}>
                                  {(step.status === "success" && "✔") ||
                                    (step.status === "failed" && "✖") ||
                                    (step.status === "running" && "→") ||
                                    "•"}{" "}
                                  {step.label ?? key} ({step.status ?? "pending"})
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="mt-3">
                          <Link
                            href="/dashboard/jobs"
                            className="text-sm text-text-secondary underline hover:text-text-primary"
                          >
                            View all jobs and results
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-border-default bg-bg-primary p-6 sm:p-8">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">
                      Analysis
                    </p>
                    <h2 className="mt-4 text-3xl text-text-primary [font-family:var(--font-syne)] sm:text-4xl">
                      Latest analysis result
                    </h2>
                    {latestSuccessfulJob?.result ? (
                      <div className="mt-4 space-y-4">
                        <p className="text-sm leading-7 text-text-subtle sm:text-base">
                          Showing your latest successful run. Open jobs page for full history.
                        </p>
                        {(() => {
                          const result = latestSuccessfulJob.result as {
                            repos?: {
                              total_forks?: number;
                              total_repos?: number;
                              total_stars?: number;
                              forked_repos?: number;
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
                            profile?: {
                              stats?: {
                                followers?: number;
                                public_repos?: number;
                                total_fields?: number;
                                account_age_days?: number;
                                completed_fields?: number;
                                user_experience_level?: string;
                                user_experience_description?: string;
                              };
                              has_bio?: boolean;
                              has_blog?: boolean;
                              has_name?: boolean;
                              has_avatar?: boolean;
                              has_location?: boolean;
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

                          const breakdown = result.score?.breakdown ?? {};
                          const languagePercentages = Object.entries(result.languages?.language_percentages ?? {})
                            .sort((left, right) => right[1] - left[1])
                            .slice(0, 6);

                          const profileChecks = [
                            ["Avatar", result.profile?.has_avatar],
                            ["Name", result.profile?.has_name],
                            ["Bio", result.profile?.has_bio],
                            ["Location", result.profile?.has_location],
                            ["Blog", result.profile?.has_blog],
                          ] as const;

                          return (
                            <>
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-xl border border-border-default bg-bg-secondary p-4 lg:col-span-2">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">DevJudge Score</p>
                                  <p className="mt-2 text-4xl text-text-primary [font-family:var(--font-syne)]">
                                    {result.score?.total_score ?? 0}
                                    <span className="ml-2 text-lg text-text-muted">/ {result.score?.max_score ?? 100}</span>
                                  </p>
                                  <p className="mt-2 text-sm text-text-secondary">{result.score?.label ?? "Unlabeled"}</p>
                                </div>
                                <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Repositories</p>
                                  <p className="mt-2 text-3xl text-text-primary [font-family:var(--font-syne)]">{result.repos?.total_repos ?? 0}</p>
                                  <p className="mt-1 text-xs text-text-muted">
                                    READMEs: {result.repos?.repos_with_readme ?? 0} • Descriptions: {result.repos?.repos_with_description ?? 0}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Primary Language</p>
                                  <p className="mt-2 text-2xl text-text-primary [font-family:var(--font-syne)]">
                                    {result.languages?.primary_language ?? "-"}
                                  </p>
                                  <p className="mt-1 text-xs text-text-muted">Unique: {result.languages?.unique_languages ?? 0}</p>
                                </div>
                              </div>

                              <div className="grid gap-3 lg:grid-cols-2">
                                <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Score Breakdown</p>
                                  <div className="mt-3 space-y-3">
                                    {Object.entries(breakdown).map(([key, value]) => {
                                      const score = value.score ?? 0;
                                      const max = Math.max(1, value.max ?? 1);
                                      const width = Math.min(100, Math.round((score / max) * 100));
                                      return (
                                        <div key={key}>
                                          <div className="flex items-center justify-between text-xs text-text-secondary">
                                            <span className="uppercase tracking-[0.12em]">{key.replaceAll("_", " ")}</span>
                                            <span>{score}/{max}</span>
                                          </div>
                                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg-primary">
                                            <div className="h-full bg-btn-primary" style={{ width: `${width}%` }} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Language Distribution</p>
                                  <div className="mt-3 space-y-3">
                                    {languagePercentages.map(([language, percent]) => (
                                      <div key={language}>
                                        <div className="flex items-center justify-between text-xs text-text-secondary">
                                          <span className="uppercase tracking-[0.12em]">{language}</span>
                                          <span>{percent.toFixed(2)}%</span>
                                        </div>
                                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg-primary">
                                          <div className="h-full bg-success" style={{ width: `${Math.min(100, percent)}%` }} />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Commit Activity</p>
                                  <p className="mt-2 text-2xl text-text-primary [font-family:var(--font-syne)]">{result.commit_activity?.total_commits ?? 0}</p>
                                  <p className="text-xs text-text-muted">
                                    Active repos: {result.commit_activity?.active_repos ?? 0} • Avg/repo: {result.commit_activity?.avg_commits_per_repo ?? 0}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Contributions</p>
                                  <p className="mt-2 text-2xl text-text-primary [font-family:var(--font-syne)]">{result.contributions?.total_merged_prs ?? 0}</p>
                                  <p className="text-xs text-text-muted">
                                    External merged PRs: {result.contributions?.external_merged_prs ?? 0}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Streak</p>
                                  <p className="mt-2 text-2xl text-text-primary [font-family:var(--font-syne)]">{result.events?.current_streak_days ?? 0} days</p>
                                  <p className="text-xs text-text-muted">
                                    Longest: {result.events?.longest_streak_days ?? 0} • Active days: {result.events?.total_active_days ?? 0}
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Profile Snapshot</p>
                                <p className="mt-2 text-sm text-text-secondary">
                                  Experience: {result.profile?.stats?.user_experience_level ?? "-"} ({result.profile?.stats?.user_experience_description ?? "N/A"})
                                </p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                                  {profileChecks.map(([label, enabled]) => (
                                    <div key={label} className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-xs text-text-secondary">
                                      {(enabled ? "✔" : "○")} {label}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={handleStartAnalysis}
                            disabled={isStartingAnalysis || isJobActive}
                            className="rounded-xl bg-btn-primary px-5 py-3 text-sm font-bold text-bg-primary transition-transform disabled:cursor-not-allowed disabled:opacity-70 [font-family:var(--font-syne)]"
                          >
                            {isStartingAnalysis ? "Starting..." : isJobActive ? "Analysis running" : "Run New Analysis"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 max-w-2xl text-sm leading-7 text-text-subtle sm:text-base">
                        Initial data exists but no successful analysis result is available yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {isJobActive ? (
        <aside
          className={`fixed right-0 top-0 z-40 h-screen w-full max-w-md border-l border-border-default bg-bg-primary/95 p-5 backdrop-blur transition-transform duration-300 ${
            isLogSidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Live Logs</p>
            <button
              type="button"
              onClick={() => setIsLogSidebarOpen(false)}
              className="rounded-lg border border-border-default px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
            >
              Close
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-border-default bg-bg-secondary p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Pipeline Progress</p>
            <pre className="mt-2 overflow-x-auto text-sm text-text-secondary [font-family:var(--font-dm-mono)]">
{`[${"█".repeat(Math.round(analysisProgress / 5)).padEnd(20, "░")}] ${analysisProgress}%
Current Step: ${
  Object.values(analysisSteps).find((step) => step.status === "running")?.label ?? "Waiting for worker..."
}`}
            </pre>
          </div>

          <div className="mt-4 h-[calc(100vh-14rem)] overflow-y-auto rounded-xl border border-border-default bg-bg-secondary p-3">
            {analysisLogs.length === 0 ? (
              <p className="text-sm text-text-muted">Waiting for first pipeline log...</p>
            ) : (
              <ul className="space-y-1 text-sm text-text-secondary">
                {analysisLogs.map((log) => (
                  <li key={log.id}>
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      ) : null}
    </main>
  );
}
