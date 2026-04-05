import { authHighlights, authStats, GitHubIcon } from "./auth-content";
import { getGitHubSignInUrl } from "@/lib/auth-backend";

type AuthPageProps = {
  fontsClassName: string;
};

export function BetaAuthPage({ fontsClassName }: AuthPageProps) {
  const signInHref = getGitHubSignInUrl();

  return (
    <main
      className={`${fontsClassName} relative isolate flex h-[100dvh] items-center justify-center overflow-hidden bg-bg-primary p-3 sm:p-6 lg:p-8 xl:p-10 2xl:p-12`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,166,255,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(188,140,255,0.14),transparent_30%)]" />

      <section className="relative max-h-full w-full max-w-[112rem] overflow-hidden rounded-[1.5rem] border border-border-default bg-bg-secondary shadow-[0_28px_120px_rgba(0,0,0,0.5)] sm:rounded-[2rem]">
        <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:32px_32px] sm:[background-size:40px_40px] xl:[background-size:48px_48px]" />
        <div className="pointer-events-none absolute left-1/2 top-[18%] h-[18rem] w-[18rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(88,166,255,0.16)_0%,transparent_70%)] blur-2xl sm:h-[24rem] sm:w-[24rem] xl:h-[32rem] xl:w-[32rem]" />
        <div className="pointer-events-none absolute -right-20 top-10 h-44 w-44 rounded-full border border-border-muted/60" />
        <div className="pointer-events-none absolute -left-10 bottom-8 h-28 w-28 rounded-full border border-border-muted/50" />

        <div className="relative grid gap-8 px-4 py-5 [font-family:var(--font-dm-mono)] sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(21rem,28rem)] lg:items-center lg:gap-12 lg:px-12 lg:py-14 xl:px-16 xl:py-16 2xl:px-20 2xl:py-20">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-primary/25 bg-accent-subtle px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-accent-primary">
              <span className="h-2 w-2 rounded-full bg-accent-primary animate-pulse" />
              Beta free to use
            </div>

            <h1 className="mt-6 max-w-4xl text-[clamp(2.4rem,8vw,6.5rem)] leading-[0.95] tracking-[-0.04em] text-text-primary [font-family:var(--font-syne)]">
              Know your
              <br />
              <span className="text-accent-primary">GitHub score</span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-text-subtle sm:text-base sm:leading-8 xl:text-lg">
              DevJudge turns your GitHub profile into a sharp signal. It scores
              commits, consistency, repos, language depth, and momentum without
              burying the result in vanity numbers.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3 xl:max-w-3xl">
              {authStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-border-muted bg-bg-primary/80 px-4 py-4"
                >
                  <div className="text-2xl text-text-primary [font-family:var(--font-syne)] sm:text-[1.75rem]">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-text-subtle">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 max-w-xl text-xs leading-6 text-text-muted sm:text-sm">
              Built for developers who want signal over noise. Connect GitHub,
              generate your score, and see where your profile is strong, weak,
              or quietly underpriced.
            </p>

            <div className="mt-10 hidden text-[11px] uppercase tracking-[0.24em] text-text-muted lg:block">
              devjudge.app // beta
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[1.5rem] border border-border-muted bg-bg-primary p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-6 xl:p-7">
              <div className="rounded-2xl border border-border-default bg-bg-secondary px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-text-muted">
                Authentication
              </div>

              <h2 className="mt-6 text-3xl leading-tight text-text-primary [font-family:var(--font-syne)]">
                Login with GitHub
              </h2>

              <p className="mt-3 text-sm leading-7 text-text-subtle">
                One click to import your public profile, pull repository
                activity, and start your DevJudge analysis.
              </p>

              <a
                href={signInHref}
                className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-btn-primary px-5 py-4 text-base font-bold text-bg-primary transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-accent [font-family:var(--font-syne)]"
              >
                <GitHubIcon className="h-5 w-5" />
                Continue with GitHub
              </a>

              <p className="mt-3 text-center text-xs leading-6 text-text-subtle">
                GitHub OAuth is handled by the DevJudge backend and lands you
                directly in the dashboard.
              </p>

              <div className="mt-6 space-y-3">
                {authHighlights.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-xl border border-border-default bg-bg-secondary px-4 py-3"
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-success" />
                    <span className="text-xs leading-6 text-text-secondary">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-border-default bg-bg-secondary px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
                  Access scope
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-text-secondary">
                  <span className="rounded-full border border-border-muted px-3 py-2">
                    public repos
                  </span>
                  <span className="rounded-full border border-border-muted px-3 py-2">
                    commit graph
                  </span>
                  <span className="rounded-full border border-border-muted px-3 py-2">
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
