import type {
  DataQualityIssueDraft,
  DecisionConfidence,
  DecisionReadinessInput,
  ManualDecisionInputs,
} from "@/lib/decision/types";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function labelFor(score: number): DecisionConfidence["label"] {
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function hasManualScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function manualCompleteness(manualInputs: ManualDecisionInputs) {
  const fields = [
    manualInputs.companyType,
    manualInputs.theme,
    manualInputs.manualBuyAnchor,
    manualInputs.manualTrimAnchor,
    manualInputs.thesisIntegrityScore,
    manualInputs.catalystQualityScore,
    manualInputs.themeStrengthScore,
    manualInputs.valueChainCriticalityScore,
    manualInputs.macroUncertaintyScore,
  ];
  const complete = fields.filter((value) =>
    typeof value === "string" ? value.trim().length > 0 : hasManualScore(value)
  ).length;

  return Math.round((complete / fields.length) * 100);
}

function issue(
  issue: DataQualityIssueDraft
): DataQualityIssueDraft {
  return issue;
}

export function calculateDecisionConfidence(
  input: DecisionReadinessInput
): DecisionConfidence {
  const criticalMissing: string[] = [];
  const nonCriticalMissing: string[] = [];
  const issues: DataQualityIssueDraft[] = [];

  if (!input.hasSymbolMapping) {
    nonCriticalMissing.push("symbol_mapping");
    issues.push(
      issue({
        scope: "market_data",
        issueType: "unmapped_symbol",
        severity: "warning",
        symbol: input.holding.symbol,
        message: "Symbol is using automatic provider aliases until verified.",
      })
    );
  }

  if (!input.hasQuote) {
    nonCriticalMissing.push("quote");
    issues.push(
      issue({
        scope: "market_data",
        issueType: "missing_data",
        severity: "warning",
        symbol: input.holding.symbol,
        message: "No current quote is available; snapshot valuation remains available.",
      })
    );
  }

  if (!input.hasPriceHistory) {
    nonCriticalMissing.push("price_history");
  }

  if (!input.hasCompanyProfile) {
    nonCriticalMissing.push("company_profile");
  }

  if (!input.hasFundamentals) {
    nonCriticalMissing.push("fundamentals");
  }

  if (input.holding.targetAllocation <= 0) {
    criticalMissing.push("target_allocation");
    issues.push(
      issue({
        scope: "manual",
        issueType: "manual_input_missing",
        severity: "critical",
        symbol: input.holding.symbol,
        message: "Target allocation is required before deterministic scoring.",
      })
    );
  }

  if (!input.manualInputs.companyType) {
    criticalMissing.push("company_type");
  }

  const manualInputScore = manualCompleteness(input.manualInputs);
  const completenessScore = clamp(
    100 - criticalMissing.length * 22 - nonCriticalMissing.length * 7
  );
  const recencyScore = clamp(100 - input.staleData.length * 15);
  const automatedInputScore = clamp(
    [input.hasQuote, input.hasPriceHistory, input.hasCompanyProfile, input.hasFundamentals]
      .filter(Boolean).length * 25
  );
  const score = clamp(
    Math.round(
      completenessScore * 0.4 +
        recencyScore * 0.2 +
        automatedInputScore * 0.2 +
        manualInputScore * 0.2
    )
  );

  if (input.staleData.length) {
    issues.push(
      issue({
        scope: "market_data",
        issueType: "stale_data",
        severity: "warning",
        symbol: input.holding.symbol,
        message: "One or more market/fundamental inputs are stale.",
      })
    );
  }

  if (score < 55) {
    issues.push(
      issue({
        scope: "symbol",
        issueType: "low_confidence",
        severity: "warning",
        symbol: input.holding.symbol,
        message: "Decision readiness is low; add strategy inputs or refresh data.",
      })
    );
  }

  return {
    score,
    label: labelFor(score),
    completenessScore,
    recencyScore,
    automatedInputScore,
    manualInputScore,
    criticalMissing,
    nonCriticalMissing,
    staleData: input.staleData,
    issues,
  };
}
