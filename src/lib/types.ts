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

export type Portfolio = {
  id: string;
  name: string;
  baseCurrency: CurrencyCode;
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
  updatedAt: string;
  sourceReferences?: SourceReference[];
};

export type HoldingView = Holding & {
  actualAllocation: number;
  investedAllocation: number;
  drift: number;
  plPercent: number;
};

export type PortfolioSummary = {
  totalValue: number;
  cash: number;
  invested: number;
  unrealizedPl: number;
  realizedPl: number;
  currency: CurrencyCode;
  updatedAt: string;
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
  userEmail: string;
  portfolios: Portfolio[];
  activePortfolio: Portfolio;
  brokerAccounts: BrokerAccount[];
  holdings: HoldingView[];
  transactions: Transaction[];
  summary: PortfolioSummary;
  accumulationCandidates: Candidate[];
  trimmingCandidates: Candidate[];
};
