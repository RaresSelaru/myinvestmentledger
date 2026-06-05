import { cn } from "@/lib/utils";
import type { DecisionScorePoint } from "@/lib/types";

const variantClass = {
  accumulation: "bg-emerald-500",
  hold: "bg-slate-500",
  trim: "bg-amber-500",
  exitRisk: "bg-rose-500",
  portfolioFit: "bg-sky-500",
};

export function DecisionScoreBar({
  score,
  label,
  variant = "portfolioFit",
  compact = false,
}: {
  score?: DecisionScorePoint | number | null;
  label?: string;
  variant?: keyof typeof variantClass;
  compact?: boolean;
}) {
  const value =
    typeof score === "number" ? score : score?.finalScore ?? 0;

  return (
    <div className={cn("min-w-0", compact ? "space-y-1" : "space-y-2")}>
      {label ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="metric-tabular font-medium text-foreground">
            {value.toFixed(0)}
          </span>
        </div>
      ) : null}
      <div className={cn("overflow-hidden rounded-full bg-muted", compact ? "h-1.5" : "h-2")}>
        <div
          className={cn("h-full rounded-full", variantClass[variant])}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
