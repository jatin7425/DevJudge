"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  DashboardPanel,
  MetricCard,
  StatusPill,
  TerminalIcon,
  XIcon,
} from "@/components/dashboard/dashboard-frame";
import {
  fetchJobDetail,
  fetchJobStats,
  fetchJobsHistory,
  type JobLogEvent,
  type JobStats,
  type JobSummary,
} from "@/lib/dashboard-api";

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function getStatusTone(status: string) {
  const value = status.toLowerCase();
  if (value === "completed" || value === "success") return "success" as const;
  if (value === "failed" || value === "error") return "danger" as const;
  if (value === "running" || value === "queued") return "warning" as const;
  return "accent" as const;
}

function getJobLogs(job: JobSummary | null): any[] {
  const rawLogs = job?.meta?.logs;
  if (!Array.isArray(rawLogs)) {
    return [];
  }

  return rawLogs.filter((item): item is any => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof item.message === "string"
    );
  }).map((item, index) => ({
    ...item,
    id: item.id?.toString() ?? `log-${index}`,
    job_id: item.job_id ?? job?.job_id ?? "unknown",
    timestamp: item.timestamp ?? new Date().toISOString(),
  }));
}

function formatLogTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getLogProgressClass(progress: number | null | undefined, status: string | null | undefined): string {
  const normalizedStatus = (status ?? "").toLowerCase();
  if (normalizedStatus === "completed" || progress === 100) return "text-success";
  if (normalizedStatus === "failed") return "text-danger";
  return "text-accent-primary";
}

type JobsScreenProps = {
  setPageMetadata: (metadata: { eyebrow: string; title: string; actions?: ReactNode }) => void;
};

