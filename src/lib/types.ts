export type CurrencyCode = "RON" | "USD" | "EUR" | string;

export type TransactionType =
  | "buy"
  | "sell"
  | "deposit"
  | "withdrawal"
  | "fee"
  | "tax"
  | "dividend"
  | "interest"
  | "internal_transfer"
  | "adjustment"
  | "note";

export type TransactionSource = "manual" | "xtb_import" | "system";

export type CandidateKind = "accumulation" | "trimming";

export type ValuationMode = "import_snapshot" | "live_prices";

export type MarketDataProviderName =
  | "finnhub"
  | "fmp"
  | "alpha_vantage"
  | "twelve_data";

export type DecisionRole = "core" | "satellite" | "speculative";

export type CompanyType =
  | "profitable_growth"
  | "high_growth_unprofitable"
  | "speculative_prerevenue"
  | "industrial_infrastructure"
  | "cyclical_semiconductor"
  | "banks_financials"
  | "commodity_exposed";

export type ZoneMode = "auto" | "manual" | "locked" | "suggested";

export type ConfidenceLabel = "high" | "medium" | "low";

export type DecisionZoneLabel =
  | "strong_accumulation"
  | "light_accumulation"
  | "hold"
  | "trim_review"
  | "strong_trim"
  | "exit_review"
  | "needs_setup";

export type DecisionScoreKind =
  | "accumulation"
  | "hold"
  | "trim"
  | "liquidationRisk"
  | "portfolioFit";

export type DecisionScorePoint = {
  rawScore: number;
  finalScore: number;
};

export type DecisionDriverView = {
  label: string;
  value: string;
  score?: number;
};

