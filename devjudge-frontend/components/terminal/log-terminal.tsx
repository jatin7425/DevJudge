"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TerminalIcon, XIcon } from "@/components/dashboard/dashboard-frame";
import { type TerminalRequest } from "@/components/terminal/terminal-context";
import { getAnalysisEventsUrl } from "@/lib/auth-backend";
import {
  fetchActiveAnalysis,
  fetchJobDetail,
  fetchLatestSuccessfulJob,
  startInitialAnalysis,
  type JobLogEvent,
  type JobSummary,
} from "@/lib/dashboard-api";

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

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 3v10M3 8h10" strokeLinecap="round" />
  </svg>
);

const TabCloseIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 4l8 8m0-8l-8 8" strokeLinecap="round" />
  </svg>
);

type LogTerminalProps = {
  isOpen: boolean;
  onClose: () => void;
  request: TerminalRequest | null;
};

type TerminalLine =
  | {
      id: string;
      kind: "command" | "system" | "success" | "error";
      text: string;
    }
  | {
      id: string;
      kind: "log";
      text: string;
      timestamp: string;
      progress?: number | null;
      status?: string | null;
    }
  | {
      id: string;
      kind: "table";
      headers: string[];
      rows: string[][];
    };

type CommandAction = "bootstrap" | "manual";

interface Tab {
  id: string;
  title: string;
  type: "logs" | "shell";
  lines: TerminalLine[];
}

function formatTerminalTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getLogProgress(progress: number | null | undefined) {
  return typeof progress === "number" ? `${progress}%` : "--";
}

function getPromptLabel(jobId: string | null, mode: "idle" | "saved" | "live") {
  const suffix = jobId ? `:${jobId.slice(0, 8)}` : "";
  return `devjudge${mode === "live" ? "~live" : mode === "saved" ? "~logs" : ""}${suffix}`;
}

function getSavedLogs(job: JobSummary | null): JobLogEvent[] {
  const rawLogs = job?.meta?.logs;
  if (!Array.isArray(rawLogs)) {
    return [];
  }

  return rawLogs.filter((item): item is JobLogEvent => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof item.message === "string"
    );
  }).map((item, index) => ({
    ...item,
    id: item.id ?? index,
    job_id: item.job_id ?? job?.job_id ?? "unknown",
    timestamp: item.timestamp ?? new Date().toISOString()
  }));
}

