"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  AlertIcon,
  DashboardPanel,
  PlayIcon,
  StatusPill,
  TerminalIcon,
} from "@/components/dashboard/dashboard-frame";
import { useTerminalController } from "@/components/terminal/terminal-context";
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

type ActiveRun = {
  jobId: string;
  status: string;
  streamUrl: string;
};

function getStatusTone(status: string | null | undefined) {
  if (!status) return "default" as const;
  const value = status.toLowerCase();
  if (value === "completed" || value === "success") return "success" as const;
  if (value === "failed" || value === "error") return "danger" as const;
  if (value === "running" || value === "queued") return "warning" as const;
  return "accent" as const;
}

type DashboardScreenProps = {
  setPageMetadata: (metadata: { eyebrow: string; title: string; actions?: ReactNode }) => void;
};

export function DashboardScreen({ setPageMetadata }: DashboardScreenProps) {
  const { openTerminal, openTerminalWithStartedAnalysis } = useTerminalController();
  const [screenState, setScreenState] = useState<ScreenState>({ status: "loading" });
  const [latestSuccessfulJob, setLatestSuccessfulJob] = useState<JobSummary | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const signInHref = getGitHubSignInUrl();
  const logoutHref = getLogoutUrl();
  const isJobActive =
    Boolean(activeRun?.jobId) &&
    activeRun?.status !== "completed" &&
    activeRun?.status !== "failed";

  useEffect(() => {
    setPageMetadata({
      eyebrow: "Overview",
      title: "Run analysis, then read the report",
      actions: (
        <>
          <button
            type="button"
            onClick={openTerminal}
            className="rounded-full border border-border-accent bg-accent-subtle px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-primary transition-colors hover:bg-bg-tertiary"
          >
            Open Terminal
          </button>
          <a
            href={logoutHref}
            className="rounded-full border border-border-muted px-4 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
          >
            Logout
          </a>
        </>
      ),
    });
  }, [logoutHref, openTerminal, setPageMetadata]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const dashboardResult = await fetchDashboardState();
        if (!mounted) return;

        if (dashboardResult.kind === "authenticated") {
          setScreenState({ status: "ready", dashboard: dashboardResult.dashboard });
          const [latest, active] = await Promise.all([
            fetchLatestSuccessfulJob(),
            dashboardResult.dashboard.analysisRequested ? fetchActiveAnalysis() : Promise.resolve({ kind: "none" as const }),
          ]);

          if (!mounted) return;
          setLatestSuccessfulJob(latest);
          if (active.kind === "started") {
            setActiveRun({
              jobId: active.jobId,
              status: active.status,
              streamUrl: active.streamUrl,
            });
          } else {
            setActiveRun(null);
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
    };
  }, []);

  async function handleStartAnalysis() {
    if (screenState.status !== "ready" || isStartingAnalysis) return;

    setActionError(null);
    setIsStartingAnalysis(true);

    try {
      const started = await startInitialAnalysis();
      if (started.kind === "started") {
        setActiveRun({
          jobId: started.jobId,
          status: started.status,
          streamUrl: started.streamUrl,
        });
        setScreenState((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                dashboard: { ...current.dashboard, analysisRequested: true },
              }
            : current,
        );
        openTerminalWithStartedAnalysis({
          jobId: started.jobId,
          status: started.status,
          streamUrl: started.streamUrl,
        });
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
    <>
      {screenState.status === "loading" ? (
        <div className="space-y-6">
          <div className="h-80 animate-pulse rounded-[1.6rem] border border-border-default bg-bg-secondary/70" />
          <div className="h-64 animate-pulse rounded-[1.6rem] border border-border-default bg-bg-secondary/70" />
        </div>
      ) : null}

      {screenState.status === "unauthenticated" ? (
        <DashboardPanel title="Sign in to continue" eyebrow="Session">
          <p className="max-w-2xl text-sm leading-7 text-text-subtle">
            Connect GitHub first. After that, this page will let you run analysis in one click.
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
        <DashboardPanel title="Profile record was not found" eyebrow="Session">
          <p className="text-sm leading-7 text-text-subtle">
            Reconnect GitHub so DevJudge can recreate the profile record.
          </p>
        </DashboardPanel>
      ) : null}

      {screenState.status === "error" ? (
        <DashboardPanel title="Dashboard unavailable" eyebrow="Backend">
          <p className="text-sm leading-7 text-text-subtle">
            Check that the backend is running, then refresh this page.
          </p>
        </DashboardPanel>
      ) : null}

      {screenState.status === "ready" ? (
        <div className="space-y-8">
          <DashboardPanel
            title={`Welcome, ${screenState.dashboard.displayName ?? screenState.dashboard.username}`}
            eyebrow="Next Best Action"
            action={
              <StatusPill
                label={isJobActive ? "Terminal Tracking Live Run" : latestSuccessfulJob ? "Report Ready" : "Needs Analysis"}
                tone={isJobActive ? "warning" : latestSuccessfulJob ? "success" : "accent"}
              />
            }
          >
            <div className="rounded-2xl border border-border-default bg-bg-secondary p-8">
              <p className="text-3xl font-bold text-text-primary">
                {isJobActive
                  ? "Open the terminal to watch the live pipeline."
                  : latestSuccessfulJob
                    ? "Your latest report is ready."
                    : "Run your first GitHub profile analysis."}
              </p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">
                {isJobActive
                  ? "All live logs now stream through the terminal. Use the terminal button or shortcut to follow the current run."
                  : latestSuccessfulJob
                    ? "Run again to open the terminal and stream a fresh analysis, or open Analytics to review the latest report."
                    : "Starting a run opens the terminal automatically and streams the worker output there in real time."}
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={isStartingAnalysis}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-primary px-6 py-3 text-base font-semibold text-white transition-all duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlayIcon className="h-4 w-4" />
                  {isStartingAnalysis ? "Starting..." : latestSuccessfulJob ? "Run Again In Terminal" : "Run Analysis In Terminal"}
                </button>

                {isJobActive ? (
                  <button
                    type="button"
                    onClick={openTerminal}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-accent bg-accent-subtle px-6 py-3 text-base font-semibold text-accent-primary transition-colors duration-200 hover:bg-bg-tertiary hover:border-accent-hover"
                  >
                    <TerminalIcon className="h-4 w-4" />
                    Open Live Terminal
                  </button>
                ) : (
                  <Link
                    href="/dashboard/analytics"
                    className="inline-flex items-center justify-center rounded-xl border border-border-accent bg-accent-subtle px-6 py-3 text-base font-semibold text-accent-primary transition-colors duration-200 hover:bg-bg-tertiary hover:border-accent-hover"
                  >
                    View Analytics
                  </Link>
                )}

                <Link
                  href="/dashboard/jobs"
                  className="inline-flex items-center justify-center rounded-xl border border-border-muted px-6 py-3 text-base text-text-secondary transition-colors duration-200 hover:border-border-accent hover:text-text-primary"
                >
                  Job History
                </Link>
              </div>

              {actionError ? (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 px-5 py-4 text-sm text-danger">
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              ) : null}
            </div>
          </DashboardPanel>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <DashboardPanel title="Terminal Workflow" eyebrow="Console-First">
              <div className="grid gap-6 md:grid-cols-3">
                {[
                  ["1", "Run", "Click the terminal run button and DevJudge opens the terminal automatically."],
                  ["2", "Watch", "Follow live worker output, progress, saved logs, and commands in one place."],
                  ["3", "Review", "Open Analytics or Jobs once the run completes to inspect the results."],
                ].map(([step, title, body]) => (
                  <div key={step} className="rounded-xl border border-border-default bg-bg-secondary p-6">
                    <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent-primary">Step {step}</p>
                    <p className="mt-3 text-xl font-bold text-text-primary">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
                  </div>
                ))}
              </div>
            </DashboardPanel>

            <DashboardPanel
              title="Terminal Commands"
              eyebrow="Quick Reference"
              action={<StatusPill label={isJobActive ? activeRun?.status ?? "running" : "idle"} tone={getStatusTone(isJobActive ? activeRun?.status : "idle")} />}
            >
              <div className="rounded-xl border border-border-default bg-bg-secondary p-6">
                <div className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-text-muted">
                  <TerminalIcon className="h-4 w-4 text-accent-primary" />
                  Commands
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
                  <li><span className="text-text-primary">Ctrl+Shift+`</span> opens the terminal anywhere in the dashboard.</li>
                  <li><span className="text-text-primary">run</span> starts a fresh analysis directly from the terminal.</li>
                  <li><span className="text-text-primary">active</span> follows the current live run.</li>
                  <li><span className="text-text-primary">latest</span> opens saved logs for the latest completed run.</li>
                  <li><span className="text-text-primary">job &lt;id&gt;</span> opens logs for a specific job id.</li>
                </ul>
              </div>
            </DashboardPanel>
          </div>
        </div>
      ) : null}
    </>
  );
}
