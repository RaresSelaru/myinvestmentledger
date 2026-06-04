import { AllocationTable } from "@/components/investments/allocation-table";
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total portfolio value"
          value={formatCurrency(summary.totalValue, summary.currency)}
          explain={
            <ExplainNumber
              formula="Holdings market value + cash"
              inputs={[
                {
                  label: "Holdings + cash",
                  value: formatCurrency(summary.totalValue, summary.currency),
                },
              ]}
              updatedAt={summary.updatedAt}
            />
          }
        />
        <MetricCard
          label="Cash"
          value={formatCurrency(summary.cash, summary.currency)}
          explain={
            <ExplainNumber
              formula="External cash flows + trade cash flows; internal transfers excluded from new deposits"
              inputs={[
                {
                  label: "Cash",
                  value: formatCurrency(summary.cash, summary.currency),
                },
              ]}
              updatedAt={summary.updatedAt}
            />
          }
        />
        <MetricCard
          label="Total invested"
          value={formatCurrency(summary.invested, summary.currency)}
          detail="Cost basis where available"
        />
        <MetricCard
          label="Unrealized P/L"
          value={formatCurrency(summary.unrealizedPl, summary.currency)}
          detail={<SignedPercent value={plPercent} />}
        />
        <MetricCard
          label="Realized P/L"
          value={formatCurrency(summary.realizedPl, summary.currency)}
        />
      </section>

      {workspace.holdings.length ? (
        <>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">
                Allocation by symbol
              </h2>
            </div>
            <AllocationTable
              holdings={workspace.holdings}
              transactions={workspace.transactions}
              currency={summary.currency}
            />
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
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
        />
      )}
    </div>
  );
}
