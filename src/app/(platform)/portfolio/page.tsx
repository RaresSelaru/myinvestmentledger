import { EmptyState } from "@/components/investments/empty-state";
import { PortfolioHoldingsTable } from "@/components/investments/portfolio-holdings-table";
import { getPortfolioData } from "@/lib/data";

export default async function PortfolioPage() {
  const workspace = await getPortfolioData();

  return (
    <div className="space-y-4">
      {workspace.holdings.length ? (
        <PortfolioHoldingsTable
          holdings={workspace.holdings}
          currency={workspace.summary.currency}
        />
      ) : (
        <EmptyState
          title="No holdings yet"
          description="Once imported or manually added positions exist, this table becomes the full portfolio view."
          isLocked={workspace.isLocked}
        />
      )}
    </div>
  );
}
