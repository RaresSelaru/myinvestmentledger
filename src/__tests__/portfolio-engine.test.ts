import { describe, expect, it } from "vitest";
import {
  computePortfolioState,
  matchInternalTransfers,
  reconcileManualTransactions,
} from "@/lib/portfolio/engine";
import type { CashOperation, PositionLot, Transaction } from "@/lib/types";

const lots: PositionLot[] = [
  {
    id: "lot-1",
    portfolioId: "portfolio-1",
    brokerAccountId: "broker-usd",
    symbol: "AAPL",
    side: "buy",
    quantity: 2,
    openPrice: 100,
    currentPrice: 120,
    costBasis: 200,
    marketValue: 240,
    unrealizedPl: 40,
    currency: "USD",
    openedAt: "2026-01-01T00:00:00.000Z",
    sourceFingerprint: "lot-1",
  },
  {
    id: "lot-2",
    portfolioId: "portfolio-1",
    brokerAccountId: "broker-ron",
    symbol: "VUAA",
    side: "buy",
    quantity: 10,
    openPrice: 50,
    currentPrice: 55,
    costBasis: 500,
    marketValue: 550,
    unrealizedPl: 50,
    currency: "RON",
    openedAt: "2026-01-02T00:00:00.000Z",
    sourceFingerprint: "lot-2",
  },
];

const cashOperations: CashOperation[] = [
  {
    id: "cash-1",
    portfolioId: "portfolio-1",
    brokerAccountId: "broker-ron",
    operationType: "deposit",
    normalizedType: "deposit",
    amount: 1000,
    currency: "RON",
    occurredAt: "2026-01-01T00:00:00.000Z",
    description: null,
    symbol: null,
    sourceFingerprint: "cash-1",
  },
  {
    id: "cash-2",
    portfolioId: "portfolio-1",
    brokerAccountId: "broker-usd",
    operationType: "Stock purchase",
    normalizedType: "buy",
    amount: -240,
    currency: "USD",
    occurredAt: "2026-01-03T00:00:00.000Z",
    description: "OPEN BUY 2 @ 100",
    symbol: "AAPL",
    sourceFingerprint: "cash-2",
  },
];

describe("portfolio engine", () => {
  it("calculates base-currency value, weights, drift, and core/satellite", () => {
    const state = computePortfolioState({
      portfolioId: "portfolio-1",
      lots,
      cashOperations,
      targets: [
        {
          symbol: "AAPL",
          targetAllocationPct: 30,
          maxAllocationPct: 40,
          corePct: 70,
          satellitePct: 30,
          targetBuyPrice: 110,
          targetSellPrice: 140,
        },
        {
          symbol: "VUAA",
          targetAllocationPct: 45,
          maxAllocationPct: 60,
          corePct: 100,
          satellitePct: 0,
          targetBuyPrice: 52,
          targetSellPrice: null,
        },
      ],
      baseCurrency: "RON",
      rates: { "USD:RON": 5 },
    });

    expect(state.totalSecurityValueBase).toBe(1750);
    expect(state.totalCashBase).toBe(-200);
    expect(state.totalPortfolioValue).toBe(1550);
    expect(state.holdings.find((holding) => holding.symbol === "AAPL")?.actualAllocation).toBe(77.42);
    expect(state.holdings.find((holding) => holding.symbol === "AAPL")?.drift).toBe(47.42);
    expect(state.corePct).toBeGreaterThan(75);
  });

  it("matches internal transfers across broker accounts with FX tolerance", () => {
    const matches = matchInternalTransfers(
      [
        {
          ...cashOperations[0],
          id: "from",
          brokerAccountId: "broker-ron",
          normalizedType: "internal_transfer",
          amount: -500,
          currency: "RON",
        },
        {
          ...cashOperations[0],
          id: "to",
          brokerAccountId: "broker-usd",
          normalizedType: "internal_transfer",
          amount: 100,
          currency: "USD",
          occurredAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      { "RON:USD": 0.2 }
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].fromBrokerAccountId).toBe("broker-ron");
    expect(matches[0].toBrokerAccountId).toBe("broker-usd");
  });

  it("reconciles matching manual and imported transactions", () => {
    const transactions: Transaction[] = [
      {
        id: "manual",
        portfolioId: "portfolio-1",
        brokerAccountId: "broker-usd",
        date: "2026-01-02T00:00:00.000Z",
        type: "buy",
        symbol: "AAPL",
        quantity: 2,
        price: 100,
        amount: 200,
        currency: "USD",
        source: "manual",
        comment: null,
      },
      {
        id: "imported",
        portfolioId: "portfolio-1",
        brokerAccountId: "broker-usd",
        date: "2026-01-03T00:00:00.000Z",
        type: "buy",
        symbol: "AAPL",
        quantity: 2,
        price: 100,
        amount: -200,
        currency: "USD",
        source: "xtb_import",
        comment: null,
      },
    ];

    expect(reconcileManualTransactions(transactions)).toEqual([
      {
        manualTransactionId: "manual",
        importedTransactionId: "imported",
        score: 90,
      },
    ]);
  });
});
