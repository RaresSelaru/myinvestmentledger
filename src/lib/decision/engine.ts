import { DECISION_CONFIG } from "@/lib/decision/config";
import {
  clampScore,
  manualScoreToHundred,
  scoreAboveAnchor,
  scoreBelowAnchor,
  weightedScore,
} from "@/lib/decision/normalizers";
import { calculateDecisionPriceZones, mergeLockedZones } from "@/lib/decision/zones";
import type {
  DecisionEngineResult,
  DecisionGateName,
  DecisionGateResult,
  DecisionPriceZones,
  DecisionScoreResult,
  DecisionZoneLabel,
  ManualDecisionInputs,
  RecentActivitySummary,
} from "@/lib/decision/types";
import { DECISION_CALCULATION_VERSION } from "@/lib/decision/types";
import type { DecisionConfidence } from "@/lib/decision/types";
import type { HoldingView } from "@/lib/types";

type EngineInput = {
  holding: HoldingView;
  manualInputs: ManualDecisionInputs;
  confidence: DecisionConfidence;
  recentActivity: RecentActivitySummary;
  totalSpeculativeAllocation: number;
  hasFundamentals: boolean;
  existingZones?: Partial<DecisionPriceZones> | null;
  recalculationReason: string;
  now?: Date;
};

function allocationGapScore(holding: HoldingView) {
  if (holding.targetAllocation <= 0) return DECISION_CONFIG.neutralScore;

  const gap = holding.targetAllocation - holding.actualAllocation;

  if (gap <= 0) return 0;

  return clampScore((gap / Math.max(holding.targetAllocation, 1)) * 100);
}

function allocationExcessScore(holding: HoldingView) {
  if (holding.targetAllocation <= 0) return DECISION_CONFIG.neutralScore;

  const excess = holding.actualAllocation - holding.targetAllocation;

  if (excess <= 0) return 0;

  return clampScore((excess / Math.max(holding.targetAllocation, 1)) * 100);
}

function concentrationPressure(holding: HoldingView) {
  const byTarget =
    holding.targetAllocation > 0
      ? ((holding.actualAllocation - holding.targetAllocation) /
          Math.max(holding.targetAllocation, 1)) *
        70
      : holding.actualAllocation * 4;
  const byMax =
    holding.maxAllocation && holding.maxAllocation > 0
      ? ((holding.actualAllocation - holding.maxAllocation) /
          Math.max(holding.maxAllocation, 1)) *
        90
      : 0;

  return clampScore(Math.max(byTarget, byMax, holding.actualAllocation * 2.4));
}

function roleFit(manualInputs: ManualDecisionInputs, holding: HoldingView) {
  const companyRisk = manualInputs.companyType
    ? DECISION_CONFIG.companyTypeRisk[manualInputs.companyType]
    : DECISION_CONFIG.neutralScore;
  const coreWeight = holding.corePercent / 100;
  const satelliteWeight = holding.satellitePercent / 100;
  const splitFit =
    companyRisk < 45
      ? holding.corePercent * 0.35 + holding.satellitePercent * 0.45
      : holding.corePercent * 0.8 + holding.satellitePercent * 0.58;

  return clampScore(
    splitFit * 0.5 +
      companyRisk * 0.38 +
      (coreWeight * 86 + satelliteWeight * 62) * 0.12
  );
}

