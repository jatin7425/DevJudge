"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  DashboardFrame,
  DashboardPanel,
  MetricCard,
  StatusPill,
  TerminalIcon,
} from "@/components/dashboard/dashboard-frame";
import { type JobStats, type JobSummary, fetchJobStats, fetchJobsHistory } from "@/lib/dashboard-api";

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

export function JobsScreen() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobSummary | null>(null);
  const [activeTab, setActiveTab] = useState<"result" | "error">("result");

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

  return (
    <DashboardFrame
      eyebrow="Analysis Jobs"
      title="Job History"
      description="A matching jobs page that renders the analysis list, status badges, and raw payloads for each run."
      actions={(
        <Link
          href="/dashboard"
          className="rounded-full border border-border-muted px-4 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
        >
          Back to Dashboard
        </Link>
      )}
    >
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.95fr)]">
        <DashboardPanel title="Rendered Job List" eyebrow="History">
          {jobs.length === 0 ? (
            <p className="text-sm leading-7 text-text-subtle">
              No analysis jobs have been recorded yet. Trigger a run from the dashboard and the list will render here.
            </p>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <button
                  key={job.job_id}
                  type="button"
                  onClick={() => {
                    setSelectedJob(job);
                    setActiveTab(job.error ? "error" : "result");
                  }}
                  className={`w-full rounded-[1.2rem] border p-4 text-left transition-all ${
                    selectedJob?.job_id === job.job_id
                      ? "border-border-accent bg-accent-subtle"
                      : "border-border-default bg-bg-primary/80 hover:border-border-muted hover:bg-bg-primary"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill label={job.job_status} tone={getStatusTone(job.job_status)} />
                        {job.error ? <StatusPill label="Has Error" tone="danger" /> : null}
                      </div>
                      <p className="mt-3 break-all text-xs text-text-muted [font-family:var(--font-dm-mono)]">
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
                </button>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title={selectedJob ? "Job Details" : "Select a job"}
          eyebrow="Inspector"
          action={selectedJob ? <StatusPill label={selectedJob.job_status} tone={getStatusTone(selectedJob.job_status)} /> : null}
        >
          {selectedJob ? (
            <div className="space-y-4">
              <div className="rounded-[1rem] border border-border-default bg-bg-primary/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Job ID</p>
                <p className="mt-2 break-all text-xs text-text-secondary [font-family:var(--font-dm-mono)]">
                  {selectedJob.job_id}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("result")}
                  className={`rounded-full px-3 py-2 text-[11px] uppercase tracking-[0.16em] ${
                    activeTab === "result" ? "bg-bg-secondary text-text-primary" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Result
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("error")}
                  className={`rounded-full px-3 py-2 text-[11px] uppercase tracking-[0.16em] ${
                    activeTab === "error" ? "bg-bg-secondary text-text-primary" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Error
                </button>
              </div>

              <div className="rounded-[1.1rem] border border-border-default bg-[#0b0f14] p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-muted">
                  <TerminalIcon className="h-4 w-4 text-accent-primary" />
                  Payload
                </div>

                <div className="mt-4 max-h-[34rem] overflow-auto">
                  {activeTab === "result" ? (
                    selectedJob.result ? (
                      <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-text-secondary [font-family:var(--font-dm-mono)]">
                        {JSON.stringify(selectedJob.result, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-sm leading-7 text-text-subtle">No result payload for this job.</p>
                    )
                  ) : selectedJob.error ? (
                    <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-danger [font-family:var(--font-dm-mono)]">
                      {selectedJob.error}
                    </pre>
                  ) : (
                    <p className="text-sm leading-7 text-text-subtle">No error was recorded for this job.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-7 text-text-subtle">
              Pick any row from the rendered job list to inspect the full result payload or error output here.
            </p>
          )}
        </DashboardPanel>
      </div>
    </DashboardFrame>
  );
}
