"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode, SVGProps } from "react";

type DashboardFrameProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  sidebarFooter?: ReactNode;
};

type PanelProps = {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

type MetricCardProps = {
  label: string;
  value: string | number;
  subtitle: string;
  tone?: "default" | "success" | "warning" | "danger";
};

type StatusPillProps = {
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
};

type IconProps = SVGProps<SVGSVGElement>;

type NavItem = {
  href: string;
  label: string;
  caption: string;
  icon: (props: IconProps) => ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    caption: "Run and monitor",
    icon: LayoutGridIcon,
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    caption: "Scores and insights",
    icon: SparkBarsIcon,
  },
  {
    href: "/dashboard/jobs",
    label: "Jobs",
    caption: "History and payloads",
    icon: StackedCardsIcon,
  },
];

function joinClassNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardFrame({
  eyebrow,
  title,
  description,
  actions,
  children,
  sidebarFooter,
}: DashboardFrameProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-bg-primary text-text-primary">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(88,166,255,0.18),transparent_26%),radial-gradient(circle_at_80%_20%,rgba(63,185,80,0.08),transparent_18%),radial-gradient(circle_at_bottom_right,rgba(210,153,34,0.1),transparent_24%)]" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-[1680px]">
        <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 overflow-y-auto border-r border-border-default bg-[linear-gradient(180deg,rgba(13,17,23,0.98),rgba(22,27,34,0.98))] px-5 py-6 lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border-muted bg-bg-secondary text-accent-primary shadow-[0_0_24px_rgba(88,166,255,0.14)]">
              <SignalIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-text-primary [font-family:var(--font-syne)]">
                DevJudge
              </p>
              <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
                Analysis Console
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[1.35rem] border border-border-default bg-bg-secondary/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
              Workspace
            </p>
            <p className="mt-3 text-lg text-text-primary [font-family:var(--font-syne)]">
              GitHub Intelligence
            </p>
            <p className="mt-2 text-sm leading-6 text-text-subtle">
              Start with Overview. Run analysis, wait for completion, then open
              Analytics for the readable report.
            </p>
          </div>

          <nav className="mt-8 space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={joinClassNames(
                    "group flex items-center gap-3 rounded-[1.15rem] border px-3 py-3 transition-all",
                    active
                      ? "border-border-accent bg-accent-subtle text-text-primary shadow-[0_12px_40px_rgba(88,166,255,0.08)]"
                      : "border-transparent text-text-secondary hover:border-border-muted hover:bg-bg-secondary/80 hover:text-text-primary",
                  )}
                >
                  <div
                    className={joinClassNames(
                      "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                      active
                        ? "border-border-accent bg-bg-primary text-accent-primary"
                        : "border-border-default bg-bg-primary/70 text-text-muted group-hover:text-text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="truncate text-xs text-text-muted">{item.caption}</p>
                  </div>

                  {active ? (
                    <div className="ml-auto h-8 w-1 rounded-full bg-accent-primary" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-[1.2rem] border border-border-default bg-bg-primary/80 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-muted">
              <PulseIcon className="h-4 w-4 text-success" />
              How To Use
            </div>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
              <li>1. Click Run Analysis on Overview.</li>
              <li>2. Watch the live logs until the run finishes.</li>
              <li>3. Open Analytics to review the report.</li>
              <li>4. Use Jobs only when you need history or raw payloads.</li>
            </ol>
          </div>

          <div className="mt-auto space-y-4 pt-6">
            <div className="rounded-[1.2rem] border border-border-default bg-bg-primary/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-muted">
                <PulseIcon className="h-4 w-4 text-success" />
                Session
              </div>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Live status updates are shown here when a pipeline run is active.
              </p>
            </div>

            {sidebarFooter}
          </div>
        </aside>

        <section className="relative flex min-h-[100dvh] min-w-0 flex-1 flex-col border-l border-border-default/30 bg-[linear-gradient(180deg,rgba(13,17,23,0.74),rgba(13,17,23,0.96))]">
          <header className="border-b border-border-default bg-bg-primary/75 px-5 py-5 backdrop-blur sm:px-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] uppercase tracking-[0.26em] text-text-muted">
                  {eyebrow}
                </p>
                <h1 className="mt-3 text-3xl text-text-primary [font-family:var(--font-syne)] sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-text-subtle sm:text-base">
                  {description}
                </p>
              </div>

              {actions ? (
                <div className="flex flex-wrap items-center gap-3">{actions}</div>
              ) : null}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-8">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

export function DashboardPanel({
  title,
  eyebrow,
  action,
  children,
  className,
}: PanelProps) {
  return (
    <section
      className={joinClassNames(
        "rounded-[1.6rem] border border-border-default bg-[linear-gradient(180deg,rgba(22,27,34,0.96),rgba(13,17,23,0.92))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)] sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 text-lg text-text-primary [font-family:var(--font-syne)]">
            {title}
          </h2>
        </div>
        {action}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  subtitle,
  tone = "default",
}: MetricCardProps) {
  const toneClassName = {
    default: "text-text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];

  return (
    <div className="rounded-[1.35rem] border border-border-default bg-bg-primary/85 p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">{label}</p>
      <p className={joinClassNames("mt-3 text-3xl [font-family:var(--font-syne)]", toneClassName)}>
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-text-subtle">{subtitle}</p>
    </div>
  );
}

export function StatusPill({ label, tone = "default" }: StatusPillProps) {
  const toneClassName = {
    default: "border-border-muted bg-bg-secondary text-text-secondary",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
    danger: "border-danger/40 bg-danger/10 text-danger",
    accent: "border-border-accent bg-accent-subtle text-accent-primary",
  }[tone];

  return (
    <span
      className={joinClassNames(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em]",
        toneClassName,
      )}
    >
      {label}
    </span>
  );
}

export function LayoutGridIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function StackedCardsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M7 4.5h10a2.5 2.5 0 0 1 2.5 2.5v10" />
      <rect x="4" y="7" width="13" height="13" rx="2.5" />
      <path d="M8 11h5" />
      <path d="M8 15h6" />
    </svg>
  );
}

export function SignalIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 19a8 8 0 0 1 16 0" />
      <path d="M7.5 19a4.5 4.5 0 0 1 9 0" />
      <path d="M11.95 18.95h.1" strokeLinecap="round" />
    </svg>
  );
}

export function PulseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 12h4l2-5 4 10 2-5h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 6.2c0-1.06 1.16-1.72 2.08-1.18l7.02 4.08a1.37 1.37 0 0 1 0 2.37l-7.02 4.08A1.37 1.37 0 0 1 8 14.38V6.2Z" />
    </svg>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="m7.5 9 2.5 2.5L7.5 14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 14h4" strokeLinecap="round" />
    </svg>
  );
}

export function SparkBarsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 19V9" strokeLinecap="round" />
      <path d="M12 19V5" strokeLinecap="round" />
      <path d="M19 19v-7" strokeLinecap="round" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
    </svg>
  );
}

export function BranchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="7" cy="6" r="2.5" />
      <circle cx="17" cy="18" r="2.5" />
      <circle cx="17" cy="6" r="2.5" />
      <path d="M9.5 6h5" />
      <path d="M7 8.5v5a4.5 4.5 0 0 0 4.5 4.5h3" />
    </svg>
  );
}

export function UserBadgeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 4 3.8 18.5a1 1 0 0 0 .87 1.5h14.66a1 1 0 0 0 .87-1.5L12 4Z" />
      <path d="M12 9v4.5" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m6 6 12 12" strokeLinecap="round" />
      <path d="m18 6-12 12" strokeLinecap="round" />
    </svg>
  );
}
