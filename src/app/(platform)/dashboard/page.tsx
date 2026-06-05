import { Banknote, Layers3, LineChart, Target, Wallet } from "lucide-react";
import { AccountOverviewCard } from "@/components/investments/account-overview-card";
import { CandidateCard } from "@/components/investments/candidate-card";
import { EmptyState } from "@/components/investments/empty-state";
import { ExplainNumber } from "@/components/investments/explain-number";
import { MetricCard } from "@/components/investments/metric-card";
import { PageHeader } from "@/components/investments/page-header";
import { SignedPercent } from "@/components/investments/signed-value";
import { getWorkspaceData } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export default async function DashboardPage() {
  const workspace = await getWorkspaceData();
  const { summary } = workspace;
  const plPercent = summary.invested
    ? ((summary.unrealizedPl + summary.realizedPl) / summary.invested) * 100
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Portfolio clarity, allocation discipline, and traceable numbers."
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="subtle-chip">
          Valuation: {summary.valuationSource ?? "XTB snapshot"}
        </span>
        <span className="subtle-chip">
          Cash: {summary.cashSource ?? "Broker cash snapshot"}
        </span>
        <span className="subtle-chip">
          Updated: {summary.updatedAt}
        </span>
      </div>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        <MetricCard
          label="Total portfolio value"
          value={formatCurrency(summary.totalValue, summary.currency)}
          icon={<Layers3 className="size-5" aria-hidden="true" />}
          explain={
            <ExplainNumber
              formula="Holdings market value + cash"
              inputs={[
                {
                  label: summary.valuationSource ?? "Holdings snapshot",
                  value: formatCurrency(summary.totalValue, summary.currency),
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
          detail="Cost basis where available"
          icon={<Banknote className="size-5" aria-hidden="true" />}
        />
        <MetricCard
          label="Unrealized P/L"
          value={formatCurrency(summary.unrealizedPl, summary.currency)}
          detail={<SignedPercent value={plPercent} />}
          icon={<LineChart className="size-5" aria-hidden="true" />}
        />
        <MetricCard
          label="Realized P/L"
          value={formatCurrency(summary.realizedPl, summary.currency)}
          icon={<Target className="size-5" aria-hidden="true" />}
        />
      </section>

      {workspace.accountOverview.totalValue > 0 || workspace.holdings.length ? (
        <>
          <AccountOverviewCard overview={workspace.accountOverview} />

          <section className="grid gap-4 lg:grid-cols-2">
            <CandidateCard
              title="Top 3 for accumulation"
              candidates={workspace.accumulationCandidates}
            />
            <CandidateCard
              title="Top 3 for trimming"
              candidates={workspace.trimmingCandidates}
            />
          </section>
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
