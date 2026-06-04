import type {
  CachedMarketData,
  MarketDataCache,
  MarketDataType,
} from "@/lib/market-data/types";
import type { CurrencyCode } from "@/lib/types";

function cacheKey(key: string, dataType: MarketDataType, currency: CurrencyCode) {
  return `${dataType}:${currency.toUpperCase()}:${key.toUpperCase()}`;
}

export class InMemoryMarketDataCache implements MarketDataCache {
  private entries = new Map<string, CachedMarketData<unknown>>();

  async get<T>(key: string, dataType: MarketDataType, currency: CurrencyCode) {
    return (this.entries.get(cacheKey(key, dataType, currency)) as CachedMarketData<T> | undefined) ?? null;
  }

  async set<T>(entry: CachedMarketData<T>) {
    this.entries.set(cacheKey(entry.key, entry.dataType, entry.currency), entry as CachedMarketData<unknown>);
  }
}

export class SupabaseMarketDataCache implements MarketDataCache {
  constructor(
    private supabase: {
      from: (table: string) => {
        select: (columns: string) => unknown;
        upsert: (payload: unknown, options?: unknown) => Promise<{ error: unknown }>;
      };
    },
    private userId: string
  ) {}

  async get<T>(key: string, dataType: MarketDataType, currency: CurrencyCode) {
    const query = this.supabase
      .from("market_data_cache")
      .select("*") as {
      eq: (column: string, value: unknown) => unknown;
    };
    const result = await (query
      .eq("user_id", this.userId) as {
      eq: (column: string, value: unknown) => unknown;
    })
      .eq("symbol", key.toUpperCase()) as {
      eq: (column: string, value: unknown) => unknown;
    };

    const finalResult = await (result.eq("data_type", dataType) as {
      eq: (column: string, value: unknown) => Promise<{ data: Array<Record<string, unknown>> | null }>;
    }).eq("currency", currency.toUpperCase());
    const row = finalResult.data?.[0];

    if (!row) {
      return null;
    }

    return {
      key,
      dataType,
      currency,
      provider: String(row.provider ?? "cache"),
      payload: row.payload as T,
      fetchedAt: String(row.fetched_at ?? row.as_of ?? new Date(0).toISOString()),
      expiresAt: String(row.expires_at ?? new Date(0).toISOString()),
    };
  }

  async set<T>(entry: CachedMarketData<T>) {
    await this.supabase.from("market_data_cache").upsert(
      {
        user_id: this.userId,
        symbol: entry.key.toUpperCase(),
        provider: entry.provider,
        data_type: entry.dataType,
        payload: entry.payload,
        currency: entry.currency.toUpperCase(),
        price:
          typeof entry.payload === "object" &&
          entry.payload !== null &&
          "price" in entry.payload
            ? Number((entry.payload as { price?: unknown }).price ?? 0)
            : 0,
        as_of: entry.fetchedAt,
        fetched_at: entry.fetchedAt,
        expires_at: entry.expiresAt,
      },
      { onConflict: "user_id,symbol,provider,data_type,currency" }
    );
  }
}
