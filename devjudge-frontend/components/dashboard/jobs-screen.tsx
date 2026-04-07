"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppNav } from "@/components/navigation/app-nav";
import { PageHeader } from "@/components/navigation/page-header";
import { type JobStats, type JobSummary, fetchJobStats, fetchJobsHistory } from "@/lib/dashboard-api";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border-default bg-bg-primary p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">{label}</p>
      <p className="mt-2 text-3xl text-text-primary [font-family:var(--font-syne)]">{value}</p>
    </div>
  );
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
        if (!mounted) return;
        setError("Could not load jobs right now.");
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="relative isolate min-h-[100dvh] overflow-hidden bg-bg-primary">
      <section className="w-full min-h-[100dvh] border border-border-default bg-bg-secondary/95">
        <PageHeader
          eyebrow="Analysis Jobs"
          title="Job History"
          actions={(
            <>
              <AppNav />
              <Link
                href="/dashboard"
                className="rounded-xl border border-border-muted px-4 py-2 text-sm text-text-secondary hover:border-border-accent hover:text-text-primary"
              >
                Back to Dashboard
              </Link>
            </>
          )}
        />

        <div className="px-5 py-5 sm:px-8 sm:py-8">
          {error ? <p className="text-sm text-danger">{error}</p> : null}

          {stats ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Total Jobs" value={stats.total} />
              <StatCard label="Queued" value={stats.queued} />
              <StatCard label="Running" value={stats.running} />
              <StatCard label="Completed" value={stats.completed} />
              <StatCard label="Failed" value={stats.failed} />
            </div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-2xl border border-border-default">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-primary/70 text-text-muted">
                <tr>
                  <th className="px-4 py-3">Job ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">Error</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.job_id} className="border-t border-border-default">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{job.job_id}</td>
                    <td className="px-4 py-3 text-text-primary">{job.job_status}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {job.created_at ? new Date(job.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-danger">{job.error ?? "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJob(job);
                          setActiveTab(job.error ? "error" : "result");
                        }}
                        className="rounded-lg border border-border-muted px-3 py-1 text-xs uppercase tracking-[0.12em] text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
                      >
                        Show Result
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedJob ? (
        <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-2xl border-l border-border-default bg-bg-primary/95 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Job Details</p>
              <p className="mt-1 font-mono text-xs text-text-secondary">{selectedJob.job_id}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedJob(null)}
              className="rounded-lg border border-border-muted px-3 py-1 text-xs uppercase tracking-[0.12em] text-text-secondary hover:text-text-primary"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("result")}
              className={`rounded-lg px-3 py-2 text-xs uppercase tracking-[0.14em] ${
                activeTab === "result"
                  ? "bg-bg-secondary text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Result
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("error")}
              className={`rounded-lg px-3 py-2 text-xs uppercase tracking-[0.14em] ${
                activeTab === "error"
                  ? "bg-bg-secondary text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Error
            </button>
          </div>

          <div className="mt-4 h-[calc(100vh-10rem)] overflow-auto rounded-xl border border-border-default bg-bg-secondary p-3">
            {activeTab === "result" ? (
              selectedJob.result ? (
                <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedJob.result, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-text-muted">No result payload for this job.</p>
              )
            ) : selectedJob.error ? (
              <pre className="text-xs text-danger whitespace-pre-wrap break-words">
                {selectedJob.error}
              </pre>
            ) : (
              <p className="text-sm text-text-muted">No error for this job.</p>
            )}
          </div>
        </aside>
      ) : null}
    </main>
  );
}
