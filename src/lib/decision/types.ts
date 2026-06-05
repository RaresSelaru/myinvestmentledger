import type {
  CompanyType,
  ConfidenceLabel,
  CurrencyCode,
  DecisionRole,
  HoldingView,
  Transaction,
  ZoneMode,
} from "@/lib/types";

export const DECISION_CALCULATION_VERSION = "decision-mvp-v1";

export type ManualDecisionInputs = {
  role: DecisionRole | null;
  companyType: CompanyType | null;
  theme: string | null;
  zoneMode: ZoneMode;
  manualFairValue: number | null;
  manualBuyAnchor: number | null;
  manualTrimAnchor: number | null;
  thesisIntegrityScore: number | null;
  catalystQualityScore: number | null;
  themeStrengthScore: number | null;
  valueChainCriticalityScore: number | null;
  macroUncertaintyScore: number | null;
  qualitativeComment: string | null;
};

export type DecisionReadinessInput = {
  holding: HoldingView;
  portfolioBaseCurrency: CurrencyCode;
  manualInputs: ManualDecisionInputs;
  hasQuote: boolean;
  hasPriceHistory: boolean;
  hasCompanyProfile: boolean;
  hasFundamentals: boolean;
  hasSymbolMapping: boolean;
  staleData: string[];
};

export type DataQualityIssueDraft = {
  scope: "portfolio" | "symbol" | "market_data" | "fundamentals" | "manual";
  issueType:
    | "missing_data"
    | "stale_data"
    | "unmapped_symbol"
    | "manual_input_missing"
    | "low_confidence";
  severity: "info" | "warning" | "critical";
  message: string;
  symbol?: string | null;
};

export type DecisionConfidence = {
  score: number;
  label: ConfidenceLabel;
  completenessScore: number;
  recencyScore: number;
  automatedInputScore: number;
  manualInputScore: number;
  criticalMissing: string[];
  nonCriticalMissing: string[];
  staleData: string[];
  issues: DataQualityIssueDraft[];
};

export type DecisionScoreSnapshot = {
  symbol: string;
  calculationVersion: string;
  confidence: DecisionConfidence;
  rawInputs: Record<string, unknown>;
  rawOutputs: Record<string, unknown>;
};

export type DecisionScoreName =
  | "accumulation"
  | "hold"
  | "trim"
  | "liquidationRisk"
  | "portfolioFit";

export type DecisionGateName =
  | "thesis_broken_gate"
  | "weak_earnings_gate"
  | "liquidity_balance_sheet_gate"
  | "max_allocation_gate"
  | "speculative_exposure_gate"
  | "missing_data_gate";

export type DecisionZoneLabel =
  | "strong_accumulation"
  | "light_accumulation"
  | "hold"
  | "trim_review"
  | "strong_trim"
  | "exit_review"
  | "needs_setup";

export type DecisionDriver = {
  label: string;
  value: string;
  score?: number;
};

export type DecisionGateResult = {
  name: DecisionGateName;
  active: boolean;
  label: string;
  effect: string;
};

export type DecisionScoreResult = {
  rawScore: number;
  finalScore: number;
};

export type RecentActivitySummary = {
  latestBuy: Transaction | null;
  latestSell: Transaction | null;
  buys30d: number;
  buys60d: number;
  buys90d: number;
  averageRecentBuyPrice: number | null;
  recentBuyInsideAccumulationZone: boolean | null;
  recentSellInsideTrimZone: boolean | null;
  allocationAfterRecentActivity: number;
  maxAllocationNearOrExceeded: boolean;
  lastActivityConsideredAt: string | null;
};

export type DecisionPriceZones = {
  strongAccumulation: number | null;
  lightAccumulation: number | null;
  holdLow: number | null;
  holdHigh: number | null;
  trimReview: number | null;
  strongTrim: number | null;
  exitReview: number | null;
  currentZone: DecisionZoneLabel;
  currentPrice: number | null;
  manualBuyAnchor: number | null;
  manualTrimAnchor: number | null;
  calculatedBuyAnchor: number | null;
  calculatedTrimAnchor: number | null;
  confidenceLabel: ConfidenceLabel;
  zoneMode: ZoneMode;
  source: "manual" | "calculated" | "provisional";
};

export type DecisionEngineResult = {
  symbol: string;
  calculationVersion: string;
  calculatedAt: string;
  scores: Record<DecisionScoreName, DecisionScoreResult>;
  variables: Record<string, number>;
  confidence: DecisionConfidence;
  gates: DecisionGateResult[];
  positiveDrivers: DecisionDriver[];
  negativeDrivers: DecisionDriver[];
  missingData: {
    critical: string[];
    nonCritical: string[];
  };
  staleData: string[];
  priceZones: DecisionPriceZones;
  effectivePriceZones: DecisionPriceZones;
  suggestedPriceZones: DecisionPriceZones | null;
  recentActivity: RecentActivitySummary;
  interpretation: DecisionZoneLabel;
  recalculationReason: string;
  rawInputs: Record<string, unknown>;
};