function buildVariables(input: EngineInput) {
  const manual = input.manualInputs;
  const thesisBase = manualScoreToHundred(manual.thesisIntegrityScore);
  const catalyst = manualScoreToHundred(manual.catalystQualityScore);
  const theme = manualScoreToHundred(manual.themeStrengthScore);
  const criticality = manualScoreToHundred(manual.valueChainCriticalityScore);
  const macroRisk = manualScoreToHundred(manual.macroUncertaintyScore);
  const thesisIntegrityScore = clampScore(
    thesisBase * 0.62 + catalyst * 0.12 + theme * 0.14 + criticality * 0.12
  );
  const earningsQualityScore = DECISION_CONFIG.neutralScore;
  const balanceSheetResilience = DECISION_CONFIG.neutralScore;
  const valuationAttractivenessScore = scoreBelowAnchor(
    input.holding.currentPrice,
    manual.manualFairValue ?? manual.manualTrimAnchor ?? manual.manualBuyAnchor
  );
  const valuationPressureScore = scoreAboveAnchor(
    input.holding.currentPrice,
    manual.manualTrimAnchor ?? manual.manualFairValue
  );
  const priceDislocationQuality = scoreBelowAnchor(
    input.holding.currentPrice,
    manual.manualBuyAnchor ?? manual.manualFairValue
  );
  const allocationGap = allocationGapScore(input.holding);
  const concentration = concentrationPressure(input.holding);
  const portfolioRoleFit = roleFit(manual, input.holding);
  const satelliteExposureRisk = clampScore(
    input.holding.satellitePercent * 0.55 + input.totalSpeculativeAllocation * 3
  );
  const speculativeRiskScore =
    manual.companyType === "speculative_prerevenue" ||
    input.holding.satellitePercent >= 80
      ? clampScore(satelliteExposureRisk + (100 - portfolioRoleFit) * 0.35)
      : clampScore(100 - portfolioRoleFit);
  const liquidationRiskScore = weightedScore(
    DECISION_CONFIG.scores.liquidationRisk,
    {
      thesisWeaknessScore: 100 - thesisIntegrityScore,
      earningsWeaknessScore: 100 - earningsQualityScore,
      balanceSheetWeaknessScore: 100 - balanceSheetResilience,
      concentrationPressure: concentration,
      speculativeRiskScore,
    }
  );

  return {
    thesis_integrity_score: thesisIntegrityScore,
    earnings_quality_score: earningsQualityScore,
    balance_sheet_resilience: balanceSheetResilience,
    valuation_attractiveness_score: valuationAttractivenessScore,
    valuation_pressure_score: valuationPressureScore,
    price_dislocation_quality: priceDislocationQuality,
    allocation_gap_score: allocationGap,
    concentration_pressure: concentration,
    portfolio_role_fit: portfolioRoleFit,
    liquidation_risk_score: liquidationRiskScore,
    macro_uncertainty_score: macroRisk,
    allocation_excess_score: allocationExcessScore(input.holding),
    satellite_risk_score: clampScore(input.holding.satellitePercent * 0.7 + concentration * 0.3),
    speculative_risk_score: speculativeRiskScore,
  };
}

function gate(
  name: DecisionGateName,
  active: boolean,
  label: string,
  effect: string
): DecisionGateResult {
  return { name, active, label, effect };
}

function buildGates(input: EngineInput, variables: Record<string, number>) {
  const manual = input.manualInputs;
  const thesisBroken =
    variables.thesis_integrity_score < DECISION_CONFIG.gates.thesisBrokenScore ||
    (manual.thesisIntegrityScore !== null && manual.thesisIntegrityScore <= 3);
  const maxAllocation =
    input.holding.maxAllocation !== null &&
    input.holding.maxAllocation > 0 &&
    input.holding.actualAllocation >= input.holding.maxAllocation;
  const speculative =
    (manual.companyType === "speculative_prerevenue" ||
      input.holding.satellitePercent >= 80) &&
    input.totalSpeculativeAllocation >=
      DECISION_CONFIG.gates.speculativePortfolioCapPct;

  return [
    gate(
      "thesis_broken_gate",
      thesisBroken,
      "Thesis review",
      "Caps hold and blocks further accumulation."
    ),
    gate(
      "weak_earnings_gate",
      input.hasFundamentals &&
        variables.earnings_quality_score < DECISION_CONFIG.gates.weakEarningsScore,
      "Earnings quality review",
      "Caps accumulation until earnings quality improves."
    ),
    gate(
      "liquidity_balance_sheet_gate",
      input.hasFundamentals &&
        variables.balance_sheet_resilience <
          DECISION_CONFIG.gates.liquidityBalanceSheetScore,
      "Balance sheet review",
      "Blocks accumulation and raises exit review."
    ),
    gate(
      "max_allocation_gate",
      maxAllocation,
      "Max allocation reached",
      "Blocks further accumulation for this symbol."
    ),
    gate(
      "speculative_exposure_gate",
      speculative,
      "Speculative exposure review",
      "Blocks speculative accumulation while the bucket is above the cap."
    ),
    gate(
      "missing_data_gate",
      input.confidence.criticalMissing.length > 0,
      "Needs setup",
      "Caps scoring until required strategy inputs are set."
    ),
  ];
}

