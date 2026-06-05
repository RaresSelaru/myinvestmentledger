import type { CurrencyCode } from "@/lib/types";

export type MarketDataType = "quote" | "profile" | "fundamentals" | "fx";

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
};
