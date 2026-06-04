import { round } from "@/lib/finance";
import type { Fundamentals } from "@/lib/market-data/types";
import type { TargetConfig } from "@/lib/portfolio/engine";
import type { Candidate, CandidateKind, HoldingView } from "@/lib/types";

export type RecommendationInput = {
  holdings: HoldingView[];
  targets: TargetConfig[];
  fundamentalsBySymbol?: Record<string, Fundamentals | null>;
  desiredCorePct?: number;
  desiredSatellitePct?: number;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, round(value, 1)));
}

function scoreTargetPrice(
  kind: CandidateKind,
  currentPrice: number,
  targetPrice: number | null
) {
  if (!targetPrice || !currentPrice) return 50;

  if (kind === "accumulation") {
    return clampScore(50 + ((targetPrice - currentPrice) / targetPrice) * 100);
  }

  return clampScore(50 + ((currentPrice - targetPrice) / targetPrice) * 100);
}

function scoreFundamentals(fundamentals: Fundamentals | null | undefined, kind: CandidateKind) {
  if (!fundamentals) return { score: 50, note: "Fundamentals unavailable" };

  const positives = [
    fundamentals.revenueGrowth !== null ? fundamentals.revenueGrowth > 0 : null,
    fundamentals.epsTrend !== null ? fundamentals.epsTrend > 0 : null,
    fundamentals.freeCashFlowMetric !== null ? fundamentals.freeCashFlowMetric > 0 : null,
  ].filter((value): value is boolean => value !== null);
  const debtPenalty =
    fundamentals.debtMetric !== null && fundamentals.debtMetric > 2 ? 15 : 0;
  const valuationPenalty =
    fundamentals.valuationMetric !== null && fundamentals.valuationMetric > 45 ? 10 : 0;
  const base =
    positives.length === 0
      ? 50
      : (positives.filter(Boolean).length / positives.length) * 100;
  const score = clampScore(base - debtPenalty - valuationPenalty);

  return {
    score: kind === "trimming" ? clampScore(100 - score) : score,
    note: null,
  };
}

function scoreRiskConviction(target: TargetConfig) {
  const conviction = target.convictionLevel?.toLowerCase();
  const risk = target.riskLevel?.toLowerCase();
  let score = 50;

  if (conviction?.includes("high")) score += 25;
  if (conviction?.includes("low")) score -= 20;
  if (risk?.includes("high")) score -= 10;
  if (risk?.includes("low")) score += 5;

  return clampScore(score);
}

function targetFor(symbol: string, targets: TargetConfig[]) {
  return targets.find((target) => target.symbol.toUpperCase() === symbol.toUpperCase());
}

function scoreHolding(
  kind: CandidateKind,
  holding: HoldingView,
  target: TargetConfig,
  input: RecommendationInput
): Candidate | null {
  if (!target || target.targetAllocationPct <= 0 || target.recommendationsDisabled) {
    return null;
  }

  if (
    kind === "accumulation" &&
    target.maxAllocationPct !== null &&
    holding.actualAllocation > target.maxAllocationPct
  ) {
    return null;
  }

  const drift = holding.actualAllocation - target.targetAllocationPct;
  const allocationScore =
    kind === "accumulation"
      ? clampScore(Math.max(0, -drift) * 10)
      : clampScore(Math.max(0, drift) * 10);
  const targetPrice =
    kind === "accumulation" ? target.targetBuyPrice : target.targetSellPrice;
  const targetPriceScore = scoreTargetPrice(kind, holding.currentPrice, targetPrice);
  const coreNeed = (input.desiredCorePct ?? 70) - holding.corePercent;
  const satelliteExcess = holding.satellitePercent - (input.desiredSatellitePct ?? 30);
  const coreSatelliteScore =
    kind === "accumulation"
      ? clampScore(50 + Math.max(0, target.corePct - 50) * 0.8 + Math.max(0, coreNeed) * 0.2)
      : clampScore(50 + Math.max(0, target.satellitePct - 50) * 0.8 + Math.max(0, satelliteExcess) * 0.2);
  const riskConvictionScore = scoreRiskConviction(target);
  const fundamentalResult = scoreFundamentals(
    input.fundamentalsBySymbol?.[holding.symbol],
    kind
  );
  const concentrationScore = clampScore(holding.actualAllocation * 4);
  const weighted =
    kind === "accumulation"
      ? allocationScore * 0.35 +
        targetPriceScore * 0.2 +
        coreSatelliteScore * 0.15 +
        riskConvictionScore * 0.15 +
        fundamentalResult.score * 0.15
      : allocationScore * 0.35 +
        targetPriceScore * 0.25 +
        concentrationScore * 0.1 +
        coreSatelliteScore * 0.15 +
        fundamentalResult.score * 0.15;

  if (weighted <= 0) {
    return null;
  }

  return {
    kind,
    symbol: holding.symbol,
    companyName: holding.companyName,
    actualAllocation: holding.actualAllocation,
    targetAllocation: target.targetAllocationPct,
    drift: round(drift, 2),
    currentPrice: holding.currentPrice,
    targetPrice,
    score: clampScore(weighted),
    factors:
      kind === "accumulation"
        ? [
            { label: "Allocation gap", value: `${allocationScore.toFixed(1)}/100`, score: allocationScore },
            { label: "Target price", value: `${targetPriceScore.toFixed(1)}/100`, score: targetPriceScore },
            { label: "Core/Satellite", value: `${coreSatelliteScore.toFixed(1)}/100`, score: coreSatelliteScore },
            { label: "Risk/Conviction", value: `${riskConvictionScore.toFixed(1)}/100`, score: riskConvictionScore },
            { label: "Fundamentals", value: `${fundamentalResult.score.toFixed(1)}/100`, score: fundamentalResult.score },
          ]
        : [
            { label: "Overweight", value: `${allocationScore.toFixed(1)}/100`, score: allocationScore },
            { label: "Sell target", value: `${targetPriceScore.toFixed(1)}/100`, score: targetPriceScore },
            { label: "Concentration", value: `${concentrationScore.toFixed(1)}/100`, score: concentrationScore },
            { label: "Satellite risk", value: `${coreSatelliteScore.toFixed(1)}/100`, score: coreSatelliteScore },
            { label: "Fundamentals", value: `${fundamentalResult.score.toFixed(1)}/100`, score: fundamentalResult.score },
          ],
    missingDataNotes: fundamentalResult.note ? [fundamentalResult.note] : [],
    dataFreshness: input.fundamentalsBySymbol?.[holding.symbol]?.fetchedAt ?? null,
  };
}

export function scoreRecommendations(input: RecommendationInput) {
  const scoreKind = (kind: CandidateKind) =>
    input.holdings
      .map((holding) => {
        const target = targetFor(holding.symbol, input.targets);
        return target ? scoreHolding(kind, holding, target, input) : null;
      })
      .filter((candidate): candidate is Candidate => Boolean(candidate))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

  return {
    accumulation: scoreKind("accumulation"),
    trimming: scoreKind("trimming"),
  };
}
