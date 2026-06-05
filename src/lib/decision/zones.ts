import { DECISION_CONFIG } from "@/lib/decision/config";
import {
  clamp,
  hasUsefulNumber,
  roundDecision,
} from "@/lib/decision/normalizers";
import type {
  DecisionPriceZones,
  DecisionZoneLabel,
  ManualDecisionInputs,
} from "@/lib/decision/types";
import type { ConfidenceLabel, HoldingView } from "@/lib/types";

function pct(value: number, percent: number) {
  return roundDecision(value * (percent / 100), 4);
}

function anchorSource(manualInputs: ManualDecisionInputs) {
  if (
    hasUsefulNumber(manualInputs.manualBuyAnchor) ||
    hasUsefulNumber(manualInputs.manualTrimAnchor) ||
    hasUsefulNumber(manualInputs.manualFairValue)
  ) {
    return "manual" as const;
  }

  return "calculated" as const;
}

function classifyCurrentZone(input: {
  price: number | null;
  strongAccumulation: number | null;
  lightAccumulation: number | null;
  holdLow: number | null;
  holdHigh: number | null;
  trimReview: number | null;
  strongTrim: number | null;
  exitReview: number | null;
  hasCriticalMissing: boolean;
}): DecisionZoneLabel {
  const price = input.price;

  if (input.hasCriticalMissing || !hasUsefulNumber(price)) {
    return "needs_setup";
  }

  if (hasUsefulNumber(input.exitReview) && price <= input.exitReview) {
    return "exit_review";
  }

  if (hasUsefulNumber(input.strongAccumulation) && price <= input.strongAccumulation) {
    return "strong_accumulation";
  }

  if (hasUsefulNumber(input.lightAccumulation) && price <= input.lightAccumulation) {
    return "light_accumulation";
  }

  if (hasUsefulNumber(input.strongTrim) && price >= input.strongTrim) {
    return "strong_trim";
  }

  if (hasUsefulNumber(input.trimReview) && price >= input.trimReview) {
    return "trim_review";
  }

  if (
    hasUsefulNumber(input.holdLow) &&
    hasUsefulNumber(input.holdHigh) &&
    price >= input.holdLow &&
    price <= input.holdHigh
  ) {
    return "hold";
  }

  return "hold";
}

export function calculateDecisionPriceZones({
  holding,
  manualInputs,
  confidenceLabel,
  hasCriticalMissing,
}: {
  holding: HoldingView;
  manualInputs: ManualDecisionInputs;
  confidenceLabel: ConfidenceLabel;
  hasCriticalMissing: boolean;
}): DecisionPriceZones {
  const currentPrice = hasUsefulNumber(holding.currentPrice)
    ? holding.currentPrice
    : hasUsefulNumber(holding.averageCost)
      ? holding.averageCost
      : null;
  const fairValue = hasUsefulNumber(manualInputs.manualFairValue)
    ? manualInputs.manualFairValue
    : currentPrice;
  const source = currentPrice ? anchorSource(manualInputs) : "provisional";
  const calculatedBuyAnchor = hasUsefulNumber(fairValue)
    ? pct(fairValue, 100 - DECISION_CONFIG.zones.lightAccumulationDiscountPct)
    : currentPrice;
  const calculatedTrimAnchor = hasUsefulNumber(fairValue)
    ? pct(fairValue, 100 + DECISION_CONFIG.zones.trimReviewPremiumPct)
    : currentPrice;
  const buyAnchor = manualInputs.manualBuyAnchor ?? calculatedBuyAnchor;
  const trimAnchor = manualInputs.manualTrimAnchor ?? calculatedTrimAnchor;
  const strongAccumulation = hasUsefulNumber(buyAnchor)
    ? pct(
        buyAnchor,
        100 - DECISION_CONFIG.zones.strongAccumulationDiscountPct
      )
    : hasUsefulNumber(currentPrice)
      ? pct(currentPrice, DECISION_CONFIG.zones.provisionalStrongAccumulationPct)
      : null;
  const lightAccumulation = hasUsefulNumber(buyAnchor)
    ? buyAnchor
    : hasUsefulNumber(currentPrice)
      ? pct(currentPrice, DECISION_CONFIG.zones.provisionalLightAccumulationPct)
      : null;
  const holdLow = hasUsefulNumber(lightAccumulation)
    ? lightAccumulation
    : hasUsefulNumber(currentPrice)
      ? pct(currentPrice, 100 - DECISION_CONFIG.zones.holdBufferPct)
      : null;
  const holdHigh = hasUsefulNumber(trimAnchor)
    ? trimAnchor
    : hasUsefulNumber(currentPrice)
      ? pct(currentPrice, 100 + DECISION_CONFIG.zones.holdBufferPct)
      : null;
  const trimReview = hasUsefulNumber(trimAnchor)
    ? trimAnchor
    : hasUsefulNumber(currentPrice)
      ? pct(currentPrice, DECISION_CONFIG.zones.provisionalTrimPct)
      : null;
  const strongTrim = hasUsefulNumber(trimReview)
    ? pct(trimReview, 100 + DECISION_CONFIG.zones.strongTrimPremiumPct)
    : hasUsefulNumber(currentPrice)
      ? pct(currentPrice, DECISION_CONFIG.zones.provisionalStrongTrimPct)
      : null;
  const exitReview = hasUsefulNumber(strongAccumulation)
    ? pct(strongAccumulation, 85)
    : null;
  const currentZone = classifyCurrentZone({
    price: currentPrice,
    strongAccumulation,
    lightAccumulation,
    holdLow,
    holdHigh,
    trimReview,
    strongTrim,
    exitReview,
    hasCriticalMissing,
  });

  return {
    strongAccumulation: clampNullable(strongAccumulation),
    lightAccumulation: clampNullable(lightAccumulation),
    holdLow: clampNullable(holdLow),
    holdHigh: clampNullable(holdHigh),
    trimReview: clampNullable(trimReview),
    strongTrim: clampNullable(strongTrim),
    exitReview: clampNullable(exitReview),
    currentZone,
    currentPrice,
    manualBuyAnchor: manualInputs.manualBuyAnchor,
    manualTrimAnchor: manualInputs.manualTrimAnchor,
    calculatedBuyAnchor,
    calculatedTrimAnchor,
    confidenceLabel,
    zoneMode: manualInputs.zoneMode,
    source,
  };
}

function clampNullable(value: number | null) {
  return hasUsefulNumber(value) ? roundDecision(clamp(value, 0, Number.MAX_SAFE_INTEGER), 4) : null;
}

export function mergeLockedZones(
  calculated: DecisionPriceZones,
  existing: Partial<DecisionPriceZones> | null | undefined
): DecisionPriceZones {
  if (!existing) return calculated;

  return {
    ...calculated,
    strongAccumulation: existing.strongAccumulation ?? calculated.strongAccumulation,
    lightAccumulation: existing.lightAccumulation ?? calculated.lightAccumulation,
    holdLow: existing.holdLow ?? calculated.holdLow,
    holdHigh: existing.holdHigh ?? calculated.holdHigh,
    trimReview: existing.trimReview ?? calculated.trimReview,
    strongTrim: existing.strongTrim ?? calculated.strongTrim,
    exitReview: existing.exitReview ?? calculated.exitReview,
    currentZone: existing.currentZone ?? calculated.currentZone,
  };
}
