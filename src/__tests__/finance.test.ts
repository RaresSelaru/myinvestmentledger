import { describe, expect, it } from "vitest";
import {
  calculateDrift,
  calculatePlPercent,
  computePortfolioSummary,
  enrichHoldings,
  rankCandidates,
} from "@/lib/finance";
import type { Holding, Transaction } from "@/lib/types";

const holdings: Holding[] = [
  {
    id: "a",
    portfolioId: "p",
    symbol: "AAPL",
    companyName: "Apple Inc.",
    quantity: 10,
    averageCost: 100,
    currentPrice: 130,
    currency: "USD",
    marketValue: 1300,
    costBasis: 1000,
    realizedPl: 0,
    unrealizedPl: 300,
    targetAllocation: 60,
    maxAllocation: 70,
    targetBuyPrice: 125,
    targetSellPrice: 150,
    corePercent: 80,
    satellitePercent: 20,
    updatedAt: "2026-06-04T00:00:00.000Z",
  },
  {
    id: "b",
    portfolioId: "p",
    symbol: "VUAA",
    companyName: "Vanguard S&P 500 UCITS ETF",
    quantity: 10,
    averageCost: 100,
    currentPrice: 70,
    currency: "USD",
    marketValue: 700,
    costBasis: 1000,
    realizedPl: 0,
    unrealizedPl: -300,
    targetAllocation: 40,
    maxAllocation: 50,
    targetBuyPrice: 75,
    targetSellPrice: null,
    corePercent: 100,
    satellitePercent: 0,
    updatedAt: "2026-06-04T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [
  {
    id: "t1",
    portfolioId: "p",
    brokerAccountId: "b",
    date: "2026-01-01",
    type: "deposit",
    symbol: null,
    quantity: null,
    price: null,
    amount: 3000,
    currency: "USD",
    source: "manual",
    comment: null,
  },
  {
    id: "t2",
    portfolioId: "p",
    brokerAccountId: "b",
    date: "2026-01-02",
    type: "internal_transfer",
    symbol: null,
    quantity: null,
    price: null,
    amount: 1000,
    currency: "USD",
    source: "manual",
    comment: null,
  },
  {
    id: "t3",
    portfolioId: "p",
    brokerAccountId: "b",
    date: "2026-01-03",
    type: "buy",
    symbol: "AAPL",
    quantity: 10,
    price: 100,
    amount: 1000,
    currency: "USD",
    source: "manual",
    comment: null,
  },
];

describe("finance calculations", () => {
  it("calculates drift as actual allocation minus target allocation", () => {
    expect(calculateDrift(63.2, 60)).toBe(3.2);
    expect(calculateDrift(38.2, 40)).toBe(-1.8);
  });

  it("calculates P/L percent from market value and cost basis", () => {
    expect(calculatePlPercent(1300, 1000)).toBe(30);
    expect(calculatePlPercent(700, 1000)).toBe(-30);
    expect(calculatePlPercent(700, 0)).toBe(0);
  });

  it("excludes internal transfers from new consolidated deposits", () => {
    const summary = computePortfolioSummary(holdings, transactions, "USD");

    expect(summary.cash).toBe(2000);
    expect(summary.totalValue).toBe(4000);
  });

  it("ranks accumulation candidates from negative drift and price factors", () => {
    const summary = computePortfolioSummary(holdings, transactions, "USD");
    const enriched = enrichHoldings(holdings, summary.totalValue);
    const candidates = rankCandidates(enriched, "accumulation");

    expect(candidates[0]?.symbol).toBe("VUAA");
    expect(candidates[0]?.drift).toBeLessThan(0);
  });
});
