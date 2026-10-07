interface StatusBadgeProps {
  status: "pass" | "warn" | "fail";
  size?: "sm" | "md" | "lg";
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-2",
  };

  const statusConfig = {
    pass: {
      label: "Pass",
      className: "bg-green-950/50 text-green-300 border border-green-800",
      icon: "✓",
    },
    warn: {
      label: "Warn",
      className: "bg-yellow-950/50 text-yellow-300 border border-yellow-800",
      icon: "⚠",
    },
    fail: {
      label: "Fail",
      className: "bg-red-950/50 text-red-300 border border-red-800",
      icon: "✗",
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`${config.className} ${sizeClasses[size]} font-medium rounded-md inline-flex items-center gap-1`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
