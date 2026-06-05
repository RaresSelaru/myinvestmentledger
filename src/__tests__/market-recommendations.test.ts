import { describe, expect, it } from "vitest";
import { InMemoryMarketDataCache } from "@/lib/market-data/cache";
import { MarketDataService } from "@/lib/market-data/service";
import type { MarketDataProvider, MarketQuote } from "@/lib/market-data/types";
import { scoreRecommendations } from "@/lib/recommendations/scoring";
import type { HoldingView } from "@/lib/types";

function provider(name: string, price: number | null): MarketDataProvider {
  return {
    name,
    async getQuote(symbol) {
      return price
        ? {
            symbol,
            price,
            currency: "USD",
            provider: name,
            fetchedAt: new Date().toISOString(),
          }
        : null;
    },
    async getCompanyProfile() {
      return null;
    },
    async getFundamentals() {
      return null;
    },
    async getFxRate() {
      return null;
    },
  };
}

const holding: HoldingView = {
  id: "h-1",
  portfolioId: "p",
  symbol: "AAPL",
  companyName: "Apple Inc.",
  quantity: 2,
  averageCost: 100,
  currentPrice: 90,
  currency: "USD",
  marketValue: 180,
  costBasis: 200,
  realizedPl: 0,
  unrealizedPl: -20,
  targetAllocation: 30,
  maxAllocation: 40,
  targetBuyPrice: 100,
  targetSellPrice: 140,
  corePercent: 80,
  satellitePercent: 20,
  updatedAt: "2026-01-01T00:00:00.000Z",
  actualAllocation: 20,
  investedAllocation: 20,
  drift: -10,
  plPercent: -10,
};

describe("market data and recommendations", () => {
  it("falls back providers and returns stale cache when APIs fail", async () => {
    const cache = new InMemoryMarketDataCache();
    const service = new MarketDataService(cache, [
      provider("first", null),
      provider("second", 123),
    ]);

    const quote = await service.getQuote("AAPL");
    expect(quote?.provider).toBe("second");

    await cache.set({
      key: "AAPL",
      dataType: "quote",
      currency: "USD",
      provider: "second",
      payload: {
        symbol: "AAPL",
        price: 123,
        currency: "USD",
        provider: "second",
        fetchedAt: "2026-01-01T00:00:00.000Z",
      },
      fetchedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:01:00.000Z",
    });
    const staleOnly = new MarketDataService(cache, [provider("offline", null)]);
    const stale = await staleOnly.getQuote("AAPL");
    expect(stale?.price).toBe(123);
    expect(stale?.isStale).toBe(true);
  });

  it("stores XTB .US quote aliases under the app symbol", async () => {
    const cache = new InMemoryMarketDataCache();
    const requestedSymbols: string[] = [];
    const service = new MarketDataService(cache, [
      {
        ...provider("alias-aware", null),
        async getQuote(symbol) {
          requestedSymbols.push(symbol);

          if (symbol !== "ALAB") {
            return null;
          }

          return {
            symbol,
            price: 340,
            currency: "USD",
            provider: "alias-aware",
            fetchedAt: new Date().toISOString(),
          };
        },
      },
    ]);

    const quote = await service.getQuote("ALAB.US");
    const cached = await cache.get<MarketQuote>("ALAB.US", "quote", "USD");

    expect(requestedSymbols).toEqual(["ALAB.US", "ALAB"]);
    expect(quote?.symbol).toBe("ALAB.US");
    expect(quote?.providerSymbol).toBe("ALAB");
    expect(cached?.payload.symbol).toBe("ALAB.US");
  });

  it("scores transparent accumulation and trimming candidates", () => {
    const scored = scoreRecommendations({
      holdings: [holding, { ...holding, symbol: "NVDA", actualAllocation: 55, drift: 25, satellitePercent: 80, corePercent: 20 }],
      targets: [
        {
          symbol: "AAPL",
          targetAllocationPct: 30,
          maxAllocationPct: 40,
          corePct: 80,
          satellitePct: 20,
          targetBuyPrice: 100,
          targetSellPrice: 140,
          convictionLevel: "high",
          riskLevel: "medium",
        },
        {
          symbol: "NVDA",
          targetAllocationPct: 30,
          maxAllocationPct: 60,
          corePct: 20,
          satellitePct: 80,
          targetBuyPrice: 75,
          targetSellPrice: 95,
          convictionLevel: "medium",
          riskLevel: "high",
        },
      ],
    });

    expect(scored.accumulation[0].symbol).toBe("AAPL");
    expect(scored.accumulation[0].score).toBeGreaterThan(50);
    expect(scored.accumulation[0].factors).toHaveLength(5);
    expect(scored.trimming[0].symbol).toBe("NVDA");
    expect(scored.trimming[0].score).toBeGreaterThan(50);
  });
});
