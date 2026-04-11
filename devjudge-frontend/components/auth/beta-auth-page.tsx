import { authHighlights, authStats, GitHubIcon } from "./auth-content";
import { getGitHubSignInUrl } from "@/lib/auth-backend";

export function BetaAuthPage() {
  const signInHref = getGitHubSignInUrl();

  return (
    <main
      className="relative isolate flex h-[100dvh] items-center justify-center overflow-hidden bg-bg-primary p-4 sm:p-6 lg:p-8 xl:p-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(140,97,255,0.1)_0%,transparent_50%),radial-gradient(circle_at_bottom_right,rgba(140,97,255,0.1)_0%,transparent_40%)]" />

      <section className="relative max-h-full w-full max-w-[120rem] overflow-hidden rounded-3xl border border-border-default bg-bg-secondary shadow-2xl">
        <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:40px_40px] xl:[background-size:48px_48px]" />
        <div className="pointer-events-none absolute left-1/2 top-[10%] h-[20rem] w-[20rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(140,97,255,0.1)_0%,transparent_70%)] blur-2xl sm:h-[28rem] sm:w-[28rem] xl:h-[36rem] xl:w-[36rem]" />
        <div className="pointer-events-none absolute -right-20 top-10 h-44 w-44 rounded-full border border-border-muted/60 opacity-70" />
        <div className="pointer-events-none absolute -left-10 bottom-8 h-28 w-28 rounded-full border border-border-muted/50 opacity-70" />

        <div className="relative grid gap-10 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,30rem)] lg:items-center lg:gap-14 lg:px-16 lg:py-16 xl:px-20 xl:py-20">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-primary/30 bg-accent-subtle px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-accent-primary">
              <span className="h-2 w-2 rounded-full bg-accent-primary animate-pulse" />
              Beta free to use
            </div>

            <h1 className="mt-7 max-w-4xl text-[clamp(2.8rem,8vw,7rem)] leading-[0.95] tracking-[-0.04em] text-text-primary font-semibold">
              Know your
              <br />
              <span className="text-accent-primary">GitHub score</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-text-subtle sm:text-lg sm:leading-8 xl:text-xl">
              DevJudge turns your GitHub profile into a sharp signal. It scores
              commits, consistency, repos, language depth, and momentum without
              burying the result in vanity numbers.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3 xl:max-w-3xl">
              {authStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border-default bg-bg-primary p-5"
                >
                  <div className="text-3xl font-bold text-text-primary">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm uppercase tracking-[0.15em] text-text-muted">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 max-w-xl text-sm leading-7 text-text-muted sm:text-base">
              Built for developers who want signal over noise. Connect GitHub,
              generate your score, and see where your profile is strong, weak,
              or quietly underpriced.
            </p>

            <div className="mt-12 hidden text-xs uppercase tracking-[0.2em] text-text-subtle lg:block">
              devjudge.app // beta
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-border-muted bg-bg-primary p-7 shadow-xl">
              <div className="rounded-xl border border-border-default bg-bg-secondary px-5 py-3 text-sm uppercase tracking-[0.18em] text-text-muted">
                Authentication
              </div>

              <h2 className="mt-7 text-3xl font-bold leading-tight text-text-primary">
                Login with GitHub
              </h2>

              <p className="mt-3 text-base leading-7 text-text-secondary">
                One click to import your public profile, pull repository
                activity, and start your DevJudge analysis.
              </p>

              <a
                href={signInHref}
                className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-accent-primary px-6 py-4 text-base font-bold text-white transition-all duration-200 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-accent"
              >
                <GitHubIcon className="h-5 w-5" />
                Continue with GitHub
              </a>

              <p className="mt-4 text-center text-xs leading-6 text-text-subtle">
                GitHub OAuth is handled by the DevJudge backend and lands you
                directly in the dashboard.
              </p>

              <div className="mt-8 space-y-4">
                {authHighlights.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-xl border border-border-default bg-bg-secondary px-5 py-4"
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-success" />
                    <span className="text-sm leading-6 text-text-secondary">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-xl border border-border-default bg-bg-secondary px-5 py-4">
                <div className="text-sm uppercase tracking-[0.18em] text-text-muted">
                  Access scope
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.1em] text-text-secondary">
                  <span className="rounded-full border border-border-muted px-4 py-2">
                    public repos
                  </span>
                  <span className="rounded-full border border-border-muted px-4 py-2">
                    commit graph
                  </span>
                  <span className="rounded-full border border-border-muted px-4 py-2">
                    profile metadata
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
