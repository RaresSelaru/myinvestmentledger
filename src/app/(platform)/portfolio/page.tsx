import { EmptyState } from "@/components/investments/empty-state";
import { PageHeader } from "@/components/investments/page-header";
import { PortfolioHoldingsTable } from "@/components/investments/portfolio-holdings-table";
import { getPortfolioData } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export default async function PortfolioPage() {
  const workspace = await getPortfolioData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        description="A full holdings view with numeric allocation, drift, and P/L."
      />

      {workspace.holdings.length ? (
        <>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border/70 bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
              Prices: {workspace.summary.valuationSource ?? "XTB snapshot"}
            </span>
            <span className="rounded-full border border-border/70 bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
              Mode:{" "}
              {workspace.summary.valuationMode === "live_prices"
                ? "Live prices"
                : "Import snapshot"}
            </span>
            <span className="rounded-full border border-border/70 bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
              Updated: {formatDateTime(workspace.summary.updatedAt)}
            </span>
          </div>
          <PortfolioHoldingsTable
            holdings={workspace.holdings}
            currency={workspace.summary.currency}
          />
        </>
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
