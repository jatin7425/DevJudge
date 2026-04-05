import { authHighlights, authStats, GitHubIcon } from "./auth-content";
import { getGitHubSignInUrl } from "@/lib/auth-backend";

type AuthPageProps = {
  fontsClassName: string;
};

export function OriginalAuthPage({ fontsClassName }: AuthPageProps) {
  const signInHref = getGitHubSignInUrl();

  return (
    <main
      className={`${fontsClassName} relative flex min-h-screen overflow-hidden bg-bg-primary px-4 py-4 sm:px-6 sm:py-8 lg:px-10 lg:py-10`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(88,166,255,0.10),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_22%)]" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col overflow-hidden rounded-[1.75rem] border border-border-default bg-bg-secondary lg:min-h-[44rem] lg:flex-row">
        <div className="flex flex-1 flex-col justify-between border-b border-border-default p-6 [font-family:var(--font-dm-mono)] sm:p-8 lg:border-b-0 lg:border-r lg:p-12 xl:p-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border-muted bg-bg-primary px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-accent-primary" />
              Original experience
            </div>

            <h1 className="mt-8 max-w-3xl text-[clamp(2.2rem,7vw,5rem)] leading-[1] tracking-[-0.04em] text-text-primary [font-family:var(--font-syne)]">
              Developer scoring
              <br />
              with a cleaner entry.
            </h1>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base sm:leading-8">
              This is the original DevJudge auth variant. It keeps the same
              product promise, but presents a quieter entry point for users who
              prefer a more classic login flow.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:mt-12">
            {authStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border-muted bg-bg-primary px-4 py-4"
              >
                <div className="text-2xl text-text-primary [font-family:var(--font-syne)]">
                  {stat.value}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-text-subtle">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col justify-center p-6 [font-family:var(--font-dm-mono)] sm:p-8 lg:max-w-[34rem] lg:p-12 xl:p-16">
          <div className="rounded-[1.5rem] border border-border-muted bg-bg-primary p-5 shadow-[0_22px_60px_rgba(0,0,0,0.3)] sm:p-7">
            <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">
              Secure login
            </div>

            <h2 className="mt-4 text-3xl leading-tight text-text-primary [font-family:var(--font-syne)]">
              Sign in to DevJudge
            </h2>

            <p className="mt-3 text-sm leading-7 text-text-subtle">
              Connect your GitHub account to unlock profile scoring, repository
              insights, and consistency tracking in one place.
            </p>

            <a
              href={signInHref}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-accent-primary bg-accent-primary px-5 py-4 text-base font-bold text-bg-primary transition-colors hover:bg-accent-hover [font-family:var(--font-syne)]"
            >
              <GitHubIcon className="h-5 w-5" />
              Login with GitHub
            </a>

            <div className="mt-6 rounded-xl border border-border-default bg-bg-secondary p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">
                What gets analyzed
              </div>
              <div className="mt-4 space-y-3">
                {authHighlights.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-accent-primary" />
                    <span className="text-xs leading-6 text-text-secondary">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-5 text-xs leading-6 text-text-muted">
              Feature-flagged variant: set
              <code className="mx-1 rounded bg-bg-secondary px-1.5 py-0.5 text-text-secondary">
                DEVJUDGE_AUTH_EXPERIENCE=original
              </code>
              to keep this experience live.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
