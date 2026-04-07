const DEFAULT_AUTH_BACKEND_URL = "http://localhost:7071";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function getAuthBackendUrl(): string {
  console.log("AUTH_BACKEND_URL:", process.env?.AUTH_BACKEND_URL);
  console.log("NEXT_PUBLIC_AUTH_BACKEND_URL:", process.env?.NEXT_PUBLIC_AUTH_BACKEND_URL);
  const rawUrl =
    process.env.AUTH_BACKEND_URL ??
    process.env.NEXT_PUBLIC_AUTH_BACKEND_URL ??
    DEFAULT_AUTH_BACKEND_URL;
  console.log("Raw Auth Backend URL:", rawUrl);
  return normalizeBaseUrl(rawUrl);
}

export function getGitHubSignInUrl(): string {
  console.log("AUTH_BACKEND_URL:", getAuthBackendUrl());
  return `${getAuthBackendUrl()}/api/auth/github/signin`;
}

export function getDashboardUrl(): string {
  console.log("AUTH_BACKEND_URL:", getAuthBackendUrl());
  return `${getAuthBackendUrl()}/api/dashboard`;
}

export function getStartAnalysisUrl(): string {
  return `${getAuthBackendUrl()}/api/dashboard/analysis/start`;
}

export function getActiveAnalysisUrl(): string {
  return `${getAuthBackendUrl()}/api/dashboard/analysis/active`;
}

export function getAnalysisJobsUrl(): string {
  return `${getAuthBackendUrl()}/api/dashboard/analysis/jobs`;
}

export function getAnalysisStatsUrl(): string {
  return `${getAuthBackendUrl()}/api/dashboard/analysis/stats`;
}

export function getLatestSuccessAnalysisUrl(): string {
  return `${getAuthBackendUrl()}/api/dashboard/analysis/latest-success`;
}

export function getAnalysisEventsUrl(jobId: string): string {
  const query = new URLSearchParams({ job_id: jobId });
  return `${getAuthBackendUrl()}/api/dashboard/analysis/stream?${query.toString()}`;
}

export function getLogoutUrl(): string {
  return `${getAuthBackendUrl()}/api/auth/logout`;
}
