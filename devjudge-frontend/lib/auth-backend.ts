const DEFAULT_AUTH_BACKEND_URL = "http://localhost:7071";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function getAuthBackendUrl(): string {
  console.log("AUTH_BACKEND_URL:", process.env?.AUTH_BACKEND_URL);
  console.log("NEXT_PUBLIC_AUTH_BACKEND_URL:", process.env?.NEXT_PUBLIC_AUTH_BACKEND_URL);
  return normalizeBaseUrl(
    process.env.AUTH_BACKEND_URL ??
      process.env.NEXT_PUBLIC_AUTH_BACKEND_URL ??
      DEFAULT_AUTH_BACKEND_URL,
  );
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

export function getLogoutUrl(): string {
  return `${getAuthBackendUrl()}/api/auth/logout`;
}
