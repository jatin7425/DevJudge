import { authHighlights, authStats, GitHubIcon } from "./auth-content";
import { getGitHubSignInUrl } from "@/lib/auth-backend";

export function OriginalAuthPage() {
  const signInHref = getGitHubSignInUrl();

  return (
    <main
      className="relative flex h-[100dvh] overflow-hidden bg-bg-primary p-4 sm:p-6 lg:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(140,97,255,0.1)_0%,transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_22%)]" />

      <section className="relative mx-auto flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border-default bg-bg-secondary shadow-2xl lg:min-h-[48rem] lg:flex-row">
        <div className="flex flex-1 flex-col justify-between border-b border-border-default p-8 sm:p-10 lg:border-b-0 lg:border-r lg:p-14 xl:p-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border-muted bg-bg-primary px-4 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-accent-primary" />
              Original experience
            </div>

            <h1 className="mt-8 max-w-3xl text-[clamp(2.5rem,7vw,5.5rem)] leading-[1] tracking-[-0.04em] text-text-primary font-semibold">
              Developer scoring
              <br />
              with a cleaner entry.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-text-subtle sm:text-lg sm:leading-8">
              This is the original DevJudge auth variant. It keeps the same
              product promise, but presents a quieter entry point for users who
              prefer a more classic login flow.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:mt-14">
            {authStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border-muted bg-bg-primary p-5"
              >
                <div className="text-3xl text-text-primary font-bold">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm uppercase tracking-[0.15em] text-text-subtle">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col justify-center p-8 sm:p-10 lg:max-w-[36rem] lg:p-14 xl:p-16">
          <div className="rounded-2xl border border-border-muted bg-bg-primary p-7 shadow-xl">
            <div className="text-sm uppercase tracking-[0.18em] text-text-muted">
              Secure login
            </div>

            <h2 className="mt-4 text-3xl font-bold leading-tight text-text-primary">
              Sign in to DevJudge
            </h2>

            <p className="mt-3 text-base leading-7 text-text-secondary">
              Connect your GitHub account to unlock profile scoring, repository
              insights, and consistency tracking in one place.
            </p>

            <a
              href={signInHref}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-accent-primary px-6 py-4 text-base font-bold text-white transition-all duration-200 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-accent"
            >
              <GitHubIcon className="h-5 w-5" />
              Login with GitHub
            </a>

            <div className="mt-6 rounded-xl border border-border-default bg-bg-secondary p-5">
              <div className="text-sm uppercase tracking-[0.18em] text-text-muted">
                What gets analyzed
              </div>
              <div className="mt-4 space-y-4">
                {authHighlights.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-primary" />
                    <span className="text-sm leading-6 text-text-secondary">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-5 text-xs leading-6 text-text-subtle">
              Feature-flagged variant: set
              <code className="mx-1 rounded bg-bg-secondary px-1.5 py-0.5 text-text-secondary font-mono">
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
