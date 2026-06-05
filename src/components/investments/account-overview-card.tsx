import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountOverview, AccountOverviewItem } from "@/lib/types";

const SLICE_COLORS = [
  "oklch(0.58 0.17 150)",
  "oklch(0.66 0.18 153)",
  "oklch(0.74 0.14 153)",
  "oklch(0.82 0.1 153)",
  "oklch(0.72 0.08 185)",
  "oklch(0.84 0.035 220)",
  "oklch(0.68 0.12 245)",
  "oklch(0.77 0.08 84)",
];

function initials(value: string) {
  return value
    .split(/[\s.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "•";
}

function sliceColor(index: number) {
  return SLICE_COLORS[index % SLICE_COLORS.length];
}

function donutBackground(items: AccountOverviewItem[]) {
  const positiveItems = items.filter((item) => item.marketValue > 0);
  const total = positiveItems.reduce((sum, item) => sum + item.marketValue, 0);

  if (!total) {
    return "conic-gradient(oklch(0.93 0.01 190) 0deg 360deg)";
  }

  let cursor = 0;
  const stops = positiveItems.map((item, index) => {
    const size = (item.marketValue / total) * 360;
    const start = cursor;
    const end = cursor + size;
    cursor = end;
    const color = sliceColor(index);

    return `${color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

function MoneyDelta({
  value,
  currency,
}: {
  value: number | null;
  currency: string;
}) {
  if (value === null) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <span
      className={cn(
        "metric-tabular font-semibold",
        value > 0 && "text-emerald-700",
        value < 0 && "text-rose-700"
      )}
    >
      {formatCurrency(value, currency)}
    </span>
  );
}

function PercentDelta({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <span
      className={cn(
        "metric-tabular font-semibold",
        value > 0 && "text-emerald-700",
        value < 0 && "text-rose-700"
      )}
    >
      {formatPercent(value, { signed: true })}
    </span>
  );
}

function AssetIcon({
  item,
  index,
}: {
  item: AccountOverviewItem;
  index: number;
}) {
  if (item.kind === "cash") {
    return (
      <span className="soft-green-icon size-11">
        <Wallet className="size-5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
      style={{ backgroundColor: sliceColor(index) }}
      aria-hidden="true"
    >
      {initials(item.symbol)}
    </span>
  );
}

export function AccountOverviewCard({
  overview,
}: {
  overview: AccountOverview;
}) {
  const visibleRows = overview.items.slice(0, 6);
  const legendItems = overview.items.slice(0, 7);

  return (
    <Card className="grid gap-0 overflow-hidden p-0 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.45fr)]">
      <section className="min-w-0 border-border/70 p-6 xl:border-r">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Account overview
          </h2>
          <span className="subtle-chip">All portfolios</span>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr] xl:grid-cols-1 2xl:grid-cols-[280px_1fr]">
          <div className="relative mx-auto size-[17rem] max-w-full">
            <div
              className="absolute inset-0 rounded-full shadow-[inset_0_8px_24px_rgba(12,92,58,0.14)]"
              style={{ background: donutBackground(overview.items) }}
              aria-hidden="true"
            />
            <div className="absolute inset-[28%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-[0_10px_32px_rgba(15,35,34,0.08)]">
              <span className="text-xs text-muted-foreground">Total value</span>
              <span className="mt-1 text-lg font-semibold metric-tabular">
                {formatCurrency(overview.totalValue, overview.currency)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {legendItems.map((item, index) => (
              <div
                key={`${item.kind}-${item.symbol}`}
                className="grid grid-cols-[12px_minmax(64px,1fr)_auto_auto] items-center gap-2 text-sm"
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: item.kind === "cash" ? "oklch(0.86 0.08 153)" : sliceColor(index) }}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate font-medium">
                  {item.kind === "cash" ? "Cash" : item.symbol}
                </span>
                <span className="metric-tabular text-muted-foreground">
                  {formatCurrency(item.marketValue, overview.currency)}
                </span>
                <span className="metric-tabular text-muted-foreground">
                  {formatPercent(item.allocation)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-primary/15 bg-primary/10 p-5">
          <p className="font-medium">Whole investment account overview</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Includes holdings and free cash from all portfolios. Cash uses the
            latest broker snapshot or manual override where available.
          </p>
        </div>
      </section>

      <section className="min-w-0 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Holdings</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/portfolio">View all holdings</Link>
          </Button>
        </div>

        <div className="mt-5 space-y-3 md:hidden">
          {visibleRows.map((item, index) => (
            <div
              key={`${item.kind}-${item.symbol}-mobile`}
              className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <AssetIcon item={item} index={index} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.kind === "cash" ? overview.currency : item.symbol}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="metric-tabular font-semibold">
                    {formatCurrency(item.marketValue, overview.currency)}
                  </p>
                  <PercentDelta value={item.plPercent} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="metric-tabular text-sm font-semibold text-emerald-800">
                  {formatPercent(item.allocation)}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(0, Math.min(100, item.allocation))}%` }}
                  />
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 hidden overflow-x-auto md:block">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="w-[38%] py-3 pr-3">Asset</th>
                <th className="w-[27%] px-3 py-3">Allocation</th>
                <th className="w-[20%] px-3 py-3 text-right">Value</th>
                <th className="hidden px-3 py-3 text-right 2xl:table-cell">
                  P/L ({overview.currency})
                </th>
                <th className="w-[15%] px-3 py-3 text-right">P/L (%)</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((item, index) => (
                <tr
                  key={`${item.kind}-${item.symbol}`}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="py-4 pr-3">
                    <div className="flex items-center gap-3">
                      <AssetIcon item={item} index={index} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.kind === "cash" ? overview.currency : item.symbol}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex min-w-32 items-center gap-3">
                      <span className="metric-tabular font-semibold text-emerald-800">
                        {formatPercent(item.allocation)}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(0, Math.min(100, item.allocation))}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-right metric-tabular font-semibold">
                    {formatCurrency(item.marketValue, overview.currency)}
                  </td>
                  <td className="hidden px-3 py-4 text-right 2xl:table-cell">
                    <MoneyDelta
                      value={item.unrealizedPl}
                      currency={overview.currency}
                    />
                  </td>
                  <td className="px-3 py-4 text-right">
                    <PercentDelta value={item.plPercent} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-center">
          <Button asChild variant="ghost">
            <Link href="/portfolio">
              View all holdings and transactions
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </Card>
  );
}
