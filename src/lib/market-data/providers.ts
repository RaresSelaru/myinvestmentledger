import type {
  CompanyProfile,
  Fundamentals,
  FxRate,
  MarketDataProvider,
  MarketQuote,
} from "@/lib/market-data/types";
import type { CurrencyCode } from "@/lib/types";
import type { MarketDataProviderName } from "@/lib/types";

async function safeJson(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function now() {
  return new Date().toISOString();
}

export function createFinnhubProvider(apiKey?: string): MarketDataProvider | null {
  if (!apiKey) return null;

  return {
    name: "finnhub",
    async getQuote(symbol: string): Promise<MarketQuote | null> {
      const json = await safeJson(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
      );
      const price = Number(json?.c);

      if (!Number.isFinite(price) || price <= 0) return null;

      return {
        symbol,
        price,
        currency: "USD",
        provider: "finnhub",
        fetchedAt: now(),
      };
    },
    async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
      const json = await safeJson(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
      );

      if (!json) return null;

      return {
        symbol,
        companyName: typeof json.name === "string" ? json.name : null,
        sector: typeof json.finnhubIndustry === "string" ? json.finnhubIndustry : null,
        industry: typeof json.finnhubIndustry === "string" ? json.finnhubIndustry : null,
        marketCap: Number.isFinite(Number(json.marketCapitalization))
          ? Number(json.marketCapitalization)
          : null,
        currency: typeof json.currency === "string" ? json.currency : null,
        provider: "finnhub",
        fetchedAt: now(),
      };
    },
    async getFundamentals(): Promise<Fundamentals | null> {
      return null;
    },
    async getFxRate(): Promise<FxRate | null> {
      return null;
    },
  };
}

export function createFmpProvider(apiKey?: string): MarketDataProvider | null {
  if (!apiKey) return null;

  return {
    name: "fmp",
    async getQuote(symbol: string): Promise<MarketQuote | null> {
      const json = await safeJson(
        `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbol)}?apikey=${apiKey}`
      );
      const row = Array.isArray(json) ? json[0] : null;
      const price = Number(row?.price);

      if (!Number.isFinite(price) || price <= 0) return null;

      return { symbol, price, currency: "USD", provider: "fmp", fetchedAt: now() };
    },
    async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
      const json = await safeJson(
        `https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbol)}?apikey=${apiKey}`
      );
      const row = Array.isArray(json) ? json[0] : null;

      if (!row) return null;

      return {
        symbol,
        companyName: typeof row.companyName === "string" ? row.companyName : null,
        sector: typeof row.sector === "string" ? row.sector : null,
        industry: typeof row.industry === "string" ? row.industry : null,
        marketCap: Number.isFinite(Number(row.mktCap)) ? Number(row.mktCap) : null,
        currency: typeof row.currency === "string" ? row.currency : null,
        provider: "fmp",
        fetchedAt: now(),
      };
    },
    async getFundamentals(symbol: string): Promise<Fundamentals | null> {
      const json = await safeJson(
        `https://financialmodelingprep.com/api/v3/key-metrics-ttm/${encodeURIComponent(symbol)}?apikey=${apiKey}`
      );
      const row = Array.isArray(json) ? json[0] : null;

      if (!row) return null;

      return {
        symbol,
        revenueGrowth: null,
        epsTrend: Number.isFinite(Number(row.netIncomePerShareTTM))
          ? Number(row.netIncomePerShareTTM)
          : null,
        debtMetric: Number.isFinite(Number(row.debtToEquityTTM))
          ? Number(row.debtToEquityTTM)
          : null,
        freeCashFlowMetric: Number.isFinite(Number(row.freeCashFlowPerShareTTM))
          ? Number(row.freeCashFlowPerShareTTM)
          : null,
        valuationMetric: Number.isFinite(Number(row.peRatioTTM))
          ? Number(row.peRatioTTM)
          : null,
        provider: "fmp",
        fetchedAt: now(),
      };
    },
    async getFxRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<FxRate | null> {
      const json = await safeJson(
        `https://financialmodelingprep.com/api/v3/fx/${fromCurrency}${toCurrency}?apikey=${apiKey}`
      );
      const row = Array.isArray(json) ? json[0] : null;
      const rate = Number(row?.bid ?? row?.price);

      if (!Number.isFinite(rate) || rate <= 0) return null;

      return {
        fromCurrency,
        toCurrency,
        rate,
        provider: "fmp",
        fetchedAt: now(),
      };
    },
  };
}

export function createAlphaVantageProvider(apiKey?: string): MarketDataProvider | null {
  if (!apiKey) return null;

  return {
    name: "alpha_vantage",
    async getQuote(symbol: string): Promise<MarketQuote | null> {
      const json = await safeJson(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
      );
      const quote = json?.["Global Quote"] as Record<string, unknown> | undefined;
      const price = Number(quote?.["05. price"]);

      if (!Number.isFinite(price) || price <= 0) return null;

      return { symbol, price, currency: "USD", provider: "alpha_vantage", fetchedAt: now() };
    },
    async getCompanyProfile(): Promise<CompanyProfile | null> {
      return null;
    },
    async getFundamentals(): Promise<Fundamentals | null> {
      return null;
    },
    async getFxRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<FxRate | null> {
      const json = await safeJson(
        `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${apiKey}`
      );
      const data = json?.["Realtime Currency Exchange Rate"] as Record<string, unknown> | undefined;
      const rate = Number(data?.["5. Exchange Rate"]);

      if (!Number.isFinite(rate) || rate <= 0) return null;

      return { fromCurrency, toCurrency, rate, provider: "alpha_vantage", fetchedAt: now() };
    },
  };
}

export function createTwelveDataProvider(apiKey?: string): MarketDataProvider | null {
  if (!apiKey) return null;

  return {
    name: "twelve_data",
    async getQuote(symbol: string): Promise<MarketQuote | null> {
      const json = await safeJson(
        `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
      );
      const price = Number(json?.price);

      if (!Number.isFinite(price) || price <= 0) return null;

      return { symbol, price, currency: "USD", provider: "twelve_data", fetchedAt: now() };
    },
    async getCompanyProfile(): Promise<CompanyProfile | null> {
      return null;
    },
    async getFundamentals(): Promise<Fundamentals | null> {
      return null;
    },
    async getFxRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<FxRate | null> {
      const json = await safeJson(
        `https://api.twelvedata.com/exchange_rate?symbol=${fromCurrency}/${toCurrency}&apikey=${apiKey}`
      );
      const rate = Number(json?.rate);

      if (!Number.isFinite(rate) || rate <= 0) return null;

      return { fromCurrency, toCurrency, rate, provider: "twelve_data", fetchedAt: now() };
    },
  };
}

export function createConfiguredProviders() {
  return [
    createFinnhubProvider(process.env.FINNHUB_API_KEY),
    createFmpProvider(process.env.FMP_API_KEY),
    createAlphaVantageProvider(process.env.ALPHA_VANTAGE_API_KEY),
    createTwelveDataProvider(process.env.TWELVE_DATA_API_KEY),
  ].filter((provider): provider is MarketDataProvider => Boolean(provider));
}

export function createProviderByName(
  provider: MarketDataProviderName,
  apiKey?: string
) {
  if (provider === "finnhub") return createFinnhubProvider(apiKey);
  if (provider === "fmp") return createFmpProvider(apiKey);
  if (provider === "alpha_vantage") return createAlphaVantageProvider(apiKey);
  return createTwelveDataProvider(apiKey);
}