export type DecisionGateView = {
  name: string;
  active: boolean;
  label: string;
  effect: string;
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

export type PriceZoneView = {
  symbol: string;
  zoneMode: ZoneMode;
  currentZone: DecisionZoneLabel;
  strongAccumulation: number | null;
  lightAccumulation: number | null;
  holdLow: number | null;
  holdHigh: number | null;
  trimReview: number | null;
  strongTrim: number | null;
  exitReview: number | null;
  currentPrice: number | null;
  manualBuyAnchor: number | null;
  manualTrimAnchor: number | null;
  confidenceLabel: ConfidenceLabel;
  source: "manual" | "calculated" | "provisional";
  lastRecalculatedAt: string | null;
  recalculationReason: string | null;
  suggestedZones?: PriceZoneView | null;
};

export type DecisionScoreView = {
  symbol: string;
  calculationVersion: string;
  calculatedAt: string;
  scores: Record<DecisionScoreKind, DecisionScorePoint>;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  positiveDrivers: DecisionDriverView[];
  negativeDrivers: DecisionDriverView[];
  gates: DecisionGateView[];
  missingData: {
    critical: string[];
    nonCritical: string[];
  };
  staleData: string[];
  interpretation: DecisionZoneLabel;
  recentActivity: RecentActivitySummary | null;
  priceZone: PriceZoneView | null;
};

export type DecisionCandidateView = {
  kind: "accumulation" | "trim";
  symbol: string;
  companyName: string | null;
  score: number;
  currentZone: DecisionZoneLabel;
  reason: string;
  confidenceLabel: ConfidenceLabel;
  gateLabels: string[];
};

export type DecisionCockpit = {
  accumulationCandidates: DecisionCandidateView[];
  trimCandidates: DecisionCandidateView[];
  setup: {
    missingTargetAllocation: number;
    invalidCoreSatelliteSplit: number;
    missingCompanyType: number;
    missingThesisScore: number;
    missingPriceZones: number;
    staleCalculations: number;
  };
};

export type DecisionEventView = {
  id: string;
  date: string;
  symbol: string | null;
  eventType: string;
  reason: string | null;
  summary: string;
};

export type Portfolio = {
  id: string;
  name: string;
  baseCurrency: CurrencyCode;
  tags: string[];
};

export type BrokerAccount = {
  id: string;
  portfolioId: string;
  name: string;
  broker: string;
  baseCurrency: CurrencyCode;
};

export type Transaction = {
  id: string;
  portfolioId: string;
  brokerAccountId: string | null;
  date: string;
  type: TransactionType;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  amount: number;
  currency: CurrencyCode;
  source: TransactionSource;
  comment: string | null;
  sourceLabel?: string;
  isReconciled?: boolean;
  reconciledWithTransactionId?: string | null;
  sourceFingerprint?: string | null;
  sourceReference?: SourceReference | null;
  realizedPl?: number | null;
};

export type Holding = {
  id: string;
  portfolioId: string;
  symbol: string;
  companyName: string | null;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  currency: CurrencyCode;
  marketValue: number;
  costBasis: number;
  realizedPl: number;
  unrealizedPl: number;
  targetAllocation: number;
  maxAllocation: number | null;
  targetBuyPrice: number | null;
  targetSellPrice: number | null;
  corePercent: number;
  satellitePercent: number;
  role?: DecisionRole | null;
  companyType?: CompanyType | null;
  theme?: string | null;
  zoneMode?: ZoneMode;
  manualFairValue?: number | null;
  manualBuyAnchor?: number | null;
  manualTrimAnchor?: number | null;
  thesisIntegrityScore?: number | null;
  catalystQualityScore?: number | null;
  themeStrengthScore?: number | null;
  valueChainCriticalityScore?: number | null;
  macroUncertaintyScore?: number | null;
  qualitativeComment?: string | null;
  updatedAt: string;
  sourceReferences?: SourceReference[];
};

export type HoldingView = Holding & {
  actualAllocation: number;
  investedAllocation: number;
  drift: number;
  plPercent: number;
  targetConfigured?: boolean;
  decisionScore?: DecisionScoreView | null;
  priceZone?: PriceZoneView | null;
};

export type PortfolioSummary = {
  totalValue: number;
  cash: number;
  invested: number;
  unrealizedPl: number;
  realizedPl: number;
  currency: CurrencyCode;
  updatedAt: string;
  valuationMode?: ValuationMode;
  valuationSource?: string;
  cashSource?: string;
  dataStatus?: "snapshot" | "live" | "stale" | "partial";
};

export type AccountOverviewItemKind = "holding" | "cash";

export type AccountOverviewItem = {
  kind: AccountOverviewItemKind;
  symbol: string;
  name: string;
  marketValue: number;
  allocation: number;
  unrealizedPl: number | null;
  plPercent: number | null;
  currency: CurrencyCode;
};

export type AccountOverview = {
  totalValue: number;
  totalCash: number;
  currency: CurrencyCode;
  updatedAt: string;
  items: AccountOverviewItem[];
};

export type MarketDataSettings = {
  livePricesEnabled: boolean;
  valuationMode: ValuationMode;
  preferredProvider: MarketDataProviderName | "auto";
  quoteRefreshIntervalSeconds: number;
};

export type MarketDataApiKeyStatus = {
  provider: MarketDataProviderName;
  enabled: boolean;
  keyLast4: string | null;
  updatedAt: string | null;
};

export type BrokerCashOverride = {
  brokerAccountId: string;
  amount: number;
  currency: CurrencyCode;
  comment: string | null;
};

export type SymbolMappingStatus = {
  internalSymbol: string;
  provider: string | null;
  providerSymbol: string | null;
  exchange: string | null;
  currency: CurrencyCode | null;
  assetType: string | null;
  verified: boolean;
};

export type Candidate = {
  kind: CandidateKind;
  symbol: string;
  companyName: string | null;
  actualAllocation: number;
  targetAllocation: number;
  drift: number;
  currentPrice: number;
  targetPrice: number | null;
  score: number;
  factors: Array<{ label: string; value: string; score?: number }>;
  missingDataNotes?: string[];
  dataFreshness?: string | null;
};

export type ExplainInput = {
  label: string;
  value: string;
};

export type ExplainSource = {
  label: string;
  reference: string;
};

export type SourceReference = {
  importedFileId?: string | null;
  fileName?: string | null;
  sheetName?: string | null;
  rowNumber?: number | null;
  sourceFingerprint?: string | null;
  provider?: string | null;
  fetchedAt?: string | null;
  manualComment?: string | null;
};

export type CashOperation = {
  id: string;
  portfolioId: string;
  brokerAccountId: string;
  operationType: string;
  normalizedType: TransactionType;
  amount: number;
  currency: CurrencyCode;
  occurredAt: string;
  description: string | null;
  symbol: string | null;
  sourceFingerprint: string;
  sourceReference?: SourceReference;
};

export type PositionLot = {
  id: string;
  portfolioId: string;
  brokerAccountId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  openPrice: number;
  currentPrice: number | null;
  costBasis: number;
  marketValue: number | null;
  unrealizedPl: number | null;
  currency: CurrencyCode;
  openedAt: string | null;
  sourceFingerprint: string;
  sourceReference?: SourceReference;
};

export type WorkspaceData = {
  isPreview: boolean;
  isLocked: boolean;
  userEmail: string;
  portfolios: Portfolio[];
  activePortfolio: Portfolio;
  brokerAccounts: BrokerAccount[];
  holdings: HoldingView[];
  transactions: Transaction[];
  summary: PortfolioSummary;
  accountOverview: AccountOverview;
  marketDataSettings?: MarketDataSettings;
  accumulationCandidates: Candidate[];
  trimmingCandidates: Candidate[];
  decisionCockpit: DecisionCockpit;
};

export type StrategyData = Pick<
  WorkspaceData,
  | "isPreview"
  | "isLocked"
  | "userEmail"
  | "portfolios"
  | "activePortfolio"
  | "brokerAccounts"
  | "holdings"
>;

export type SettingsData = Pick<
  WorkspaceData,
  | "isPreview"
  | "isLocked"
  | "userEmail"
  | "portfolios"
  | "activePortfolio"
  | "brokerAccounts"
> & {
  marketDataSettings: MarketDataSettings;
  apiKeys: MarketDataApiKeyStatus[];
  cashOverrides: BrokerCashOverride[];
  symbolMappings: SymbolMappingStatus[];
};

export type WorkspaceShellData = Pick<
  WorkspaceData,
  | "isPreview"
  | "isLocked"
  | "userEmail"
  | "portfolios"
  | "activePortfolio"
  | "brokerAccounts"
>;