export function LogTerminal({ isOpen, onClose, request }: LogTerminalProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedJobIdFromUrl = searchParams.get("jobId");

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [isDesktop, setIsDesktop] = useState(false);
  
  const [height, setHeight] = useState(380);
  const [isResizing, setIsResizing] = useState(false);

  const [command, setCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [, setHistoryIndex] = useState<number | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState("idle");
  const [mode, setMode] = useState<"idle" | "saved" | "live">("idle");
  const [isBusy, setIsBusy] = useState(false);
  const [isStreamConnected, setIsStreamConnected] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const streamRef = useRef<EventSource | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle Mouse Resizing
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || isMaximized) return;
      // Calculate new height from bottom of screen
      const newHeight = window.innerHeight - e.clientY;
      // Constraints: Min 150px, Max 90vh
      if (newHeight > 150 && newHeight < window.innerHeight * 0.9) {
        setHeight(newHeight);
      }
    };

    const stopResizing = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, isMaximized]);

  const terminalTitle = useMemo(() => {
    if (mode === "live" && currentJobId) {
      return `Live Terminal - ${currentJobId}`;
    }
    if (currentJobId) {
      return `Saved Logs - ${currentJobId}`;
    }
    return "DevJudge Terminal";
  }, [currentJobId, mode]);

  const appendLine = useCallback((line: TerminalLine, targetType?: "logs" | "shell") => {
    setTabs((current) => current.map(tab => {
      const isTarget = targetType ? tab.type === targetType : tab.id === activeTabId;
      if (isTarget) {
        return { ...tab, lines: [...tab.lines, line] };
      }
      return tab;
    }));
  }, [activeTabId]);

  const replaceLines = useCallback((next: TerminalLine[], targetType?: "logs" | "shell") => {
    setTabs((current) => current.map(tab => {
      const isTarget = targetType ? tab.type === targetType : tab.id === activeTabId;
      if (isTarget) {
        return { ...tab, lines: next };
      }
      return tab;
    }));
  }, [activeTabId]);

  const appendSystem = useCallback((text: string, kind: "system" | "success" | "error" = "system", targetType?: "logs" | "shell") => {
    appendLine({
      id: `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind,
      text,
    }, targetType);
  }, [appendLine]);

  const clearStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    setIsStreamConnected(false);
  }, []);

  const resetSeenEvents = useCallback(() => {
    seenEventIdsRef.current = new Set();
  }, []);

  const ensureLogsTab = useCallback(() => {
    setTabs(current => {
      if (current.some(t => t.type === "logs")) return current;
      const logsTab: Tab = {
        id: "logs-main",
        title: terminalTitle,
        type: "logs",
        lines: [],
      };
      return [logsTab, ...current];
    });
    setActiveTabId("logs-main");
  }, [terminalTitle]);

  const hydrateFromJob = useCallback((job: JobSummary, nextMode: "saved" | "live") => {
    ensureLogsTab();
    const savedLogs = getSavedLogs(job);
    resetSeenEvents();
    savedLogs.forEach((event) => {
      seenEventIdsRef.current.add(`${event.job_id}:${event.id}`);
    });

    replaceLines([
      {
        id: `system-${job.job_id}`,
        kind: "system",
        text: `${nextMode === "live" ? "Attached to live run" : "Opened saved logs"} ${job.job_id}`,
      },
      ...savedLogs.map<TerminalLine>((event) => ({
        id: `${event.job_id}:${event.id}`,
        kind: "log",
        text: event.message,
        timestamp: event.timestamp,
        progress: event.progress,
        status: event.status,
      })),
    ], "logs");

    setCurrentJobId(job.job_id);
    setCurrentStatus(job.job_status);
    setMode(nextMode);
  }, [replaceLines, resetSeenEvents]);

  const connectToStream = useCallback((jobId: string, streamUrl: string) => {
    clearStream();
    const source = new EventSource(streamUrl, { withCredentials: true });
    streamRef.current = source;

    source.onopen = () => {
      setIsStreamConnected(true);
      setMode("live");
      setCurrentStatus("running");
    };

    source.addEventListener("job-update", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as JobLogEvent;
        const eventKey = `${payload.job_id}:${payload.id}`;
        if (seenEventIdsRef.current.has(eventKey)) {
          return;
        }

        seenEventIdsRef.current.add(eventKey);
        appendLine({
          id: eventKey,
          kind: "log",
          text: payload.message,
          timestamp: payload.timestamp,
          progress: payload.progress,
          status: payload.status,
        }, "logs");

        if (payload.status) {
          setCurrentStatus(payload.status);
        }

        if (payload.status === "completed" || payload.status === "failed" || payload.progress === 100) {
          source.close();
          streamRef.current = null;
          setIsStreamConnected(false);
          setMode("saved");
          appendSystem(
            payload.status === "failed"
              ? `Run ${jobId} stopped with errors.`
              : `Run ${jobId} completed successfully.`,
            payload.status === "failed" ? "error" : "success",
            "logs"
          );
        }
      } catch {
        appendSystem("Received malformed stream payload.", "error", "logs");
      }
    });

    source.onerror = () => {
      setIsStreamConnected(false);
      appendSystem("Live stream disconnected. Saved logs remain available.", "error", "logs");
      source.close();
      streamRef.current = null;
    };
  }, [appendLine, appendSystem, clearStream]);

  const loadJobLogs = useCallback(async (jobId: string, action: CommandAction = "manual") => {
    setIsBusy(true);
    clearStream();

    try {
      const job = await fetchJobDetail(jobId);
      if (!job) {
        appendSystem(`Job ${jobId} was not found.`, "error");
        setMode("idle");
        setCurrentJobId(null);
        return;
      }

      const shouldFollowLive = job.job_status === "running" || job.job_status === "queued";
      hydrateFromJob(job, shouldFollowLive ? "live" : "saved");
      if (action === "manual") {
        appendSystem(`Loaded logs for ${job.job_id}.`, "success");
      }

      if (shouldFollowLive) {
        connectToStream(job.job_id, getAnalysisEventsUrl(job.job_id));
      }
    } catch {
      appendSystem(`Failed to load job ${jobId}.`, "error");
    } finally {
      setIsBusy(false);
    }
  }, [appendSystem, clearStream, connectToStream, hydrateFromJob]);

  const loadLatestLogs = useCallback(async (action: CommandAction = "manual") => {
    setIsBusy(true);
    clearStream();

    try {
      const latest = await fetchLatestSuccessfulJob();
      if (!latest?.job_id) {
        appendSystem("No successful runs found yet.", "error");
        setMode("idle");
        setCurrentJobId(null);
        return;
      }

      const detail = await fetchJobDetail(latest.job_id);
      if (!detail) {
        appendSystem("The latest run could not be loaded.", "error");
        return;
      }

      hydrateFromJob(detail, "saved");
    } catch {
      appendSystem("Failed to load the latest run.", "error");
    } finally {
      setIsBusy(false);
    }
  }, [appendSystem, clearStream, hydrateFromJob]);

  const loadActiveLogs = useCallback(async (action: CommandAction = "manual") => {
    setIsBusy(true);
    clearStream();

    try {
      const active = await fetchActiveAnalysis();
      if (active.kind !== "started") {
        appendSystem("No active run found. Falling back to latest saved logs.", "error");
        await loadLatestLogs(action);
        return;
      }

      const detail = await fetchJobDetail(active.jobId);
      if (detail) {
        hydrateFromJob(detail, "live");
      } else {
        ensureLogsTab();
        replaceLines([
          {
            id: `system-${active.jobId}`,
            kind: "system",
            text: `Attached to live run ${active.jobId}`,
          },
        ], "logs");
        setCurrentJobId(active.jobId);
        setCurrentStatus(active.status);
        setMode("live");
        resetSeenEvents();
      }

      connectToStream(active.jobId, active.streamUrl);
    } catch {
      appendSystem("Failed to attach to the active run.", "error");
    } finally {
      setIsBusy(false);
    }
  }, [appendSystem, clearStream, connectToStream, hydrateFromJob, loadLatestLogs, replaceLines, resetSeenEvents]);

  const attachStartedAnalysis = useCallback(async (
    started: { jobId: string; status: string; streamUrl: string },
    source: "dashboard" | "terminal" = "dashboard",
  ) => {
    setIsBusy(true);
    clearStream();
    resetSeenEvents();
    ensureLogsTab();

    replaceLines([
      {
        id: `system-start-${started.jobId}`,
        kind: "command",
        text: source === "terminal" ? "run" : "run-from-dashboard",
      },
      {
        id: `system-open-${started.jobId}`,
        kind: "success",
        text: `Started analysis job ${started.jobId}. Streaming live logs...`,
      },
    ], "logs");

    setCurrentJobId(started.jobId);
    setCurrentStatus(started.status);
    setMode("live");
    connectToStream(started.jobId, started.streamUrl);

    try {
      const detail = await fetchJobDetail(started.jobId);
      if (detail) {
        const savedLogs = getSavedLogs(detail);
        if (savedLogs.length > 0) {
          resetSeenEvents();
          savedLogs.forEach((event) => {
            seenEventIdsRef.current.add(`${event.job_id}:${event.id}`);
          });

          replaceLines([
            {
              id: `system-start-${started.jobId}`,
              kind: "command",
              text: source === "terminal" ? "run" : "run-from-dashboard",
            },
            {
              id: `system-open-${started.jobId}`,
              kind: "success",
              text: `Started analysis job ${started.jobId}. Streaming live logs...`,
            },
            ...savedLogs.map<TerminalLine>((event) => ({
              id: `${event.job_id}:${event.id}`,
              kind: "log",
              text: event.message,
              timestamp: event.timestamp,
              progress: event.progress,
              status: event.status,
            })),
          ], "logs");
        }
      }
    } catch {
      appendSystem("Could not preload saved logs for the new run.", "error", "logs");
    } finally {
      setIsBusy(false);
    }
  }, [appendSystem, clearStream, connectToStream, ensureLogsTab, replaceLines, resetSeenEvents]);

  const triggerRun = useCallback(async () => {
    setIsBusy(true);
    clearStream();

    try {
      const started = await startInitialAnalysis();
      if (started.kind !== "started") {
        appendSystem("Could not start analysis from the terminal.", "error");
        return;
      }

      await attachStartedAnalysis(started, "terminal");
    } catch {
      appendSystem("Failed to start analysis.", "error");
    } finally {
      setIsBusy(false);
    }
  }, [appendSystem, attachStartedAnalysis, clearStream]);

  const copyTranscript = useCallback(async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const transcript = (activeTab?.lines ?? []).map((line) => {
      if (line.kind === "log") {
        return `${formatTerminalTime(line.timestamp)} ${getLogProgress(line.progress)} ${line.text}`;
      }
      return line.text;
    }).join("\n");

    try {
      await navigator.clipboard.writeText(transcript);
      appendSystem("Copied terminal transcript to clipboard.", "success");
    } catch {
      appendSystem("Clipboard write failed.", "error");
    }
  }, [appendSystem, tabs, activeTabId]);

  const printHelp = useCallback(() => {
    appendLine({
      id: `help-${Date.now()}`,
      kind: "table",
      headers: ["CMD", "PARAM", "DESCRIPTION"],
      rows: [
        ["help", "-", "show terminal commands"],
        ["run", "-", "trigger a new analysis"],
        ["active", "-", "follow the live run"],
        ["latest", "-", "load latest saved logs"],
        ["job", "<id>", "inspect one run"],
        ["status", "-", "print terminal state"],
        ["copy", "-", "copy transcript"],
        ["clear", "-", "clear the terminal"],
      ],
    });
  }, [appendLine]);

  const printStatus = useCallback(() => {
    appendSystem(
      `Status: ${currentStatus} | Mode: ${mode} | Job: ${currentJobId ?? "none"} | Stream: ${isStreamConnected ? "connected" : "idle"}`,
      "system",
    );
  }, [appendSystem, currentJobId, currentStatus, isStreamConnected, mode]);

  const executeCommand = useCallback(async (rawCommand: string) => {
    const value = rawCommand.trim();
    if (!value) return;

    appendLine({
      id: `command-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: "command",
      text: value,
    });

    const [base, ...args] = value.split(/\s+/);
    const normalized = base.toLowerCase();

    if (normalized === "help") {
      printHelp();
      return;
    }

    if (normalized === "clear") {
      replaceLines([]);
      return;
    }

    if (normalized === "status") {
      printStatus();
      return;
    }

    if (normalized === "copy") {
      await copyTranscript();
      return;
    }

    if (normalized === "run") {
      await triggerRun();
      return;
    }

    if (normalized === "active") {
      await loadActiveLogs();
      return;
    }

    if (normalized === "latest") {
      await loadLatestLogs();
      return;
    }

    if (normalized === "job") {
      const jobId = args.join(" ").trim();
      if (!jobId) {
        appendSystem("Usage: job <job-id>", "error");
        return;
      }
      await loadJobLogs(jobId);
      return;
    }

    appendSystem(`Unknown command: ${value}`, "error");
  }, [appendLine, appendSystem, copyTranscript, loadActiveLogs, loadJobLogs, loadLatestLogs, printHelp, printStatus, replaceLines, triggerRun]);

  useEffect(() => {
    if (!isOpen) {
      clearStream();
      return;
    }
    const createInitialShell = () => {
      const shellId = `shell-${Date.now()}`;
      setTabs([{ id: shellId, title: "Interactive Shell", type: "shell", lines: [] }]);
      setActiveTabId(shellId);
    };

    const bootstrap = async () => {
      // Only auto-hydrate logs if there is a specific trigger
      if (selectedJobIdFromUrl && pathname.startsWith("/dashboard/jobs")) {
        await loadJobLogs(selectedJobIdFromUrl, "bootstrap");
        return;
      }

      // Otherwise, start with a clean interactive shell per request
      createInitialShell();
    };

    if (request?.kind === "started-analysis") {
      void attachStartedAnalysis(request.started, "dashboard");
      return;
    }

    if (selectedJobIdFromUrl && pathname.startsWith("/dashboard/jobs") && selectedJobIdFromUrl !== currentJobId) {
      void bootstrap();
      return;
    }

    if (tabs.length === 0) {
      void bootstrap();
    }

    return () => {
      clearStream();
    };
  }, [attachStartedAnalysis, clearStream, currentJobId, isOpen, loadActiveLogs, loadJobLogs, loadLatestLogs, pathname, request, selectedJobIdFromUrl, tabs.length]);

  const createNewShell = useCallback(() => {
    const shellId = `shell-${Date.now()}`;
    const newShell: Tab = {
      id: shellId,
      title: "Interactive Shell",
      type: "shell",
      lines: [],
    };
    setTabs(current => [...current, newShell]);
    setActiveTabId(shellId);
  }, []);

  const closeTab = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const tabToClose = tabs.find(t => t.id === id);
    if (tabToClose?.type === "logs") {
      clearStream();
      setMode("idle");
      setCurrentJobId(null);
      setCurrentStatus("idle");
    }

    const filtered = tabs.filter(t => t.id !== id);

    if (filtered.length === 0) {
      onClose();
    } else if (activeTabId === id) {
      setActiveTabId(filtered[filtered.length - 1].id);
    }

    setTabs(filtered);
  }, [activeTabId, clearStream, onClose, tabs]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);

  useEffect(() => {
    if (isOpen && activeTabId) {
      inputRef.current?.focus();
    }
  }, [isOpen, activeTabId, request]);

  useEffect(() => {
    if (!isOpen) return;
    scrollViewportRef.current?.scrollTo({
      top: scrollViewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isOpen, activeTab?.lines]);

  useEffect(() => {
    if (isOpen) {
      setHistoryIndex(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !request) {
      return;
    }

    if (request.kind === "started-analysis") {
      void attachStartedAnalysis(request.started, "dashboard");
      return;
    }

    if (request.kind === "open") {
    }
  }, [attachStartedAnalysis, isOpen, request]);

  if (!isOpen) {
    return null;
  }

  // Responsive Logic:
  // Desktop: Fixed bottom panel, full width, resizable height.
  // Mobile: Fixed right sidebar, full height, static width.
  const desktopHeight = isMaximized ? "100vh" : `${height}px`;

  return (
    <div 
      style={{ height: isDesktop ? desktopHeight : '100%' }}
      className={`fixed z-[100] flex flex-col bg-[#1e1e1e] [font-family:var(--font-geist-mono)] shadow-2xl transition-all duration-200 ease-in-out rounded-none
        bottom-0 right-0 border-[#333]
        lg:left-0 lg:border-t
        w-full sm:w-80 lg:w-full
        border-l lg:border-l-0
      `}
    >
      {/* Resize Handle - Top edge, only visible on desktop */}
      <div 
        onMouseDown={startResizing}
        className={`absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-accent-primary/40 transition-colors z-[110] hidden lg:block ${isMaximized ? 'pointer-events-none' : ''}`} 
      />

      <section className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-[#333] bg-[#252526] px-3 py-1">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 items-center min-w-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`group flex h-full items-center gap-2 border-b px-3 text-[11px] font-medium uppercase tracking-wider transition-colors whitespace-nowrap ${
                    activeTabId === tab.id ? "border-accent-primary bg-[#1e1e1e] text-white" : "border-transparent text-text-muted hover:bg-[#2d2d2d] hover:text-text-primary"
                  }`}
                >
                  {tab.type === "logs" ? <TerminalIcon className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                  <span className="truncate max-w-[150px]">{tab.type === "logs" ? terminalTitle : tab.title}</span>
                  
                  <button
                    type="button"
                    onClick={(e) => closeTab(tab.id, e)}
                    className="ml-1 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-[#444] p-0.5 transition-opacity outline-none"
                    aria-label={`Close ${tab.type === "logs" ? "logs" : tab.title} tab`}
                  >
                    <TabCloseIcon className="h-3 w-3" />
                  </button>
                </button>
              ))}

              <button
                onClick={createNewShell}
                className="flex h-9 w-9 items-center justify-center border-b border-transparent text-text-muted transition-colors hover:bg-[#333] hover:text-white"
                title="New Terminal"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {activeTab?.type === "logs" && (
              <div className="mr-4 border border-[#333] bg-[#0c0c0c] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-text-muted hidden lg:block">
                {getPromptLabel(currentJobId, mode)}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className={`flex h-8 w-8 items-center justify-center text-text-muted transition-all hover:bg-[#333] hover:text-white ${isMaximized ? '' : 'hidden lg:flex'}`}
              title={isMaximized ? "Restore" : "Maximize Panel Size"}
            >
              {isMaximized ? <MinimizeIcon className="h-3.5 w-3.5" /> : <MaximizeIcon className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center text-text-muted transition-all hover:bg-[#e81123] hover:text-white"
              aria-label="Close terminal"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="grid grid-cols-[minmax(0,1fr)_280px] border-b border-[#333] bg-[#1e1e1e] text-[10px] uppercase tracking-[0.16em] text-text-muted">
          <div className="px-4 py-1.5">
            {isBusy ? "Busy" : mode === "live" ? "Streaming" : mode === "saved" ? "Saved Logs" : "Ready"}
          </div>
          <div className="border-l border-[#333] px-4 py-1.5">
            {currentJobId ? `Job ${currentJobId.slice(0, 12)}` : "No job attached"}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] bg-[#0c0c0c]">
          <div ref={scrollViewportRef} className="drawer-scrollbar min-h-0 overflow-y-auto px-4 py-4 selection:bg-accent-primary/30">
            <div className="space-y-2 text-sm">
              {!activeTab || activeTab.lines.length === 0 ? (
                <div className="border border-[#333] bg-[#1e1e1e] px-4 py-3 text-[12px] text-text-subtle">
                  {activeTab?.type === "logs" ? "No logs found for this job." : "Interactive shell ready. Type 'help' for commands."}
                </div>
              ) : (
                activeTab.lines.map((line) => {
                  if (line.kind === "log") {
                    return (
                      <div key={line.id} className="grid grid-cols-[90px_60px_minmax(0,1fr)] gap-3 px-2 py-0.5 text-[12px] text-text-secondary">
                        <span className="text-text-muted/80 whitespace-nowrap">{formatTerminalTime(line.timestamp)}</span>
                        <span className={line.status === "completed" || line.progress === 100 ? "text-success" : line.status === "failed" ? "text-danger" : "text-accent-primary"}>
                          {getLogProgress(line.progress)}
                        </span>
                        <span className="text-text-primary">{line.text}</span>
                      </div>
                    );
                  }

                  if (line.kind === "table") {
                    return (
                      <div key={line.id} className="my-2 border border-[#333] bg-[#1e1e1e]/30 px-4 py-3">
                        <div className="grid grid-cols-[100px_100px_1fr] border-b border-[#333] pb-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                          {line.headers.map((h, i) => (
                            <span key={i}>{h}</span>
                          ))}
                        </div>
                        <div className="mt-2 space-y-1">
                          {line.rows.map((row, i) => (
                            <div key={i} className="grid grid-cols-[100px_100px_1fr] text-[12px]">
                              {row.map((cell, j) => (
                                <span
                                  key={j}
                                  className={j === 0 ? "text-accent-primary" : j === 1 ? "text-text-muted" : "text-text-secondary"}
                                >
                                  {cell}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  const toneClass = {
                    command: "text-accent-primary",
                    system: "text-text-secondary",
                    success: "text-success",
                    error: "text-danger",
                  }[line.kind];

                  return (
                    <div key={line.id} className={`px-2 py-0.5 text-[12px] ${toneClass}`}>
                      {line.kind === "command" ? (
                        <span>
                          <span className="mr-2 text-success">{getPromptLabel(currentJobId, mode)}$</span>
                          {line.text}
                        </span>
                      ) : (
                        line.text
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <aside className="border-l border-[#333] bg-[#1e1e1e] px-4 py-4 hidden lg:block">
            <div className="border border-[#333] bg-[#0c0c0c] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Quick Commands</p>
              <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                <li><code className="text-text-primary">help</code> show terminal commands</li>
                <li><code className="text-text-primary">run</code> trigger a new analysis</li>
                <li><code className="text-text-primary">active</code> follow the live run</li>
                <li><code className="text-text-primary">latest</code> load latest saved logs</li>
                <li><code className="text-text-primary">job &lt;id&gt;</code> inspect one run</li>
                <li><code className="text-text-primary">status</code> print terminal state</li>
                <li><code className="text-text-primary">copy</code> copy transcript</li>
                <li><code className="text-text-primary">clear</code> clear the terminal</li>
              </ul>
            </div>

            <div className="mt-4 border border-[#333] bg-[#0c0c0c] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Session</p>
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                <p>Status: <span className="text-text-primary">{currentStatus}</span></p>
                <p>Mode: <span className="text-text-primary">{mode}</span></p>
                <p>Stream: <span className="text-text-primary">{isStreamConnected ? "connected" : "idle"}</span></p>
              </div>
            </div>
          </aside>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const nextCommand = command.trim();
            if (!nextCommand) return;
            setCommandHistory((current) => [...current, nextCommand]);
            setHistoryIndex(null);
            setCommand("");
            void executeCommand(nextCommand);
          }}
          className="border-t border-[#333] bg-[#1e1e1e] px-4 py-3 hidden lg:block"
        >
          <label className="flex items-center gap-3 border border-[#333] bg-[#0c0c0c] px-4 py-2">
            <span className="text-sm text-green-400">
              {activeTab?.type === "shell" ? "devjudge" : getPromptLabel(currentJobId, mode)}
              $
            </span>
            <input
              ref={inputRef}
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                // Handle Ctrl+C Interrupt
                if (event.ctrlKey && event.key.toLowerCase() === "c") {
                  event.preventDefault();
                  if (isStreamConnected || mode === "live") {
                    clearStream();
                    setMode("saved");
                    appendSystem("^C (Streaming Interrupted)", "system");
                  } else {
                    appendLine({
                      id: `sigint-${Date.now()}`,
                      kind: "command",
                      text: `${command}^C`,
                    });
                  }
                  setCommand("");
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHistoryIndex((current) => {
                    const nextIndex = current === null ? commandHistory.length - 1 : Math.max(0, current - 1);
                    const nextCommand = commandHistory[nextIndex];
                    if (nextCommand) {
                      setCommand(nextCommand);
                      return nextIndex;
                    }
                    return current;
                  });
                }

                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setHistoryIndex((current) => {
                    if (current === null) return null;
                    const nextIndex = current + 1;
                    if (nextIndex >= commandHistory.length) {
                      setCommand("");
                      return null;
                    }
                    const nextCommand = commandHistory[nextIndex];
                    if (nextCommand) {
                      setCommand(nextCommand);
                    }
                    return nextIndex;
                  });
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              placeholder="Type help, run, active, latest, or job <id>"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </form>
      </section>
    </div>
  );
}
