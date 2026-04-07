"use client";

import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, actions }: PageHeaderProps) {
  return (
    <div className="relative flex items-center justify-between gap-4 border-b border-border-default px-5 py-4 sm:px-8 sm:py-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">{eyebrow}</p>
        <h1 className="mt-2 text-2xl text-text-primary [font-family:var(--font-syne)] sm:text-3xl">
          {title}
        </h1>
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
