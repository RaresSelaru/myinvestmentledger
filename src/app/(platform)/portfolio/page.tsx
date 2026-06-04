import { EmptyState } from "@/components/investments/empty-state";
import { PageHeader } from "@/components/investments/page-header";
import { PortfolioHoldingsTable } from "@/components/investments/portfolio-holdings-table";
import { getWorkspaceData } from "@/lib/data";

export default async function PortfolioPage() {
  const workspace = await getWorkspaceData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        description="A full holdings view with numeric allocation, drift, and P/L."
      />

      {workspace.holdings.length ? (
        <PortfolioHoldingsTable
          holdings={workspace.holdings}
          currency={workspace.summary.currency}
        />
      ) : (
        <EmptyState
          title="No holdings yet"
          description="Once imported or manually added positions exist, this table becomes the full portfolio view."
        />
      )}
    </div>
  );
}
