import { DECISION_CONFIG } from "@/lib/decision/config";
import { hasUsefulNumber, roundDecision } from "@/lib/decision/normalizers";
import type { DecisionPriceZones, RecentActivitySummary } from "@/lib/decision/types";
import type { HoldingView, Transaction } from "@/lib/types";

function daysAgo(date: Date, days: number) {
  return date.getTime() - days * 24 * 60 * 60 * 1000;
}

function transactionTime(transaction: Transaction) {
  const time = new Date(transaction.date).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isInsideAccumulationZone(
  transaction: Transaction | null,
  zones: DecisionPriceZones | null
) {
  if (!transaction || !zones || !hasUsefulNumber(transaction.price)) return null;

  if (hasUsefulNumber(zones.lightAccumulation)) {
    return transaction.price <= zones.lightAccumulation;
  }

  return null;
}

function isInsideTrimZone(
  transaction: Transaction | null,
  zones: DecisionPriceZones | null
) {
  if (!transaction || !zones || !hasUsefulNumber(transaction.price)) return null;

  if (hasUsefulNumber(zones.trimReview)) {
    return transaction.price >= zones.trimReview;
  }

  return null;
}

export function summarizeRecentActivity({
  holding,
  transactions,
  zones,
  now = new Date(),
}: {
  holding: HoldingView;
  transactions: Transaction[];
  zones?: DecisionPriceZones | null;
  now?: Date;
}): RecentActivitySummary {
  const symbol = holding.symbol.toUpperCase();
  const symbolTransactions = transactions
    .filter((transaction) => transaction.symbol?.toUpperCase() === symbol)
    .sort((a, b) => transactionTime(b) - transactionTime(a));
  const buys = symbolTransactions.filter((transaction) => transaction.type === "buy");
  const sells = symbolTransactions.filter((transaction) => transaction.type === "sell");
  const recentBuys = buys.filter(
    (transaction) => transactionTime(transaction) >= daysAgo(now, 90)
  );
  const averageRecentBuyPrice =
    recentBuys.length && recentBuys.some((transaction) => hasUsefulNumber(transaction.price))
      ? roundDecision(
          recentBuys.reduce((total, transaction) => total + (transaction.price ?? 0), 0) /
            recentBuys.length,
          4
        )
      : null;

  return {
    latestBuy: buys[0] ?? null,
    latestSell: sells[0] ?? null,
    buys30d: buys.filter((transaction) => transactionTime(transaction) >= daysAgo(now, 30))
      .length,
    buys60d: buys.filter((transaction) => transactionTime(transaction) >= daysAgo(now, 60))
      .length,
    buys90d: recentBuys.length,
    averageRecentBuyPrice,
    recentBuyInsideAccumulationZone: isInsideAccumulationZone(buys[0] ?? null, zones ?? null),
    recentSellInsideTrimZone: isInsideTrimZone(sells[0] ?? null, zones ?? null),
    allocationAfterRecentActivity: holding.actualAllocation,
    maxAllocationNearOrExceeded:
      holding.maxAllocation !== null &&
      holding.maxAllocation > 0 &&
      holding.actualAllocation >=
        holding.maxAllocation * (DECISION_CONFIG.gates.nearMaxAllocationPct / 100),
    lastActivityConsideredAt:
      symbolTransactions[0]?.date ?? holding.updatedAt ?? now.toISOString(),
  };
}
