import { describe, expect, it } from "vitest";
import { calculateDecisionConfidence } from "@/lib/decision/confidence";
import { calculateDecisionEngine } from "@/lib/decision/engine";
import { summarizeRecentActivity } from "@/lib/decision/recent-activity";
import { calculateDecisionPriceZones } from "@/lib/decision/zones";
import type { ManualDecisionInputs } from "@/lib/decision/types";
import type { HoldingView, Transaction } from "@/lib/types";

const baseHolding: HoldingView = {
  id: "h1",
  portfolioId: "p1",
  symbol: "ALAB.US",
  companyName: "Astera Labs",
  quantity: 10,
  averageCost: 100,
  currentPrice: 90,
  currency: "USD",
  marketValue: 900,
  costBasis: 1000,
  realizedPl: 0,
  unrealizedPl: -100,
  targetAllocation: 10,
  maxAllocation: 14,
  targetBuyPrice: 95,
  targetSellPrice: 140,
  corePercent: 40,
  satellitePercent: 60,
  role: "satellite",
  companyType: "profitable_growth",
  theme: "AI infrastructure",
  zoneMode: "auto",
  manualFairValue: 125,
  manualBuyAnchor: 95,
  manualTrimAnchor: 140,
  thesisIntegrityScore: 8,
  catalystQualityScore: 7,
  themeStrengthScore: 8,
  valueChainCriticalityScore: 7,
  macroUncertaintyScore: 4,
  qualitativeComment: null,
  updatedAt: "2026-06-05T00:00:00.000Z",
  actualAllocation: 4,
  investedAllocation: 5,
  drift: -6,
  plPercent: -10,
  targetConfigured: true,
};

function manual(holding = baseHolding): ManualDecisionInputs {
  return {
    role: holding.role ?? null,
    companyType: holding.companyType ?? null,
    theme: holding.theme ?? null,
    zoneMode: holding.zoneMode ?? "suggested",
    manualFairValue: holding.manualFairValue ?? null,
    manualBuyAnchor: holding.manualBuyAnchor ?? null,
    manualTrimAnchor: holding.manualTrimAnchor ?? null,
    thesisIntegrityScore: holding.thesisIntegrityScore ?? null,
    catalystQualityScore: holding.catalystQualityScore ?? null,
    themeStrengthScore: holding.themeStrengthScore ?? null,
    valueChainCriticalityScore: holding.valueChainCriticalityScore ?? null,
    macroUncertaintyScore: holding.macroUncertaintyScore ?? null,
    qualitativeComment: holding.qualitativeComment ?? null,
  };
}

function confidence(holding = baseHolding) {
  return calculateDecisionConfidence({
    holding,
    portfolioBaseCurrency: "RON",
    manualInputs: manual(holding),
    hasQuote: true,
    hasPriceHistory: false,
    hasCompanyProfile: false,
    hasFundamentals: false,
    hasSymbolMapping: true,
    staleData: [],
  });
}

describe("MVP decision engine", () => {
  it("scores an eligible accumulation setup without blocking gates", () => {
    const recentActivity = summarizeRecentActivity({
      holding: baseHolding,
      transactions: [],
    });
    const result = calculateDecisionEngine({
      holding: baseHolding,
      manualInputs: manual(),
      confidence: confidence(),
      recentActivity,
      totalSpeculativeAllocation: 0,
      hasFundamentals: false,
      recalculationReason: "test",
    });

    expect(result.calculationVersion).toBe("decision-mvp-v1");
    expect(result.scores.accumulation.finalScore).toBeGreaterThan(45);
    expect(result.gates.filter((gate) => gate.active).map((gate) => gate.name)).not.toContain(
      "max_allocation_gate"
    );
    expect(result.priceZones.currentZone).not.toBe("needs_setup");
  });

  it("blocks accumulation when max allocation is exceeded", () => {
    const holding = {
      ...baseHolding,
      actualAllocation: 16,
      drift: 6,
    };
    const result = calculateDecisionEngine({
      holding,
      manualInputs: manual(holding),
      confidence: confidence(holding),
      recentActivity: summarizeRecentActivity({ holding, transactions: [] }),
      totalSpeculativeAllocation: 0,
      hasFundamentals: false,
      recalculationReason: "test",
    });

    expect(result.gates.find((gate) => gate.name === "max_allocation_gate")?.active).toBe(true);
    expect(result.scores.accumulation.finalScore).toBe(0);
  });

  it("raises exit review when thesis score is broken", () => {
    const holding = {
      ...baseHolding,
      thesisIntegrityScore: 3,
    };
    const result = calculateDecisionEngine({
      holding,
      manualInputs: manual(holding),
      confidence: confidence(holding),
      recentActivity: summarizeRecentActivity({ holding, transactions: [] }),
      totalSpeculativeAllocation: 0,
      hasFundamentals: false,
      recalculationReason: "test",
    });

    expect(result.gates.find((gate) => gate.name === "thesis_broken_gate")?.active).toBe(true);
    expect(result.scores.accumulation.finalScore).toBe(0);
    expect(result.scores.liquidationRisk.finalScore).toBeGreaterThanOrEqual(85);
    expect(result.interpretation).toBe("exit_review");
  });

  it("calculates manual-anchor price zones", () => {
    const zones = calculateDecisionPriceZones({
      holding: baseHolding,
      manualInputs: manual(),
      confidenceLabel: "medium",
      hasCriticalMissing: false,
    });

    expect(zones.strongAccumulation).toBeLessThan(zones.lightAccumulation ?? 0);
    expect(zones.lightAccumulation).toBe(95);
    expect(zones.trimReview).toBe(140);
    expect(zones.strongTrim).toBeGreaterThan(140);
  });

  it("keeps locked numeric zones while storing suggestions", () => {
    const holding = {
      ...baseHolding,
      zoneMode: "locked" as const,
    };
    const result = calculateDecisionEngine({
      holding,
      manualInputs: manual(holding),
      confidence: confidence(holding),
      recentActivity: summarizeRecentActivity({ holding, transactions: [] }),
      totalSpeculativeAllocation: 0,
      hasFundamentals: false,
      existingZones: {
        lightAccumulation: 80,
        trimReview: 160,
        currentZone: "hold",
      },
      recalculationReason: "test",
    });

    expect(result.effectivePriceZones.lightAccumulation).toBe(80);
    expect(result.effectivePriceZones.trimReview).toBe(160);
    expect(result.suggestedPriceZones?.lightAccumulation).toBe(95);
  });

  it("summarizes recent buy activity", () => {
    const transactions: Transaction[] = [
      {
        id: "t1",
        portfolioId: "p1",
        brokerAccountId: null,
        date: "2026-06-01T10:00:00.000Z",
        type: "buy",
        symbol: "ALAB.US",
        quantity: 1,
        price: 92,
        amount: -92,
        currency: "USD",
        source: "manual",
        comment: null,
      },
    ];
    const summary = summarizeRecentActivity({
      holding: baseHolding,
      transactions,
      zones: calculateDecisionPriceZones({
        holding: baseHolding,
        manualInputs: manual(),
        confidenceLabel: "medium",
        hasCriticalMissing: false,
      }),
      now: new Date("2026-06-05T00:00:00.000Z"),
    });

    expect(summary.buys30d).toBe(1);
    expect(summary.averageRecentBuyPrice).toBe(92);
    expect(summary.recentBuyInsideAccumulationZone).toBe(true);
  });
});