function capForConfidence(score: number, confidence: DecisionConfidence) {
  if (confidence.label === "low") {
    return Math.min(score, DECISION_CONFIG.confidence.lowCap);
  }

  if (confidence.label === "medium") {
    return Math.min(score, DECISION_CONFIG.confidence.mediumCap);
  }

  return score;
}

function scoreResult(rawScore: number, finalScore: number): DecisionScoreResult {
  return {
    rawScore: clampScore(rawScore),
    finalScore: clampScore(finalScore),
  };
}

function applyGates(
  raw: {
    accumulation: number;
    hold: number;
    trim: number;
    liquidationRisk: number;
    portfolioFit: number;
  },
  gates: DecisionGateResult[],
  confidence: DecisionConfidence
) {
  let accumulation = raw.accumulation;
  let hold = raw.hold;
  let trim = raw.trim;
  let liquidationRisk = raw.liquidationRisk;
  let portfolioFit = raw.portfolioFit;
  const active = new Set(gates.filter((gate) => gate.active).map((gate) => gate.name));

  if (active.has("thesis_broken_gate")) {
    accumulation = 0;
    hold = Math.min(hold, 25);
    trim = Math.min(trim, 40);
    liquidationRisk = Math.max(liquidationRisk, 85);
  }

  if (active.has("liquidity_balance_sheet_gate")) {
    accumulation = 0;
    liquidationRisk = Math.max(liquidationRisk, 75);
  }

  if (active.has("weak_earnings_gate")) {
    accumulation = Math.min(accumulation, 20);
  }

  if (active.has("max_allocation_gate") || active.has("speculative_exposure_gate")) {
    accumulation = 0;
  }

  if (active.has("missing_data_gate")) {
    accumulation = Math.min(accumulation, 45);
    trim = Math.min(trim, 55);
    portfolioFit = Math.min(portfolioFit, 50);
  }

  return {
    accumulation: scoreResult(raw.accumulation, capForConfidence(accumulation, confidence)),
    hold: scoreResult(raw.hold, hold),
    trim: scoreResult(raw.trim, capForConfidence(trim, confidence)),
    liquidationRisk: scoreResult(raw.liquidationRisk, liquidationRisk),
    portfolioFit: scoreResult(raw.portfolioFit, portfolioFit),
  };
}

function buildDrivers(variables: Record<string, number>) {
  const positivePool: Array<[string, number]> = [
    ["Allocation gap", variables.allocation_gap_score],
    ["Price dislocation", variables.price_dislocation_quality],
    ["Valuation attractiveness", variables.valuation_attractiveness_score],
    ["Portfolio role fit", variables.portfolio_role_fit],
    ["Thesis integrity", variables.thesis_integrity_score],
  ];
  const negativePool: Array<[string, number]> = [
    ["Concentration pressure", variables.concentration_pressure],
    ["Valuation pressure", variables.valuation_pressure_score],
    ["Liquidation risk", variables.liquidation_risk_score],
    ["Speculative risk", variables.speculative_risk_score],
    ["Macro uncertainty", variables.macro_uncertainty_score],
  ];

  return {
    positiveDrivers: positivePool
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, score]) => ({
        label,
        value: `${score.toFixed(1)}/100`,
        score,
      })),
    negativeDrivers: negativePool
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, score]) => ({
        label,
        value: `${score.toFixed(1)}/100`,
        score,
      })),
  };
}

function interpretation(
  zones: DecisionPriceZones,
  scores: Record<string, DecisionScoreResult>
): DecisionZoneLabel {
  if (scores.liquidationRisk.finalScore >= DECISION_CONFIG.candidateEligibility.exitRiskScore) {
    return "exit_review";
  }

  return zones.currentZone;
}

