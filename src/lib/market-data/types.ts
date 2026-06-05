import type { CurrencyCode } from "@/lib/types";

export type MarketDataType =
  | "quote"
  | "profile"
  | "fundamentals"
  | "fx"
  | "price_history"
  | "financial_statements"
  | "financial_ratios"
  | "key_metrics"
  | "symbol_search";

export type ProviderSymbol = string;

export type PriceHistoryRange = {
  from: string;
  to: string;
  interval?: "1d" | "1wk" | "1mo";
};

export type MarketQuote = {
  symbol: string;
  providerSymbol?: string;
  price: number;
  currency: CurrencyCode;
  provider: string;
  fetchedAt: string;
  isStale?: boolean;
};

export type CompanyProfile = {
  symbol: string;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  currency: CurrencyCode | null;
  provider: string;
  fetchedAt: string;
  isStale?: boolean;
};

export type Fundamentals = {
  symbol: string;
  revenueGrowth: number | null;
  epsTrend: number | null;
  debtMetric: number | null;
  freeCashFlowMetric: number | null;
  valuationMetric: number | null;
  provider: string;
  fetchedAt: string;
  isStale?: boolean;
};

export type PricePoint = {
  symbol: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjustedClose: number | null;
  volume: number | null;
  currency: CurrencyCode | null;
  provider: string;
  fetchedAt: string;
};

export type FinancialStatementPeriod = "annual" | "quarterly" | "ttm";

export type FinancialStatementType = "income" | "balance_sheet" | "cash_flow";

export type FinancialStatementRow = {
  symbol: string;
  statementType: FinancialStatementType;
  period: FinancialStatementPeriod;
  fiscalDate: string;
  currency: CurrencyCode | null;
  payload: Record<string, unknown>;
  provider: string;
  fetchedAt: string;
};

export type FinancialRatios = {
  symbol: string;
  period: FinancialStatementPeriod;
  fiscalDate: string | null;
  peRatio: number | null;
  forwardPeRatio: number | null;
  evSales: number | null;
  evEbitda: number | null;
  fcfYield: number | null;
  debtToEquity: number | null;
  payload?: Record<string, unknown>;
  provider: string;
  fetchedAt: string;
};

export type KeyMetrics = {
  symbol: string;
  period: FinancialStatementPeriod;
  fiscalDate: string | null;
  revenueGrowth: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  eps: number | null;
  netIncome: number | null;
  cfo: number | null;
  fcf: number | null;
  ebitda: number | null;
  debt: number | null;
  cash: number | null;
  currentRatio: number | null;
  interestCoverage: number | null;
  shareCount: number | null;
  sbc: number | null;
  marketCap: number | null;
  enterpriseValue: number | null;
  payload?: Record<string, unknown>;
  provider: string;
  fetchedAt: string;
};

export type SymbolSearchResult = {
  provider: string;
  providerSymbol: string;
  displaySymbol: string;
  companyName: string | null;
  exchange: string | null;
  currency: CurrencyCode | null;
  assetType: string | null;
};

export type FxRate = {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  provider: string;
  fetchedAt: string;
  isStale?: boolean;
};

export type CachedMarketData<T> = {
  key: string;
  dataType: MarketDataType;
  currency: CurrencyCode;
  provider: string;
  payload: T;
  fetchedAt: string;
  expiresAt: string;
};

export type MarketDataCache = {
  get<T>(key: string, dataType: MarketDataType, currency: CurrencyCode): Promise<CachedMarketData<T> | null>;
  set<T>(entry: CachedMarketData<T>): Promise<void>;
};

export type MarketDataProvider = {
  name: string;
  getQuote(symbol: string): Promise<MarketQuote | null>;
  getCompanyProfile(symbol: string): Promise<CompanyProfile | null>;
  getFundamentals(symbol: string): Promise<Fundamentals | null>;
  getFxRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<FxRate | null>;
  getPriceHistory?(
    symbol: ProviderSymbol,
    range: PriceHistoryRange
  ): Promise<PricePoint[]>;
  getFinancialStatements?(
    symbol: ProviderSymbol,
    period: FinancialStatementPeriod
  ): Promise<FinancialStatementRow[]>;
  getFinancialRatios?(
    symbol: ProviderSymbol
  ): Promise<FinancialRatios | null>;
  getKeyMetrics?(symbol: ProviderSymbol): Promise<KeyMetrics | null>;
  searchSymbol?(query: string): Promise<SymbolSearchResult[]>;
};

export type FinancialDataProvider = {
  name: "fmp" | "finnhub" | "twelve_data" | "alpha_vantage" | "mock" | string;
  getQuote(symbol: ProviderSymbol): Promise<MarketQuote | null>;
  getPriceHistory(
    symbol: ProviderSymbol,
    range: PriceHistoryRange
  ): Promise<PricePoint[]>;
  getCompanyProfile(symbol: ProviderSymbol): Promise<CompanyProfile | null>;
  getFundamentals(symbol: ProviderSymbol): Promise<Fundamentals | null>;
  getFinancialStatements(
    symbol: ProviderSymbol,
    period: FinancialStatementPeriod
  ): Promise<FinancialStatementRow[]>;
  getFinancialRatios(symbol: ProviderSymbol): Promise<FinancialRatios | null>;
  getKeyMetrics(symbol: ProviderSymbol): Promise<KeyMetrics | null>;
  getFxRate(
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ): Promise<FxRate | null>;
  searchSymbol(query: string): Promise<SymbolSearchResult[]>;
};
