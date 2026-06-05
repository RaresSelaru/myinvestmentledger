import type {
  Candidate,
  CandidateKind,
  CurrencyCode,
  Holding,
  HoldingView,
  PortfolioSummary,
  Transaction,
} from "@/lib/types";

const EMPTY_UPDATED_AT = "Not available";

export function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateDrift(actualAllocation: number, targetAllocation: number) {
  return round(actualAllocation - targetAllocation, 2);
}

export function calculatePlPercent(marketValue: number, costBasis: number) {
  if (!costBasis) {
    return 0;
  }

  return round(((marketValue - costBasis) / costBasis) * 100, 2);
}

export function enrichHoldings(holdings: Holding[], totalValue: number) {
  const totalSecurityValue = holdings.reduce(
    (total, holding) => total + holding.marketValue,
    0
  );

  return holdings.map<HoldingView>((holding) => {
    const actualAllocation = totalValue
      ? round((holding.marketValue / totalValue) * 100, 2)
      : 0;
    const investedAllocation = totalSecurityValue
      ? round((holding.marketValue / totalSecurityValue) * 100, 2)
      : 0;

    return {
      ...holding,
      actualAllocation,
      investedAllocation,
      drift: calculateDrift(actualAllocation, holding.targetAllocation),
      plPercent: calculatePlPercent(holding.marketValue, holding.costBasis),
      targetConfigured: holding.targetAllocation > 0,
    };
  });
}

export function computePortfolioSummary(
  holdings: Holding[],
  transactions: Transaction[],
  currency: CurrencyCode,
  options: { cash?: number | null; realizedPl?: number | null } = {}
): PortfolioSummary {
  const holdingsValue = holdings.reduce(
    (total, holding) => total + holding.marketValue,
    0
  );
  const invested = holdings.reduce(
    (total, holding) => total + holding.costBasis,
    0
  );
  const unrealizedPl = holdings.reduce(
    (total, holding) => total + holding.unrealizedPl,
    0
  );
  const realizedPl = options.realizedPl ?? holdings.reduce(
    (total, holding) => total + holding.realizedPl,
    0
  );

  const externalCash = transactions.reduce((total, transaction) => {
    if (transaction.type === "deposit") {
      return total + transaction.amount;
    }

    if (
      transaction.type === "withdrawal" ||
      transaction.type === "fee" ||
      transaction.type === "tax"
    ) {
      return total - Math.abs(transaction.amount);
    }

    return total;
  }, 0);

  const tradeCash = transactions.reduce((total, transaction) => {
    if (transaction.type === "buy") {
      return total - Math.abs(transaction.amount);
    }

    if (
      transaction.type === "sell" ||
      transaction.type === "dividend"
    ) {
      return total + Math.abs(transaction.amount);
    }

    return total;
  }, 0);

  const cash = round(options.cash ?? externalCash + tradeCash, 2);
  const lastUpdated =
    holdings
      .map((holding) => holding.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? EMPTY_UPDATED_AT;

  return {
    totalValue: round(holdingsValue + cash, 2),
    cash,
    invested: round(invested, 2),
    unrealizedPl: round(unrealizedPl, 2),
    realizedPl: round(realizedPl, 2),
    currency,
    updatedAt: lastUpdated,
  };
}

export function getSignedTone(
  value: number,
  context: "performance" | "drift" = "performance"
) {
  if (value === 0) {
    return "text-muted-foreground";
  }

  if (context === "drift") {
    return value > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300";
  }

  return value > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300";
}

function priceFactor(kind: CandidateKind, holding: HoldingView) {
  if (kind === "accumulation" && holding.targetBuyPrice) {
    return Math.max(0, 50 + round(((holding.targetBuyPrice - holding.currentPrice) / holding.targetBuyPrice) * 100));
  }

  if (kind === "trimming" && holding.targetSellPrice) {
    return Math.max(0, 50 + round(((holding.currentPrice - holding.targetSellPrice) / holding.targetSellPrice) * 100));
  }

  return 50;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, round(value, 1)));
}

export function rankCandidates(
  holdings: HoldingView[],
  kind: CandidateKind,
  limit = 3
): Candidate[] {
  const scored = holdings
    .map((holding) => {
      const allocationSignal =
        kind === "accumulation"
          ? Math.max(0, -holding.drift)
          : Math.max(0, holding.drift);
      const allocationScore = clampScore(allocationSignal * 10);
      const priceSignal = clampScore(priceFactor(kind, holding));
      const coreSatelliteScore =
        kind === "accumulation"
          ? clampScore(50 + holding.corePercent * 0.4)
          : clampScore(50 + holding.satellitePercent * 0.4);
      const riskConvictionScore = 50;
      const fundamentalsScore = 50;
      const score =
        kind === "accumulation"
          ? clampScore(
              allocationScore * 0.35 +
                priceSignal * 0.2 +
                coreSatelliteScore * 0.15 +
                riskConvictionScore * 0.15 +
                fundamentalsScore * 0.15
            )
          : clampScore(
              allocationScore * 0.35 +
                priceSignal * 0.25 +
                clampScore(holding.actualAllocation * 4) * 0.1 +
                coreSatelliteScore * 0.15 +
                fundamentalsScore * 0.15
            );
      const targetPrice =
        kind === "accumulation"
          ? holding.targetBuyPrice
          : holding.targetSellPrice;

      return {
        kind,
        symbol: holding.symbol,
        companyName: holding.companyName,
        actualAllocation: holding.actualAllocation,
        targetAllocation: holding.targetAllocation,
        drift: holding.drift,
        currentPrice: holding.currentPrice,
        targetPrice,
        score,
        factors: [
          {
            label: kind === "accumulation" ? "Allocation gap" : "Overweight",
            value: `${allocationScore.toFixed(1)}/100`,
            score: allocationScore,
          },
          { label: "Target price", value: `${priceSignal.toFixed(1)}/100`, score: priceSignal },
          {
            label: "Core/Satellite",
            value: `${coreSatelliteScore.toFixed(1)}/100`,
            score: coreSatelliteScore,
          },
          {
            label: "Risk/Conviction",
            value: `${riskConvictionScore.toFixed(1)}/100`,
            score: riskConvictionScore,
          },
          {
            label: "Fundamentals",
            value: `${fundamentalsScore.toFixed(1)}/100`,
            score: fundamentalsScore,
          },
        ],
      } satisfies Candidate;
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
