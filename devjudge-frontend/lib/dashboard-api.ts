import {
  getAuthBackendUrl,
  getActiveAnalysisUrl,
  getAnalysisEventsUrl,
  getAnalysisJobUrl,
  getAnalysisJobsUrl,
  getAnalysisStatsUrl,
  getLatestSuccessAnalysisUrl,
  getDashboardUrl,
  getStartAnalysisUrl,
} from "@/lib/auth-backend";

export type DashboardState = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  hasInitialData: boolean;
  analysisRequested: boolean;
};

type AuthenticatedDashboardResponse = {
  authenticated: true;
  dashboard: DashboardState;
};

type UnauthenticatedDashboardResponse = {
  authenticated: false;
};

type DashboardResponse =
  | AuthenticatedDashboardResponse
  | UnauthenticatedDashboardResponse;

export type DashboardResult =
  | { kind: "authenticated"; dashboard: DashboardState }
  | { kind: "unauthenticated" }
  | { kind: "missing" };

export type StartAnalysisResult =
  | { kind: "started"; jobId: string; status: string; position: number | null; streamUrl: string; steps: Record<string, unknown> }
  | { kind: "unauthenticated" }
  | { kind: "missing" };

export type JobSummary = {
  job_id: string;
  job_status: string;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  meta: Record<string, unknown>;
  steps: Record<string, unknown>;
  result?: Record<string, unknown> | null;
};

export type JobLogEvent = {
  id: number;
  job_id: string;
  message: string;
  progress?: number | null;
  status?: string | null;
  timestamp: string;
};

export type JobStats = {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
};

type StartAnalysisResponse = {
  success: boolean;
  message: string;
  data?: {
    job_id: string;
    status: string;
    job_status?: string;
    position: number | null;
    stream_url?: string;
    steps?: Record<string, unknown>;
  };
};

type ActiveAnalysisResponse = {
  success: boolean;
  message: string;
  data: {
    job_id: string;
    status: string;
    job_status?: string;
    position: number | null;
    stream_url?: string;
    steps?: Record<string, unknown>;
  } | null;
};

type JobsHistoryResponse = {
  success: boolean;
  data?: {
    jobs: JobSummary[];
  };
};

type JobStatsResponse = {
  success: boolean;
  data?: JobStats;
};

type LatestSuccessResponse = {
  success: boolean;
  data?: JobSummary | null;
};

type JobDetailResponse = {
  success: boolean;
  data?: JobSummary | null;
};

function resolveAnalysisStreamUrl(url: string, jobId: string): string {
  if (!url) {
    return getAnalysisEventsUrl(jobId);
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const base = getAuthBackendUrl();
  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return `${base}${normalizedPath}`;
}

async function parseDashboardResponse(
  response: Response,
): Promise<DashboardResponse> {
  return (await response.json()) as DashboardResponse;
}

async function readDashboardResponse(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<DashboardResult> {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) {
    return { kind: "unauthenticated" };
  }

  if (response.status === 404) {
    return { kind: "missing" };
  }

  if (!response.ok) {
    throw new Error(`Dashboard request failed with status ${response.status}`);
  }

  const payload = await parseDashboardResponse(response);

  if (!payload.authenticated) {
    return { kind: "unauthenticated" };
  }

  return {
    kind: "authenticated",
    dashboard: payload.dashboard,
  };
}

export function fetchDashboardState(): Promise<DashboardResult> {
  return readDashboardResponse(getDashboardUrl());
}

export async function startInitialAnalysis(): Promise<StartAnalysisResult> {
  const response = await fetch(getStartAnalysisUrl(), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) {
    return { kind: "unauthenticated" };
  }

  if (response.status === 404) {
    return { kind: "missing" };
  }

  if (!response.ok) {
    throw new Error(`Start analysis failed with status ${response.status}`);
  }

  const payload = (await response.json()) as StartAnalysisResponse;
  const data = payload.data;

  if (!payload.success || !data?.job_id) {
    throw new Error(payload.message || "Unexpected start analysis response.");
  }

  return {
    kind: "started",
    jobId: data.job_id,
    status: data.job_status || data.status,
    position: data.position ?? null,
    streamUrl: resolveAnalysisStreamUrl(data.stream_url ?? "", data.job_id),
    steps: data.steps ?? {},
  };
}

export async function fetchActiveAnalysis(): Promise<StartAnalysisResult | { kind: "none" }> {
  const response = await fetch(getActiveAnalysisUrl(), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) {
    return { kind: "unauthenticated" };
  }

  if (response.status === 404) {
    return { kind: "missing" };
  }

  if (!response.ok) {
    throw new Error(`Active analysis request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ActiveAnalysisResponse;
  if (!payload.success) {
    throw new Error(payload.message || "Unexpected active analysis response.");
  }

  if (!payload.data?.job_id) {
    return { kind: "none" };
  }

  return {
    kind: "started",
    jobId: payload.data.job_id,
    status: payload.data.job_status || payload.data.status,
    position: payload.data.position ?? null,
    streamUrl: resolveAnalysisStreamUrl(
      payload.data.stream_url ?? "",
      payload.data.job_id,
    ),
    steps: payload.data.steps ?? {},
  };
}

export async function fetchJobsHistory(limit = 20): Promise<JobSummary[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(`${getAnalysisJobsUrl()}?${query.toString()}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Jobs history request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as JobsHistoryResponse;
  if (!payload.success) {
    throw new Error("Jobs history response unsuccessful.");
  }

  return payload.data?.jobs ?? [];
}

export async function fetchJobStats(): Promise<JobStats> {
  const response = await fetch(getAnalysisStatsUrl(), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Job stats request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as JobStatsResponse;
  if (!payload.success || !payload.data) {
    throw new Error("Job stats response unsuccessful.");
  }

  return payload.data;
}

export async function fetchJobDetail(jobId: string): Promise<JobSummary | null> {
  const response = await fetch(getAnalysisJobUrl(jobId), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Job detail request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as JobDetailResponse;
  if (!payload.success) {
    throw new Error("Job detail response unsuccessful.");
  }

  return payload.data ?? null;
}

export async function fetchLatestSuccessfulJob(): Promise<JobSummary | null> {
  const response = await fetch(getLatestSuccessAnalysisUrl(), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Latest successful job request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as LatestSuccessResponse;
  if (!payload.success) {
    throw new Error("Latest successful job response unsuccessful.");
  }

  return payload.data ?? null;
}
