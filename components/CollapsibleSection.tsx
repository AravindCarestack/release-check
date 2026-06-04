"use client";

import { ReactNode, useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
  className = "",
}: CollapsibleSectionProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : internalOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen((v) => !v);
    }
  };

  return (
    <div className={`border border-gray-100 rounded-md overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <svg
            className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {title}
            </span>
            {subtitle && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {badge && <div className="shrink-0 ml-2">{badge}</div>}
      </button>
      {open && <div className="px-3 pb-3 border-t border-gray-100">{children}</div>}
    </div>
  );
}
