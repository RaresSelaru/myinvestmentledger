import { getSignedTone } from "@/lib/finance";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SignedPercent({
  value,
  context = "performance",
}: {
  value: number;
  context?: "performance" | "drift";
}) {
  return (
    <span
      className={cn(
        "metric-tabular font-medium",
        getSignedTone(value, context)
      )}
    >
      {formatPercent(value, { signed: true })}
    </span>
  );
}
