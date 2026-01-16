"use client";

import { useEffect, useRef, useState } from "react";

interface LogEntry {
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

interface TerminalProps {
  logs: LogEntry[];
  isStreaming?: boolean;
}

export default function Terminal({ logs, isStreaming = false }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "success":
        return "text-green-400";
      case "warning":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      default:
        return "text-gray-300";
    }
  };

  const getLogPrefix = (level: LogEntry["level"]) => {
    switch (level) {
      case "success":
        return "✓";
      case "warning":
        return "⚠";
      case "error":
        return "✗";
      default:
        return "→";
    }
  };

  return (
    <div className="w-full">
      {/* Terminal Header */}
      <div className="bg-gray-800 rounded-t-lg px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-gray-400 text-sm font-mono ml-2">Crawler Terminal</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3 h-3"
            />
            Auto-scroll
          </label>
          {isStreaming && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-400">Streaming...</span>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Body */}
      <div
        ref={terminalRef}
        className="bg-gray-900 text-sm font-mono rounded-b-lg p-4 h-96 overflow-y-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#4B5563 #1F2937",
        }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500">Waiting for logs...</div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className="flex items-start gap-2 mb-1 hover:bg-gray-800/50 px-2 py-1 rounded"
            >
              <span className="text-gray-500 text-xs min-w-[60px]">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`${getLogColor(log.level)} min-w-[20px]`}>
                {getLogPrefix(log.level)}
              </span>
              <span className={getLogColor(log.level)}>{log.message}</span>
            </div>
          ))
        )}
        {isStreaming && (
          <div className="flex items-center gap-2 text-gray-500 mt-2">
            <span className="animate-pulse">▋</span>
            <span>Processing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
