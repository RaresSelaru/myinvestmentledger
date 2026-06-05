import { PriceZoneBar } from "@/components/investments/price-zone-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatMoneyPrecise } from "@/lib/format";
import type { CurrencyCode, PriceZoneView, RecentActivitySummary } from "@/lib/types";

export function PriceZoneChart({
  zone,
  currency,
  recentActivity,
}: {
  zone?: PriceZoneView | null;
  currency: CurrencyCode;
  recentActivity?: RecentActivitySummary | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Price zones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <PriceZoneBar zone={zone} currency={currency} />
        {zone ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ZoneMetric label="Strong accumulation upper" value={zone.strongAccumulation} currency={currency} />
            <ZoneMetric label="Light accumulation upper" value={zone.lightAccumulation} currency={currency} />
            <ZoneMetric label="Hold range" value={zone.holdLow} suffix={zone.holdHigh ? ` - ${formatMoneyPrecise(zone.holdHigh, currency)}` : ""} currency={currency} />
            <ZoneMetric label="Trim review lower" value={zone.trimReview} currency={currency} />
            <ZoneMetric label="Strong trim lower" value={zone.strongTrim} currency={currency} />
            <ZoneMetric label="Exit review" value={zone.exitReview} currency={currency} />
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
            Add target allocation, company type, core/satellite split, and anchors to calculate price zones.
          </p>
        )}
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Detail label="Mode" value={zone?.zoneMode ?? "suggested"} />
          <Detail
            label="Last recalculated"
            value={zone?.lastRecalculatedAt ? formatDateTime(zone.lastRecalculatedAt) : "-"}
          />
          <Detail
            label="Recent buys 90d"
            value={String(recentActivity?.buys90d ?? 0)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ZoneMetric({
  label,
  value,
  suffix = "",
  currency,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  currency: CurrencyCode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 metric-tabular font-medium">
        {value ? formatMoneyPrecise(value, currency) : "-"}
        {suffix}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 metric-tabular font-medium">{value}</p>
    </div>
  );
}
