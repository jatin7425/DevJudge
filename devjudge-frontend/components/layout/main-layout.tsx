"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/navigation/app-nav";
import { PageHeader } from "@/components/navigation/page-header";
import { LogTerminal } from "@/components/terminal/log-terminal";
import {
  TerminalProvider,
  type TerminalRequest,
  type TerminalStartedAnalysis,
} from "@/components/terminal/terminal-context";

type MainLayoutProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  actions?: ReactNode;
};

export function MainLayout({ children, eyebrow, title, actions }: MainLayoutProps) {
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalRequest, setTerminalRequest] = useState<TerminalRequest | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.code === "Backquote") {
        event.preventDefault();
        setIsTerminalOpen(true);
        setTerminalRequest({
          kind: "open",
          nonce: Date.now(),
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const terminalController = useMemo(() => ({
    openTerminal: () => {
      setIsTerminalOpen(true);
      setTerminalRequest({
        kind: "open",
        nonce: Date.now(),
      });
    },
    openTerminalWithStartedAnalysis: (started: TerminalStartedAnalysis) => {
      setIsTerminalOpen(true);
      setTerminalRequest({
        kind: "started-analysis",
        nonce: Date.now(),
        started,
      });
    },
  }), []);

  return (
    <TerminalProvider value={terminalController}>
      <>
        <AppNav onOpenTerminal={terminalController.openTerminal} />
        <div className="lg:pl-64 flex flex-col"> {/* Adjust padding based on sidebar width */}
          <PageHeader eyebrow={eyebrow} title={title} actions={actions} />
          <main className="flex-1 p-8"> {/* Main content area padding */}
            {children}
          </main>
        </div>
        <button
          type="button"
          onClick={terminalController.openTerminal}
          className="fixed bottom-5 right-5 z-[55] inline-flex items-center gap-2 rounded-full border border-border-accent bg-[#111214]/95 px-4 py-3 text-sm text-text-primary shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur md:hidden"
        >
          Open Terminal
        </button>
        <LogTerminal
          isOpen={isTerminalOpen}
          onClose={() => setIsTerminalOpen(false)}
          request={terminalRequest}
        />
      </>
    </TerminalProvider>
  );
}
