import {
  createConfiguredProviders,
} from "@/lib/market-data/providers";
import {
  normalizeMarketSymbol,
  providerSymbolCandidates,
} from "@/lib/market-data/symbols";
import type {
  CachedMarketData,
  CompanyProfile,
  Fundamentals,
  FinancialRatios,
  FinancialStatementPeriod,
  FinancialStatementRow,
  FxRate,
  KeyMetrics,
  MarketDataCache,
  MarketDataProvider,
  MarketDataType,
  MarketQuote,
  PriceHistoryRange,
  PricePoint,
  SymbolSearchResult,
} from "@/lib/market-data/types";
import type { CurrencyCode } from "@/lib/types";

const TTL_MS: Record<MarketDataType, number> = {
  quote: 2 * 60 * 1000,
  fx: 15 * 60 * 1000,
  profile: 24 * 60 * 60 * 1000,
  fundamentals: 24 * 60 * 60 * 1000,
  price_history: 24 * 60 * 60 * 1000,
  financial_statements: 24 * 60 * 60 * 1000,
  financial_ratios: 24 * 60 * 60 * 1000,
  key_metrics: 24 * 60 * 60 * 1000,
  symbol_search: 24 * 60 * 60 * 1000,
};

type MarketDataServiceOptions = {
  quoteTtlMs?: number;
};

function withExpiry<T>(
  key: string,
  dataType: MarketDataType,
  currency: CurrencyCode,
  provider: string,
  payload: T,
  fetchedAt: string,
  ttlMs = TTL_MS[dataType]
): CachedMarketData<T> {
  return {
    key,
    dataType,
    currency,
    provider,
    payload,
    fetchedAt,
    expiresAt: new Date(new Date(fetchedAt).getTime() + ttlMs).toISOString(),
  };
}

function isFresh(entry: CachedMarketData<unknown> | null) {
  return Boolean(entry && new Date(entry.expiresAt).getTime() > Date.now());
}

export class MarketDataService {
  constructor(
    private cache: MarketDataCache,
    private providers: MarketDataProvider[] = createConfiguredProviders(),
    private options: MarketDataServiceOptions = {}
  ) {}

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    const appSymbol = normalizeMarketSymbol(symbol);
    const cache = await this.cache.get<MarketQuote>(appSymbol, "quote", "USD");

    if (isFresh(cache)) {
      return cache!.payload;
    }

    for (const provider of this.providers) {
      for (const providerSymbol of providerSymbolCandidates(appSymbol)) {
        const quote = await provider.getQuote(providerSymbol);

        if (quote) {
          const normalizedQuote: MarketQuote = {
            ...quote,
            symbol: appSymbol,
            providerSymbol:
              providerSymbol === appSymbol ? undefined : providerSymbol,
          };

          await this.cache.set(
            withExpiry(
              appSymbol,
              "quote",
              normalizedQuote.currency,
              normalizedQuote.provider,
              normalizedQuote,
              normalizedQuote.fetchedAt,
              this.options.quoteTtlMs
            )
          );
          return normalizedQuote;
        }
      }
    }

    return cache ? { ...cache.payload, symbol: appSymbol, isStale: true } : null;
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
    const cache = await this.cache.get<CompanyProfile>(symbol, "profile", "USD");

    if (isFresh(cache)) {
      return cache!.payload;
    }

    for (const provider of this.providers) {
      const profile = await provider.getCompanyProfile(symbol);

      if (profile) {
        await this.cache.set(withExpiry(symbol, "profile", profile.currency ?? "USD", profile.provider, profile, profile.fetchedAt));
        return profile;
      }
    }

    return cache ? { ...cache.payload, isStale: true } : null;
  }

  async getFundamentals(symbol: string): Promise<Fundamentals | null> {
    const cache = await this.cache.get<Fundamentals>(symbol, "fundamentals", "USD");

    if (isFresh(cache)) {
      return cache!.payload;
    }

    for (const provider of this.providers) {
      const fundamentals = await provider.getFundamentals(symbol);

      if (fundamentals) {
        await this.cache.set(withExpiry(symbol, "fundamentals", "USD", fundamentals.provider, fundamentals, fundamentals.fetchedAt));
        return fundamentals;
      }
    }

    return cache ? { ...cache.payload, isStale: true } : null;
  }

  async getPriceHistory(
    symbol: string,
    range: PriceHistoryRange
  ): Promise<PricePoint[]> {
    const appSymbol = normalizeMarketSymbol(symbol);

    for (const provider of this.providers) {
      if (!provider.getPriceHistory) continue;

      for (const providerSymbol of providerSymbolCandidates(appSymbol)) {
        const history = await provider.getPriceHistory(providerSymbol, range);

        if (history.length) {
          return history.map((point) => ({
            ...point,
            symbol: appSymbol,
          }));
        }
      }
    }

    return [];
  }

  async getFinancialStatements(
    symbol: string,
    period: FinancialStatementPeriod
  ): Promise<FinancialStatementRow[]> {
    const appSymbol = normalizeMarketSymbol(symbol);

    for (const provider of this.providers) {
      if (!provider.getFinancialStatements) continue;

      for (const providerSymbol of providerSymbolCandidates(appSymbol)) {
        const statements = await provider.getFinancialStatements(
          providerSymbol,
          period
        );

        if (statements.length) {
          return statements.map((statement) => ({
            ...statement,
            symbol: appSymbol,
          }));
        }
      }
    }

    return [];
  }

  async getFinancialRatios(symbol: string): Promise<FinancialRatios | null> {
    const appSymbol = normalizeMarketSymbol(symbol);

    for (const provider of this.providers) {
      if (!provider.getFinancialRatios) continue;

      for (const providerSymbol of providerSymbolCandidates(appSymbol)) {
        const ratios = await provider.getFinancialRatios(providerSymbol);

        if (ratios) {
          return { ...ratios, symbol: appSymbol };
        }
      }
    }

    return null;
  }

  async getKeyMetrics(symbol: string): Promise<KeyMetrics | null> {
    const appSymbol = normalizeMarketSymbol(symbol);

    for (const provider of this.providers) {
      if (!provider.getKeyMetrics) continue;

      for (const providerSymbol of providerSymbolCandidates(appSymbol)) {
        const metrics = await provider.getKeyMetrics(providerSymbol);

        if (metrics) {
          return { ...metrics, symbol: appSymbol };
        }
      }
    }

    return null;
  }

  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return [];
    }

    for (const provider of this.providers) {
      if (!provider.searchSymbol) continue;

      const results = await provider.searchSymbol(cleanQuery);

      if (results.length) {
        return results;
      }
    }

    return [];
  }

  async getFxRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<FxRate | null> {
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
      return {
        fromCurrency,
        toCurrency,
        rate: 1,
        provider: "identity",
        fetchedAt: new Date().toISOString(),
      };
    }

    const key = `${fromCurrency}:${toCurrency}`;
    const cache = await this.cache.get<FxRate>(key, "fx", toCurrency);

    if (isFresh(cache)) {
      return cache!.payload;
    }

    for (const provider of this.providers) {
      const rate = await provider.getFxRate(fromCurrency, toCurrency);

      if (rate) {
        await this.cache.set(withExpiry(key, "fx", toCurrency, rate.provider, rate, rate.fetchedAt));
        return rate;
      }
    }

    return cache ? { ...cache.payload, isStale: true } : null;
  }

  async refreshMarketData(symbols: string[]) {
    return Promise.all(symbols.map((symbol) => this.getQuote(symbol)));
  }
}
