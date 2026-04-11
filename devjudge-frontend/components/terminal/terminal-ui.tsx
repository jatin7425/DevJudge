"use client";

import React, { useState } from "react";
import { TerminalIcon, XIcon } from "@/components/dashboard/dashboard-frame";

// Inline VS Code style icons to avoid lucide-react dependency
const MaximizeIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="10" height="10" />
  </svg>
);

const MinimizeIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="5" width="8" height="8" />
    <path d="M5 3h8v8" />
  </svg>
);

type TerminalUIProps = {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "half" | "full";
};

export function TerminalUI({ isOpen, onClose, initialMode = "half" }: TerminalUIProps) {
  const [mode, setMode] = useState<"half" | "full">(initialMode);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[100] flex flex-col bg-[#1e1e1e] font-mono shadow-2xl transition-all duration-200 ease-in-out
        ${mode === "full" ? "h-screen" : "h-[45vh]"}
        rounded-none border-t border-[#333]
      `}
    >
      {/* VS Code Style Header/Tab Bar */}
      <div className="flex items-center justify-between border-b border-[#333] bg-[#252526] px-3">
        <div className="flex h-9 items-center gap-6">
          <div className="flex h-full items-center gap-2 border-b border-accent-primary px-1 text-[11px] font-medium uppercase tracking-wider text-white">
            <TerminalIcon className="h-3.5 w-3.5 text-accent-primary" />
            Terminal
          </div>
          <button className="text-[11px] uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors">
            Output
          </button>
          <button className="text-[11px] uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors">
            Debug Console
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode(mode === "full" ? "half" : "full")}
            className="flex h-7 w-7 items-center justify-center text-text-muted hover:bg-[#333] hover:text-white transition-all"
            title={mode === "full" ? "Restore" : "Maximize Panel Size"}
          >
            {mode === "full" ? <MinimizeIcon className="h-3.5 w-3.5" /> : <MaximizeIcon className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center text-text-muted hover:bg-[#e81123] hover:text-white transition-all"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Terminal Content Area */}
      <div className="flex-1 overflow-auto bg-[#0c0c0c] p-4 text-[13px] leading-relaxed text-gray-300 selection:bg-accent-primary/30">
        <div className="space-y-1">
          <div className="text-text-muted">Terminal initialized... type 'help' for commands.</div>
          <div className="flex items-start gap-2">
            <span className="flex items-center text-green-400">
              devjudge@next-app
              <span className="text-gray-500 mx-1">:</span>
              <span className="text-blue-400">~/dashboard</span>
              <span className="text-gray-500 ml-1">$</span>
            </span>
            <span className="flex-1 outline-none caret-white" contentEditable spellCheck={false}>
              npm run analyze --verbose
            </span>
          </div>
          <div className="text-yellow-500/80 mt-2">[info] Fetching GitHub profile data...</div>
          <div className="text-blue-400">[log] processing 15 repositories...</div>
          
          {/* Blinking Cursor Simulation */}
          <div className="flex items-center gap-1">
            <svg className="text-gray-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <div className="h-4 w-2 animate-pulse bg-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}