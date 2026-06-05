import { Banknote, Layers3, LineChart, Target, Wallet } from "lucide-react";
import { AccountOverviewCard } from "@/components/investments/account-overview-card";
import { DecisionCandidateCard } from "@/components/investments/decision-candidate-card";
import { EmptyState } from "@/components/investments/empty-state";
import { ExplainNumber } from "@/components/investments/explain-number";
import { LiveQuotesRefresher } from "@/components/investments/live-quotes-refresher";
import { MetricCard } from "@/components/investments/metric-card";
import { RecalculateZonesButton } from "@/components/investments/recalculate-zones-button";
import { SignedPercent } from "@/components/investments/signed-value";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceData } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export default async function DashboardPage() {
  const workspace = await getWorkspaceData();
  const { summary } = workspace;
  const holdingsMarketValue = summary.totalValue - summary.cash;
  const isLiveValuation =
    workspace.marketDataSettings?.livePricesEnabled &&
    workspace.marketDataSettings.valuationMode === "live_prices";
  const plPercent = summary.invested
    ? ((summary.unrealizedPl + summary.realizedPl) / summary.invested) * 100
    : 0;

  return (
    <div className="space-y-4">
      <LiveQuotesRefresher
        enabled={Boolean(isLiveValuation && !workspace.isLocked)}
        portfolioId={workspace.activePortfolio.id}
        intervalSeconds={
          workspace.marketDataSettings?.quoteRefreshIntervalSeconds ?? 120
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          label="Total portfolio value"
          value={formatCurrency(summary.totalValue, summary.currency)}
          detail={
            isLiveValuation
              ? `${summary.valuationSource ?? "Live quotes"} + ${summary.cashSource ?? "cash snapshot"}`
              : "XTB snapshot + cash snapshot"
          }
          icon={<Layers3 className="size-5" aria-hidden="true" />}
          explain={
            <ExplainNumber
              formula="Holdings market value + cash. Holdings are live-priced when live mode is enabled; cash remains broker snapshot/manual override."
              inputs={[
                {
                  label: summary.valuationSource ?? "Holdings market value",
                  value: formatCurrency(holdingsMarketValue, summary.currency),
                },
                {
                  label: summary.cashSource ?? "Cash",
                  value: formatCurrency(summary.cash, summary.currency),
                },
              ]}
              updatedAt={summary.updatedAt}
              sources={[
                {
                  label: "Valuation",
                  reference: summary.valuationSource ?? "XTB import snapshot",
                },
              ]}
            />
          }
        />
        <MetricCard
          label="Cash"
          value={formatCurrency(summary.cash, summary.currency)}
          detail="Static broker snapshot or override"
          icon={<Wallet className="size-5" aria-hidden="true" />}
          explain={
            <ExplainNumber
              formula="Latest broker cash snapshot or manual cash override"
              inputs={[
                {
                  label: "Cash",
                  value: formatCurrency(summary.cash, summary.currency),
                },
              ]}
              updatedAt={summary.updatedAt}
              sources={[
                {
                  label: "Cash source",
                  reference: summary.cashSource ?? "Broker cash snapshot",
                },
              ]}
            />
          }
        />
        <MetricCard
          label="Total invested"
          value={formatCurrency(summary.invested, summary.currency)}
          detail="Imported cost basis"
          icon={<Banknote className="size-5" aria-hidden="true" />}
        />
        <MetricCard
          label="Unrealized P/L"
          value={formatCurrency(summary.unrealizedPl, summary.currency)}
          detail={
            <span className="inline-flex flex-col gap-0.5">
              <SignedPercent value={plPercent} />
              <span>
                {isLiveValuation ? "Live market value - cost basis" : "Snapshot market value - cost basis"}
              </span>
            </span>
          }
          icon={<LineChart className="size-5" aria-hidden="true" />}
        />
        <MetricCard
          label="Realized P/L"
          value={formatCurrency(summary.realizedPl, summary.currency)}
          detail="Imported closed positions"
          icon={<Target className="size-5" aria-hidden="true" />}
        />
      </section>

      {workspace.accountOverview.totalValue > 0 || workspace.holdings.length ? (
        <>
          <AccountOverviewCard overview={workspace.accountOverview} />

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
            <DecisionCandidateCard
              title="Accumulation candidates"
              candidates={workspace.decisionCockpit.accumulationCandidates}
              emptyText="No eligible accumulation candidates from current strategy inputs."
            />
            <DecisionCandidateCard
              title="Trim review"
              candidates={workspace.decisionCockpit.trimCandidates}
              emptyText="No eligible trim candidates from current strategy inputs."
            />
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
                <CardTitle className="text-base">Decision setup</CardTitle>
                <RecalculateZonesButton
                  portfolioId={workspace.activePortfolio.id}
                  redirectTo="/dashboard"
                  label="Recalculate"
                  disabled={workspace.isLocked}
                />
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <SetupMetric
                  label="Missing target"
                  value={workspace.decisionCockpit.setup.missingTargetAllocation}
                />
                <SetupMetric
                  label="Split issues"
                  value={workspace.decisionCockpit.setup.invalidCoreSatelliteSplit}
                />
                <SetupMetric
                  label="Missing company type"
                  value={workspace.decisionCockpit.setup.missingCompanyType}
                />
                <SetupMetric
                  label="Missing thesis"
                  value={workspace.decisionCockpit.setup.missingThesisScore}
                />
                <SetupMetric
                  label="Missing zones"
                  value={workspace.decisionCockpit.setup.missingPriceZones}
                />
                <SetupMetric
                  label="Stale calculations"
                  value={workspace.decisionCockpit.setup.staleCalculations}
                />
              </CardContent>
            </Card>
          </section>
          <div className="ml-auto max-w-xl rounded-2xl border border-primary/15 bg-primary/8 px-4 py-3 text-xs leading-5 text-muted-foreground">
            Whole investment account overview: includes holdings and free cash
            from all portfolios. Cash uses the latest broker snapshot or manual
            override where available.
          </div>
        </>
      ) : (
        <EmptyState
          title="No holdings yet"
          description="Import an XTB report or add a manual entry to start building the consolidated portfolio view."
          isLocked={workspace.isLocked}
        />
      )}
    </div>
  );
}

function SetupMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 metric-tabular text-lg font-semibold">{value}</p>
    </div>
  );
}
