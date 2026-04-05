"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getGitHubSignInUrl, getLogoutUrl } from "@/lib/auth-backend";
import {
  type DashboardState,
  fetchDashboardState,
  startInitialAnalysis,
} from "@/lib/dashboard-api";

type DashboardScreenState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; dashboard: DashboardState };

function getInitials(username: string, displayName: string | null): string {
  const source = displayName?.trim() || username.trim();
  return source.slice(0, 2).toUpperCase();
}

function DashboardStatusCard({ dashboard }: { dashboard: DashboardState }) {
  const statusLabel = dashboard.hasInitialData
    ? "Initial data ready"
    : dashboard.analysisRequested
      ? "Analysis queued"
      : "Needs first analysis";

  const statusTone = dashboard.hasInitialData
    ? "text-success"
    : dashboard.analysisRequested
      ? "text-warning"
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
        {dashboard.hasInitialData
          ? "Your first profile snapshot is already present. The next step is rendering the actual scorecards and analysis detail."
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
  const signInHref = getGitHubSignInUrl();
  const logoutHref = getLogoutUrl();

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
    };
  }, []);

  async function handleStartAnalysis() {
    if (screenState.status !== "ready") {
      return;
    }

    if (
      screenState.dashboard.hasInitialData ||
      screenState.dashboard.analysisRequested
    ) {
      return;
    }

    setActionError(null);
    setIsStartingAnalysis(true);

    try {
      const result = await startInitialAnalysis();

      if (result.kind === "authenticated") {
        setScreenState({
          status: "ready",
          dashboard: result.dashboard,
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
    <main className="relative isolate min-h-[100dvh] overflow-hidden bg-bg-primary px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,166,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(188,140,255,0.12),transparent_28%)]" />

      <section className="relative mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-7xl flex-col rounded-[1.75rem] border border-border-default bg-bg-secondary/95 shadow-[0_28px_120px_rgba(0,0,0,0.45)] backdrop-blur sm:min-h-[calc(100dvh-4rem)]">
        <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:32px_32px] sm:[background-size:44px_44px]" />

        <div className="relative flex items-center justify-between gap-4 border-b border-border-default px-5 py-4 sm:px-8 sm:py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">
              DevJudge
            </p>
            <h1 className="mt-2 text-2xl text-text-primary [font-family:var(--font-syne)] sm:text-3xl">
              Dashboard
            </h1>
          </div>

          <a
            href={logoutHref}
            className="rounded-full border border-border-muted px-4 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
          >
            Logout
          </a>
        </div>

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

                  <div className="rounded-2xl border border-border-default bg-bg-secondary px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
                      Next step
                    </p>
                    <p className="mt-3 text-sm leading-7 text-text-secondary">
                      {screenState.dashboard.hasInitialData
                        ? "Initial data exists. The next layer is the actual analysis UI."
                        : "Trigger the first analysis to queue the GitHub ingest for this user."}
                    </p>
                  </div>
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
                        disabled={
                          isStartingAnalysis ||
                          screenState.dashboard.analysisRequested
                        }
                        className="rounded-xl bg-btn-primary px-6 py-4 text-base font-bold text-bg-primary transition-transform disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto [font-family:var(--font-syne)] cursor-pointer"
                      >
                        {screenState.dashboard.analysisRequested
                          ? "Analysis queued"
                          : isStartingAnalysis
                            ? "Starting analysis..."
                            : "Start Analysis"}
                      </button>

                      <p className="text-sm leading-7 text-text-muted">
                        {screenState.dashboard.analysisRequested
                          ? "The request is already recorded for this user."
                          : "This only records the initial analysis request state right now."}
                      </p>
                    </div>

                    {actionError ? (
                      <p className="mt-4 text-sm text-danger">{actionError}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-border-default bg-bg-primary p-6 sm:p-8">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">
                      Analysis
                    </p>
                    <h2 className="mt-4 text-3xl text-text-primary [font-family:var(--font-syne)] sm:text-4xl">
                      Initial data is ready
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-text-subtle sm:text-base">
                      The user already has the first stored dataset. The next
                      implementation step is rendering contribution scorecards,
                      repo breakdowns, and trend views on top of it.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
