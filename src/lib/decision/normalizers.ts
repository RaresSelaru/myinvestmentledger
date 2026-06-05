import { DECISION_CONFIG } from "@/lib/decision/config";

export function roundDecision(value: number, precision = 1) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampScore(value: number) {
  return roundDecision(clamp(value), 1);
}

export function manualScoreToHundred(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return DECISION_CONFIG.neutralScore;
  }

  return clampScore(value * 10);
}

export function hasUsefulNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function scoreBelowAnchor(price: number | null, anchor: number | null) {
  if (!hasUsefulNumber(price) || !hasUsefulNumber(anchor)) {
    return DECISION_CONFIG.neutralScore;
  }

  return clampScore(50 + ((anchor - price) / anchor) * 100);
}

export function scoreAboveAnchor(price: number | null, anchor: number | null) {
  if (!hasUsefulNumber(price) || !hasUsefulNumber(anchor)) {
    return DECISION_CONFIG.neutralScore;
  }

  return clampScore(50 + ((price - anchor) / anchor) * 100);
}

export function weightedScore(
  weights: Record<string, number>,
  variables: Record<string, number>
) {
  const totalWeight = Object.values(weights).reduce((total, weight) => total + weight, 0);

  if (!totalWeight) return DECISION_CONFIG.neutralScore;

  return clampScore(
    Object.entries(weights).reduce(
      (total, [key, weight]) =>
        total + (variables[key] ?? DECISION_CONFIG.neutralScore) * weight,
      0
    ) / totalWeight
  );
}
