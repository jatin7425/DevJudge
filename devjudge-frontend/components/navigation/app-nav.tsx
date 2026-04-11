"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { GitHubIcon } from "@/components/auth/auth-content";
import { getLogoutUrl } from "@/lib/auth-backend";
import { TerminalIcon } from "@/components/dashboard/dashboard-frame";

type AppNavProps = {
  onOpenTerminal?: () => void;
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon, exact: true },
  { href: "/dashboard/analytics", label: "Analytics", icon: ChartBarIcon },
  { href: "/dashboard/jobs", label: "Jobs", icon: ClipboardDocumentListIcon },
  // { href: "/dashboard/settings", label: "Settings", icon: Cog6ToothIcon }, // Future feature
];

function isActive(pathname: string, href: string, exact = false): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ onOpenTerminal }: AppNavProps) {
  const pathname = usePathname();
  const logoutHref = getLogoutUrl();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border-default bg-bg-secondary p-4">
      {/* Brand/Logo Section */}
      <div className="flex items-center justify-center h-16 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 text-xl font-bold text-text-primary">
          <GitHubIcon className="h-7 w-7 text-accent-primary" />
          DevJudge
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-1 flex-col mt-6">
        <ul role="list" className="-mx-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            const Icon = item.icon;

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`group flex gap-3 rounded-md p-2 text-sm font-medium leading-6 transition-colors ${
                    active
                      ? "bg-accent-subtle text-accent-primary"
                      : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  }`}
                >
                  <Icon className={`h-6 w-6 shrink-0 ${active ? 'text-accent-primary' : 'text-text-muted group-hover:text-text-primary'}`} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4">
        <button
          type="button"
          onClick={onOpenTerminal}
          className="group flex w-full items-center gap-3 rounded-md border border-border-default bg-bg-primary/70 p-3 text-left text-sm font-medium text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
          title="Open Terminal (Ctrl+Shift+`)"
        >
          <TerminalIcon className="h-5 w-5 text-accent-primary" />
          <div className="min-w-0">
            <p className="text-sm text-text-primary">Terminal</p>
            <p className="truncate text-xs text-text-muted">Ctrl+Shift+`</p>
          </div>
        </button>
      </div>

      {/* User Profile/Logout Section */}
      <div className="border-t border-border-default pt-4">
        <div className="flex items-center gap-x-3 text-sm font-semibold leading-6 text-text-primary">
          <img
            className="h-8 w-8 rounded-full bg-bg-primary"
            src="https://avatars.githubusercontent.com/u/583231?v=4" // Placeholder avatar
            alt=""
          />
          <span className="sr-only">Your profile</span>
          <div className="flex flex-col">
            <span aria-hidden="true">Octocat</span> {/* Placeholder username */}
            <Link href={logoutHref} className="text-xs text-text-muted hover:text-accent-primary">Logout</Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Placeholder Icons - These would typically come from an icon library
function HomeIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function ChartBarIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125l2.25 2.25m0 0l2.25 2.25M5.25 15.375L7.5 17.625m0 0l2.25 2.25M9.75 19.875L12 22.125m0 0l2.25 2.25M14.25 24.375L16.5 26.625m0 0l2.25 2.25M21 12l-8.954-8.955c-.44-.439-1.152-.439-1.591 0L3 12M12 21.75V15" />
    </svg>
  );
}

function ClipboardDocumentListIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h.01M12 12h.01M15 12h.01M21 12c0 1.09-2.03 2.28-4.64 2.28S11.72 13.09 11.72 12c0-1.09 2.03-2.28 4.64-2.28S21 10.91 21 12zM2.5 12h.01M5 12h.01M7.5 12h.01M12 12h.01M15 12h.01M17.5 12h.01M20 12h.01M22.5 12h.01" />
    </svg>
  );
}

