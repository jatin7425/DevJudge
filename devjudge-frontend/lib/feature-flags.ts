export const AUTH_EXPERIENCES = ["beta", "original"] as const;

export type AuthExperience = (typeof AUTH_EXPERIENCES)[number];

const DEFAULT_AUTH_EXPERIENCE: AuthExperience = "beta";

function isAuthExperience(value: string): value is AuthExperience {
  return AUTH_EXPERIENCES.includes(value as AuthExperience);
}

export function getAuthExperience(): AuthExperience {
  const rawValue =
    process.env.DEVJUDGE_AUTH_EXPERIENCE ??
    process.env.NEXT_PUBLIC_DEVJUDGE_AUTH_EXPERIENCE ??
    DEFAULT_AUTH_EXPERIENCE;

  return isAuthExperience(rawValue) ? rawValue : DEFAULT_AUTH_EXPERIENCE;
}
