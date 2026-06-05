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
  FxRate,
  MarketDataCache,
  MarketDataProvider,
  MarketDataType,
  MarketQuote,
} from "@/lib/market-data/types";
import type { CurrencyCode } from "@/lib/types";

const TTL_MS: Record<MarketDataType, number> = {
  quote: 2 * 60 * 1000,
  fx: 15 * 60 * 1000,
  profile: 24 * 60 * 60 * 1000,
  fundamentals: 24 * 60 * 60 * 1000,
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
