interface ScoreBadgeProps {
  count: number;
  label: string;
  color: "green" | "yellow" | "red";
}

export default function ScoreBadge({ count, label, color }: ScoreBadgeProps) {
  const colorClasses = {
    green: "bg-green-500 text-white",
    yellow: "bg-yellow-500 text-white",
    red: "bg-red-500 text-white",
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`${colorClasses[color]} px-3 py-1 rounded-md text-sm font-medium`}>
        {count}
      </span>
      <span className="text-gray-700 font-medium text-sm">{label}</span>
    </div>
  );
}
