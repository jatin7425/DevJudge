"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

export type TerminalStartedAnalysis = {
  jobId: string;
  status: string;
  streamUrl: string;
};

export type TerminalRequest =
  | {
      kind: "open";
      nonce: number;
    }
  | {
      kind: "started-analysis";
      nonce: number;
      started: TerminalStartedAnalysis;
    };

type TerminalController = {
  openTerminal: () => void;
  openTerminalWithStartedAnalysis: (started: TerminalStartedAnalysis) => void;
};

const TerminalContext = createContext<TerminalController | null>(null);

export function TerminalProvider({
  value,
  children,
}: {
  value: TerminalController;
  children: ReactNode;
}) {
  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export function useTerminalController() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error("useTerminalController must be used within a TerminalProvider.");
  }
  return context;
}