export function calculateDecisionEngine(input: EngineInput): DecisionEngineResult {
  const calculatedAt = (input.now ?? new Date()).toISOString();
  const variables = buildVariables(input);
  const gates = buildGates(input, variables);
  const calculatedZones = calculateDecisionPriceZones({
    holding: input.holding,
    manualInputs: input.manualInputs,
    confidenceLabel: input.confidence.label,
    hasCriticalMissing: input.confidence.criticalMissing.length > 0,
  });
  const zoneMode = input.manualInputs.zoneMode;
  const suggestedPriceZones =
    zoneMode === "suggested" || zoneMode === "manual" || zoneMode === "locked"
      ? calculatedZones
      : null;
  const effectivePriceZones =
    zoneMode === "locked" ? mergeLockedZones(calculatedZones, input.existingZones) : calculatedZones;
  const concentrationRelief = 100 - variables.concentration_pressure;
  const allocationFit = input.holding.targetAllocation > 0
    ? clampScore(100 - Math.abs(input.holding.drift) * 8)
    : DECISION_CONFIG.neutralScore;
  const raw = {
    accumulation: weightedScore(DECISION_CONFIG.scores.accumulation, {
      thesisIntegrityScore: variables.thesis_integrity_score,
      earningsQualityScore: variables.earnings_quality_score,
      balanceSheetResilience: variables.balance_sheet_resilience,
      valuationAttractivenessScore: variables.valuation_attractiveness_score,
      priceDislocationQuality: variables.price_dislocation_quality,
      allocationGapScore: variables.allocation_gap_score,
      portfolioRoleFit: variables.portfolio_role_fit,
    }),
    hold: weightedScore(DECISION_CONFIG.scores.hold, {
      thesisIntegrityScore: variables.thesis_integrity_score,
      earningsQualityScore: variables.earnings_quality_score,
      balanceSheetResilience: variables.balance_sheet_resilience,
      portfolioRoleFit: variables.portfolio_role_fit,
      valuationAttractivenessScore: variables.valuation_attractiveness_score,
      priceDislocationQuality: variables.price_dislocation_quality,
      concentrationRelief,
    }),
    trim: weightedScore(DECISION_CONFIG.scores.trim, {
      valuationPressureScore: variables.valuation_pressure_score,
      concentrationPressure: variables.concentration_pressure,
      allocationExcessScore: variables.allocation_excess_score,
      satelliteRiskScore: variables.satellite_risk_score,
      thesisWeaknessScore: 100 - variables.thesis_integrity_score,
    }),
    liquidationRisk: variables.liquidation_risk_score,
    portfolioFit: weightedScore(DECISION_CONFIG.scores.portfolioFit, {
      allocationFit,
      roleFit: variables.portfolio_role_fit,
      concentrationFit: concentrationRelief,
      confidenceFit: input.confidence.score,
    }),
  };
  const scores = applyGates(raw, gates, input.confidence);
  const drivers = buildDrivers(variables);

  return {
    symbol: input.holding.symbol,
    calculationVersion: DECISION_CALCULATION_VERSION,
    calculatedAt,
    scores,
    variables,
    confidence: input.confidence,
    gates,
    positiveDrivers: drivers.positiveDrivers,
    negativeDrivers: drivers.negativeDrivers,
    missingData: {
      critical: input.confidence.criticalMissing,
      nonCritical: input.confidence.nonCriticalMissing,
    },
    staleData: input.confidence.staleData,
    priceZones: calculatedZones,
    effectivePriceZones,
    suggestedPriceZones,
    recentActivity: input.recentActivity,
    interpretation: interpretation(effectivePriceZones, scores),
    recalculationReason: input.recalculationReason,
    rawInputs: {
      holding: {
        symbol: input.holding.symbol,
        actualAllocation: input.holding.actualAllocation,
        targetAllocation: input.holding.targetAllocation,
        maxAllocation: input.holding.maxAllocation,
        currentPrice: input.holding.currentPrice,
        averageCost: input.holding.averageCost,
        marketValue: input.holding.marketValue,
        currency: input.holding.currency,
      },
      manualInputs: input.manualInputs,
      totalSpeculativeAllocation: input.totalSpeculativeAllocation,
    },
  };
}
