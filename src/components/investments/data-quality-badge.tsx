import { cn } from "@/lib/utils";
import type { ConfidenceLabel } from "@/lib/types";

const labelText: Record<ConfidenceLabel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

export function DataQualityBadge({
  label,
  missingCount = 0,
}: {
  label: ConfidenceLabel;
  missingCount?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        label === "high" && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200",
        label === "medium" && "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200",
        label === "low" && "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/25 dark:bg-slate-500/10 dark:text-slate-200"
      )}
    >
      {labelText[label]}
      {missingCount ? (
        <span className="metric-tabular text-muted-foreground">
          {missingCount} missing
        </span>
      ) : null}
    </span>
  );
}
