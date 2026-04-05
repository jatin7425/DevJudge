import { getDashboardUrl, getStartAnalysisUrl } from "@/lib/auth-backend";

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

export function startInitialAnalysis(): Promise<DashboardResult> {
  return readDashboardResponse(getStartAnalysisUrl(), {
    method: "POST",
  });
}
