import { EmptyState } from "@/components/investments/empty-state";
import { LiveQuotesRefresher } from "@/components/investments/live-quotes-refresher";
import { PortfolioHoldingsTable } from "@/components/investments/portfolio-holdings-table";
import { getPortfolioData } from "@/lib/data";

export default async function PortfolioPage() {
  const workspace = await getPortfolioData();

  return (
    <div className="space-y-4">
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
