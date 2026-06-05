import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CoreSatelliteBar } from "@/components/investments/core-satellite-bar";
import { DecisionScoreBar } from "@/components/investments/decision-score-bar";
import { ExplainNumber } from "@/components/investments/explain-number";
import { LiveQuotesRefresher } from "@/components/investments/live-quotes-refresher";
import { PriceZoneChart } from "@/components/investments/price-zone-chart";
import { RecalculateZonesButton } from "@/components/investments/recalculate-zones-button";
import { SignedPercent } from "@/components/investments/signed-value";
import { WhyPanel } from "@/components/investments/why-panel";
import { ZoneModeControl } from "@/components/investments/zone-mode-control";
import { getStockDetailData } from "@/lib/data";
import {
  formatCurrency,
  formatDateTime,
  formatMoneyPrecise,
  formatNumber,
  formatPercent,
} from "@/lib/format";

type StockDetailPageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function StockDetailPage({ params }: StockDetailPageProps) {
  const { symbol } = await params;
  const workspace = await getStockDetailData(symbol);
  const { holding } = workspace;

  if (!holding) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost">
          <Link href="/portfolio">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Portfolio
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Holding not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const transactions = workspace.transactions;
  const decision = holding.decisionScore;
  const redirectTo = `/portfolio/${holding.symbol}`;

  if (workspace.isLocked) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/portfolio">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Portfolio
          </Link>
        </Button>
        <Card className="border-primary/20 bg-card">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
            <div>
              <p className="text-2xl font-semibold tracking-tight">{holding.symbol}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Position-level details, source rows, and transaction traceability are available after login.
              </p>
            </div>
            <Button asChild>
              <Link href="/login">Log in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LiveQuotesRefresher
        enabled={Boolean(
          !workspace.isLocked &&
            workspace.marketDataSettings?.livePricesEnabled &&
            workspace.marketDataSettings.valuationMode === "live_prices"
        )}
        portfolioId={workspace.activePortfolio.id}
        intervalSeconds={
          workspace.marketDataSettings?.quoteRefreshIntervalSeconds ?? 120
        }
      />
      <Button asChild variant="ghost" size="sm">
        <Link href="/portfolio">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Portfolio
        </Link>
      </Button>

      <section className="grid gap-4 lg:grid-cols-4">
        <Metric label="Market value" value={formatCurrency(holding.marketValue, workspace.summary.currency)} />
        <Metric label="Quantity" value={formatNumber(holding.quantity, 4)} />
        <Metric
          label="Average cost"
          value={formatMoneyPrecise(holding.averageCost, holding.currency)}
        />
        <Metric
          label="Current price"
          value={formatMoneyPrecise(holding.currentPrice, holding.currency)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Metric
          label="Accumulation"
          value={decision?.scores.accumulation.finalScore.toFixed(0) ?? "-"}
        />
        <Metric
          label="Hold"
          value={decision?.scores.hold.finalScore.toFixed(0) ?? "-"}
        />
        <Metric
          label="Trim"
          value={decision?.scores.trim.finalScore.toFixed(0) ?? "-"}
        />
        <Metric
          label="Exit risk"
          value={decision?.scores.liquidationRisk.finalScore.toFixed(0) ?? "-"}
        />
        <Metric
          label="Portfolio fit"
          value={decision?.scores.portfolioFit.finalScore.toFixed(0) ?? "-"}
        />
      </section>

      {decision ? (
        <Card>
          <CardContent className="grid gap-4 p-5 lg:grid-cols-5">
            <DecisionScoreBar
              label="Accumulation"
              score={decision.scores.accumulation}
              variant="accumulation"
            />
            <DecisionScoreBar label="Hold" score={decision.scores.hold} variant="hold" />
            <DecisionScoreBar label="Trim" score={decision.scores.trim} variant="trim" />
            <DecisionScoreBar
              label="Exit risk"
              score={decision.scores.liquidationRisk}
              variant="exitRisk"
            />
            <DecisionScoreBar
              label="Portfolio fit"
              score={decision.scores.portfolioFit}
              variant="portfolioFit"
            />
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <PriceZoneChart
          zone={holding.priceZone}
          currency={holding.currency}
          recentActivity={decision?.recentActivity}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recalculation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <RecalculateZonesButton
                portfolioId={workspace.activePortfolio.id}
                symbol={holding.symbol}
                redirectTo={redirectTo}
                disabled={workspace.isLocked}
              />
            </div>
            <ZoneModeControl
              portfolioId={workspace.activePortfolio.id}
              symbol={holding.symbol}
              zone={holding.priceZone}
              redirectTo={redirectTo}
              disabled={workspace.isLocked}
            />
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-3 text-sm text-muted-foreground">
              Current mode: {holding.priceZone?.zoneMode ?? holding.zoneMode ?? "suggested"}
            </div>
          </CardContent>
        </Card>
      </section>

      <WhyPanel decision={decision} />

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Metric label="Actual" value={formatPercent(holding.actualAllocation)} />
              <Metric
                label="Target"
                value={holding.targetConfigured ? formatPercent(holding.targetAllocation) : "Not set"}
              />
              <Metric
                label="Drift"
                value={
                  holding.targetConfigured ? (
                    <span className="flex items-center gap-1">
                      <SignedPercent value={holding.drift} context="drift" />
                      <ExplainNumber
                        formula="Actual portfolio % - Target portfolio %"
                        inputs={[
                          {
                            label: "Actual allocation",
                            value: formatPercent(holding.actualAllocation),
                          },
                          {
                            label: "Target allocation",
                            value: formatPercent(holding.targetAllocation),
                          },
                        ]}
                        updatedAt={holding.updatedAt}
                      />
                    </span>
                  ) : (
                    "-"
                  )
                }
              />
            </div>
            <Separator />
            <CoreSatelliteBar
              core={holding.corePercent}
              satellite={holding.satellitePercent}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Targets and P/L</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Metric
              label="Cost basis"
              value={formatCurrency(holding.costBasis, workspace.summary.currency)}
            />
            <Metric
              label="Unrealized"
              value={formatCurrency(holding.unrealizedPl, workspace.summary.currency)}
            />
            <Metric
              label="Realized"
              value={formatCurrency(holding.realizedPl, workspace.summary.currency)}
            />
            <Metric label="P/L %" value={<SignedPercent value={holding.plPercent} />} />
            <Metric
              label="Target buy"
              value={
                holding.targetBuyPrice
                  ? formatMoneyPrecise(holding.targetBuyPrice, holding.currency)
                  : "-"
              }
            />
            <Metric
              label="Target trim"
              value={
                holding.targetSellPrice
                  ? formatMoneyPrecise(holding.targetSellPrice, holding.currency)
                  : "-"
              }
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea rows={5} placeholder="Optional thesis or comments" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source traceability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Imported lots and raw source rows will appear here once the XTB
              parser is connected.
            </p>
            <Separator />
            <p className="text-muted-foreground">
              Current linked ledger rows: {transactions.length}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {transactions.length ? (
            transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm shadow-sm"
              >
                <span>{transaction.date}</span>
                <span className="text-muted-foreground">
                  {transaction.type.replace("_", " ")}
                </span>
                <span className="metric-tabular">
                  {formatMoneyPrecise(transaction.amount, transaction.currency)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No symbol-specific ledger rows yet.
            </p>
          )}
          {workspace.decisionEvents.length ? (
            <div className="space-y-2 pt-2">
              {workspace.decisionEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm"
                >
                  <span>{formatDateTime(event.date)}</span>
                  <span className="text-muted-foreground">{event.summary}</span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 metric-tabular font-medium">{value}</div>
    </div>
  );
}
