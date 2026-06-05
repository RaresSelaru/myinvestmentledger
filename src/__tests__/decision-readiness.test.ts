import { describe, expect, it } from "vitest";
import { calculateDecisionConfidence } from "@/lib/decision/confidence";
import { resolveProviderSymbol } from "@/lib/market-data/symbol-resolver";
import type { HoldingView } from "@/lib/types";

const holding: HoldingView = {
  id: "h1",
  portfolioId: "p1",
  symbol: "ALAB.US",
  companyName: "Astera Labs",
  quantity: 1,
  averageCost: 100,
  currentPrice: 120,
  currency: "USD",
  marketValue: 120,
  costBasis: 100,
  realizedPl: 0,
  unrealizedPl: 20,
  targetAllocation: 8,
  maxAllocation: 12,
  targetBuyPrice: 100,
  targetSellPrice: 160,
  corePercent: 40,
  satellitePercent: 60,
  updatedAt: "2026-06-05T00:00:00.000Z",
  actualAllocation: 6,
  investedAllocation: 6,
  drift: -2,
  plPercent: 20,
};

describe("decision readiness foundation", () => {
  it("resolves broker symbols through verified mappings before aliases", () => {
    const mapped = resolveProviderSymbol({
      internalSymbol: "ALAB.US",
      provider: "fmp",
      mappings: [
        {
          internalSymbol: "ALAB.US",
          provider: "fmp",
          providerSymbol: "ALAB",
          exchange: "NASDAQ",
          currency: "USD",
          assetType: "stock",
          verified: true,
        },
      ],
    });

    expect(mapped.providerSymbol).toBe("ALAB");
    expect(mapped.source).toBe("mapping");
    expect(mapped.verified).toBe(true);
  });

  it("falls back to deterministic aliases for unmapped XTB .US symbols", () => {
    const resolved = resolveProviderSymbol({
      internalSymbol: "ORCL.US",
      provider: "finnhub",
    });

    expect(resolved.providerSymbol).toBe("ORCL");
    expect(resolved.source).toBe("alias");
    expect(resolved.verified).toBe(false);
  });

  it("marks critical manual inputs and non-critical API data separately", () => {
    const confidence = calculateDecisionConfidence({
      holding,
      portfolioBaseCurrency: "RON",
      manualInputs: {
        role: null,
        companyType: null,
        theme: null,
        zoneMode: "suggested",
        manualFairValue: null,
        manualBuyAnchor: null,
        manualTrimAnchor: null,
        thesisIntegrityScore: null,
        catalystQualityScore: null,
        themeStrengthScore: null,
        valueChainCriticalityScore: null,
        macroUncertaintyScore: null,
        qualitativeComment: null,
      },
      hasQuote: false,
      hasPriceHistory: false,
      hasCompanyProfile: false,
      hasFundamentals: false,
      hasSymbolMapping: false,
      staleData: [],
    });

    expect(confidence.criticalMissing).toEqual(["company_type"]);
    expect(confidence.nonCriticalMissing).toContain("quote");
    expect(confidence.nonCriticalMissing).toContain("fundamentals");
    expect(confidence.label).toBe("low");
  });
});