function JobsScreenContent({ setPageMetadata }: JobsScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedJobId = searchParams.get("jobId");

  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<JobSummary | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"result" | "error" | "logs">("result");

  const selectedJobSummary = useMemo(
    () => jobs.find((job) => job.job_id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );
  const inspectorJob = selectedJobDetail ?? selectedJobSummary;
  const savedLogs = getJobLogs(selectedJobDetail);

  useEffect(() => {
    setPageMetadata({
      eyebrow: "Analysis Jobs",
      title: "Job History",
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
    if (!isDrawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
        setActiveTab("result");
        router.replace("/dashboard/jobs", { scroll: false });
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen, router]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setActiveTab("result");
    router.replace("/dashboard/jobs", { scroll: false });
  }, [router]);

  const loadJobDetail = useCallback(async (jobId: string, tab: "result" | "error" | "logs" = "result") => {
    setSelectedJobId(jobId);
    setActiveTab(tab);
    setIsDrawerOpen(true);
    setIsDetailLoading(true);
    setError(null);
    router.replace(`/dashboard/jobs?jobId=${encodeURIComponent(jobId)}`, { scroll: false });

    try {
      const detail = await fetchJobDetail(jobId);
      setSelectedJobDetail(detail);
      if (!detail) {
        setError("Could not load the selected job.");
      }
    } catch {
      setSelectedJobDetail(null);
      setError("Could not load the selected job.");
    } finally {
      setIsDetailLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [nextStats, nextJobs] = await Promise.all([
          fetchJobStats(),
          fetchJobsHistory(50),
        ]);
        if (!mounted) return;
        setStats(nextStats);
        setJobs(nextJobs);
      } catch {
        if (mounted) setError("Could not load jobs right now.");
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!requestedJobId || jobs.length === 0) {
      return;
    }

    const hasRequestedJob = jobs.some((job) => job.job_id === requestedJobId);
    if (!hasRequestedJob || requestedJobId === selectedJobId) {
      return;
    }

    void loadJobDetail(requestedJobId);
  }, [jobs, loadJobDetail, requestedJobId, selectedJobId]);

  useEffect(() => {
    if (!requestedJobId && !isDrawerOpen && (selectedJobId || selectedJobDetail)) {
      setSelectedJobId(null);
      setSelectedJobDetail(null);
      setActiveTab("result");
    }
  }, [isDrawerOpen, requestedJobId, selectedJobDetail, selectedJobId]);

  return (
    <>
      {error ? (
        <DashboardPanel title="Could not load jobs" eyebrow="Error">
          <p className="text-sm text-danger">{error}</p>
        </DashboardPanel>
      ) : null}

      {stats ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Total Jobs" value={stats.total} subtitle="All recorded analysis runs" />
          <MetricCard label="Queued" value={stats.queued} subtitle="Waiting for workers" tone={stats.queued > 0 ? "warning" : "default"} />
          <MetricCard label="Running" value={stats.running} subtitle="Currently processing" tone={stats.running > 0 ? "warning" : "default"} />
          <MetricCard label="Completed" value={stats.completed} subtitle="Finished successfully" tone="success" />
          <MetricCard label="Failed" value={stats.failed} subtitle="Ended with errors" tone={stats.failed > 0 ? "danger" : "default"} />
        </div>
      ) : null}

      <div className="mt-6">
        <DashboardPanel title="Rendered Job List" eyebrow="History">
          {jobs.length === 0 ? (
            <p className="text-sm leading-7 text-text-subtle">
              No analysis jobs have been recorded yet. Trigger a run from the dashboard and the list will render here.
            </p>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => {
                const isSelected = selectedJobId === job.job_id;

                return (
                  <div
                    key={job.job_id}
                    className={`rounded-[1.2rem] border p-4 transition-all ${
                      isSelected && isDrawerOpen
                        ? "border-border-accent bg-accent-subtle"
                        : "border-border-default bg-bg-primary/80"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill label={job.job_status} tone={getStatusTone(job.job_status)} />
                          {job.error ? <StatusPill label="Has Error" tone="danger" /> : null}
                        </div>
                        <p className="mt-3 break-all text-xs text-text-muted [font-family:var(--font-geist-mono)]">
                          {job.job_id}
                        </p>
                      </div>

                      <div className="grid gap-3 text-sm text-text-secondary sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Created</p>
                          <p className="mt-1">{formatDateTime(job.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Started</p>
                          <p className="mt-1">{formatDateTime(job.started_at)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Completed</p>
                          <p className="mt-1">{formatDateTime(job.completed_at)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          void loadJobDetail(job.job_id, "result");
                        }}
                        className="rounded-full bg-accent-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-90"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardPanel>

      </div>

      <div
        className={`fixed inset-0 z-[60] transition-all duration-300 ${
          isDrawerOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!isDrawerOpen}
      >
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close details panel"
          className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
            isDrawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <aside
          className={`absolute bottom-3 right-3 top-3 flex w-[min(620px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.6rem] border border-border-default bg-[#111214] shadow-[-20px_0_80px_rgba(0,0,0,0.5)] ring-1 ring-white/5 transition-transform duration-300 ${
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="sticky top-0 z-10 border-b border-border-default bg-[#111214] px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Run Inspector</p>
                <h2 className="mt-4 text-[2.1rem] leading-none text-text-primary [font-family:var(--font-syne)]">
                  {inspectorJob ? "View Result" : "Loading Run"}
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-text-subtle">
                  Inspect the saved result payload, persisted logs, and any recorded errors for this analysis run.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {inspectorJob ? <StatusPill label={inspectorJob.job_status} tone={getStatusTone(inspectorJob.job_status)} /> : null}
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-border-muted bg-bg-primary/80 px-3 text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
                  aria-label="Close details"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-5 py-5 sm:px-6 sm:py-6">
            {inspectorJob ? (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[0.85rem] border border-border-default bg-[#15171b] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Job ID</p>
                    <p className="mt-2 break-all text-xs text-text-secondary [font-family:var(--font-geist-mono)]">
                      {inspectorJob.job_id}
                    </p>
                  </div>
                  <div className="rounded-[0.85rem] border border-border-default bg-[#15171b] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Completed</p>
                    <p className="mt-2 text-sm text-text-primary">
                      {formatDateTime(inspectorJob.completed_at)}
                    </p>
                  </div>
                </div>

                <div className="border-b border-border-default">
                  <button
                    type="button"
                    onClick={() => setActiveTab("result")}
                    className={`relative min-w-28 px-4 py-3 text-[11px] uppercase tracking-[0.18em] transition-colors ${
                      activeTab === "result"
                        ? "text-text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    Result
                    <span
                      className={`absolute inset-x-4 bottom-0 h-0.5 rounded-full transition-opacity ${
                        activeTab === "result" ? "bg-accent-primary opacity-100" : "opacity-0"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("logs")}
                    className={`relative min-w-28 px-4 py-3 text-[11px] uppercase tracking-[0.18em] transition-colors ${
                      activeTab === "logs"
                        ? "text-text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    Logs
                    <span
                      className={`absolute inset-x-4 bottom-0 h-0.5 rounded-full transition-opacity ${
                        activeTab === "logs" ? "bg-accent-primary opacity-100" : "opacity-0"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("error")}
                    className={`relative min-w-28 px-4 py-3 text-[11px] uppercase tracking-[0.18em] transition-colors ${
                      activeTab === "error"
                        ? "text-text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    Error
                    <span
                      className={`absolute inset-x-4 bottom-0 h-0.5 rounded-full transition-opacity ${
                        activeTab === "error" ? "bg-accent-primary opacity-100" : "opacity-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col rounded-[1rem] border border-border-default bg-[#101114]">
                  <div className="flex items-center gap-2 border-b border-border-default px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                    <TerminalIcon className="h-4 w-4 text-accent-primary" />
                    {activeTab === "result" ? "Result Payload" : activeTab === "logs" ? "Saved Logs" : "Error Output"}
                  </div>

                  <div className="drawer-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    {isDetailLoading ? (
                      <p className="text-sm leading-7 text-text-subtle">Loading selected job...</p>
                    ) : activeTab === "result" ? (
                      selectedJobDetail?.result ? (
                        <pre className="whitespace-pre-wrap break-words rounded-[0.85rem] border border-border-default bg-[#0b0d10] p-4 text-xs leading-6 text-text-secondary [font-family:var(--font-geist-mono)]">
                          {JSON.stringify(selectedJobDetail.result, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-sm leading-7 text-text-subtle">No result payload for this job.</p>
                      )
                    ) : activeTab === "logs" ? (
                      savedLogs.length > 0 ? (
                        <ul className="divide-y divide-border-default">
                          {savedLogs.map((log) => (
                            <li
                              key={log.id}
                              className="grid grid-cols-[88px_56px_minmax(0,1fr)] items-start gap-3 py-3 text-xs leading-6 [font-family:var(--font-geist-mono)]"
                            >
                              <span className="text-text-muted/80 whitespace-nowrap">{formatLogTime(log.timestamp)}</span>
                              <span className={getLogProgressClass(log.progress, log.status)}>
                                {typeof log.progress === "number" ? `${log.progress}%` : "--"}
                              </span>
                              <p className="text-text-primary">{log.message}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm leading-7 text-text-subtle">No saved logs were recorded for this job.</p>
                      )
                    ) : selectedJobDetail?.error ? (
                      <pre className="whitespace-pre-wrap break-words rounded-[0.85rem] border border-danger/30 bg-danger/5 p-4 text-xs leading-6 text-danger [font-family:var(--font-geist-mono)]">
                        {selectedJobDetail.error}
                      </pre>
                    ) : (
                      <p className="text-sm leading-7 text-text-subtle">No error was recorded for this job.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.2rem] border border-border-default bg-bg-primary/80 p-6">
                <p className="text-sm leading-7 text-text-subtle">
                  Choose a run from the list and use the View Details button to open its sidebar.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

export function JobsScreen(props: JobsScreenProps) {
  return (
    <Suspense fallback={null}>
      <JobsScreenContent {...props} />
    </Suspense>
  );
}
