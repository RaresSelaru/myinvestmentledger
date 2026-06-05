import { formatMoneyPrecise } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CurrencyCode, PriceZoneView } from "@/lib/types";

const segmentClass = [
  "bg-emerald-400/70",
  "bg-emerald-300/60",
  "bg-slate-200 dark:bg-slate-700",
  "bg-amber-300/70",
  "bg-rose-300/70",
];

function bounds(zone: PriceZoneView) {
  const values = [
    zone.exitReview,
    zone.strongAccumulation,
    zone.lightAccumulation,
    zone.holdLow,
    zone.holdHigh,
    zone.trimReview,
    zone.strongTrim,
    zone.currentPrice,
    zone.manualBuyAnchor,
    zone.manualTrimAnchor,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const padding = Math.max((max - min) * 0.12, max * 0.03, 1);

  return { min: Math.max(0, min - padding), max: max + padding };
}

function position(value: number | null, min: number, max: number) {
  if (value === null || !Number.isFinite(value) || max <= min) return null;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function zoneText(zone: PriceZoneView) {
  return zone.currentZone.replaceAll("_", " ");
}

export function PriceZoneBar({
  zone,
  currency,
  showLabel = true,
}: {
  zone?: PriceZoneView | null;
  currency: CurrencyCode;
  showLabel?: boolean;
}) {
  if (!zone) {
    return (
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-muted" />
        {showLabel ? <p className="text-xs text-muted-foreground">Needs setup</p> : null}
      </div>
    );
  }

  const { min, max } = bounds(zone);
  const marker = position(zone.currentPrice, min, max);
  const buy = position(zone.manualBuyAnchor, min, max);
  const trim = position(zone.manualTrimAnchor, min, max);

  return (
    <div className="min-w-36 space-y-1.5">
      <div className="relative flex h-2 overflow-hidden rounded-full bg-muted">
        {segmentClass.map((className, index) => (
          <span key={className} className={cn("h-full flex-1", className, index > 0 && "border-l border-background/70")} />
        ))}
        {marker !== null ? (
          <span
            className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-foreground shadow-sm"
            style={{ left: `${marker}%` }}
            title={
              zone.currentPrice
                ? `Current ${formatMoneyPrecise(zone.currentPrice, currency)}`
                : "Current price"
            }
          />
        ) : null}
        {buy !== null ? (
          <span
            className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-emerald-700"
            style={{ left: `${buy}%` }}
            title="Manual buy anchor"
          />
        ) : null}
        {trim !== null ? (
          <span
            className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-amber-700"
            style={{ left: `${trim}%` }}
            title="Manual trim anchor"
          />
        ) : null}
      </div>
      {showLabel ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{zoneText(zone)}</span>
          <span>{zone.zoneMode}</span>
        </div>
      ) : null}
    </div>
  );
}
