import { calculateDrift, calculatePlPercent, round } from "@/lib/finance";
import type {
  CashOperation,
  CurrencyCode,
  Holding,
  HoldingView,
  PositionLot,
  Transaction,
} from "@/lib/types";

export type TargetConfig = {
  symbol: string;
  targetAllocationPct: number;
  maxAllocationPct: number | null;
  corePct: number;
  satellitePct: number;
  targetBuyPrice: number | null;
  targetSellPrice: number | null;
  riskLevel?: string | null;
  convictionLevel?: string | null;
  recommendationsDisabled?: boolean;
};

export type FxRateMap = Record<string, number>;

export type PortfolioState = {
  holdings: HoldingView[];
  totalSecurityValueBase: number;
  totalCashBase: number;
  totalPortfolioValue: number;
  totalInvestedBase: number;
  unrealizedPlBase: number;
  realizedPlBase: number;
  corePct: number;
  satellitePct: number;
  missingFx: Array<{ from: CurrencyCode; to: CurrencyCode }>;
};

export type InternalTransferMatch = {
  fromCashOperationId: string;
  toCashOperationId: string;
  fromBrokerAccountId: string;
  toBrokerAccountId: string;
  fromAmount: number;
  fromCurrency: CurrencyCode;
  toAmount: number;
  toCurrency: CurrencyCode;
  fxRate: number | null;
  occurredAt: string;
  confidence: number;
};

export type ManualReconciliationMatch = {
  manualTransactionId: string;
  importedTransactionId: string;
  score: number;
};

function fxKey(from: CurrencyCode, to: CurrencyCode) {
  return `${from.toUpperCase()}:${to.toUpperCase()}`;
}

export function convertCurrency(
  value: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: FxRateMap,
  missingFx: Array<{ from: CurrencyCode; to: CurrencyCode }>
) {
  if (from.toUpperCase() === to.toUpperCase()) {
    return value;
  }

  const direct = rates[fxKey(from, to)];

  if (direct) {
    return value * direct;
  }

  const inverse = rates[fxKey(to, from)];

  if (inverse) {
    return value / inverse;
  }

  if (!missingFx.some((entry) => entry.from === from && entry.to === to)) {
    missingFx.push({ from, to });
  }

  return value;
}

function targetFor(symbol: string, targets: TargetConfig[]) {
  return (
    targets.find((target) => target.symbol.toUpperCase() === symbol.toUpperCase()) ?? {
      symbol,
      targetAllocationPct: 0,
      maxAllocationPct: null,
      corePct: 100,
      satellitePct: 0,
      targetBuyPrice: null,
      targetSellPrice: null,
    }
  );
}

export function computePortfolioState({
  portfolioId,
  lots,
  cashOperations,
  targets,
  baseCurrency,
  rates = {},
  realizedPlBySymbol = {},
  snapshotAt = new Date().toISOString(),
}: {
  portfolioId: string;
  lots: PositionLot[];
  cashOperations: CashOperation[];
  targets: TargetConfig[];
  baseCurrency: CurrencyCode;
  rates?: FxRateMap;
  realizedPlBySymbol?: Record<string, number>;
  snapshotAt?: string;
}): PortfolioState {
  const missingFx: Array<{ from: CurrencyCode; to: CurrencyCode }> = [];
  const grouped = new Map<string, Holding>();

  for (const lot of lots) {
    const symbol = lot.symbol.toUpperCase();
    const target = targetFor(symbol, targets);
    const marketValue = lot.marketValue ?? lot.costBasis + (lot.unrealizedPl ?? 0);
    const marketValueBase = convertCurrency(
      marketValue,
      lot.currency,
      baseCurrency,
      rates,
      missingFx
    );
    const costBasisBase = convertCurrency(
      lot.costBasis,
      lot.currency,
      baseCurrency,
      rates,
      missingFx
    );
    const unrealizedBase = convertCurrency(
      lot.unrealizedPl ?? marketValue - lot.costBasis,
      lot.currency,
      baseCurrency,
      rates,
      missingFx
    );
    const existing =
      grouped.get(symbol) ??
      ({
        id: `holding:${portfolioId}:${symbol}`,
        portfolioId,
        symbol,
        companyName: null,
        quantity: 0,
        averageCost: 0,
        currentPrice: lot.currentPrice ?? lot.openPrice,
        currency: baseCurrency,
        marketValue: 0,
        costBasis: 0,
        realizedPl: realizedPlBySymbol[symbol] ?? 0,
        unrealizedPl: 0,
        targetAllocation: target.targetAllocationPct,
        maxAllocation: target.maxAllocationPct,
        targetBuyPrice: target.targetBuyPrice,
        targetSellPrice: target.targetSellPrice,
        corePercent: target.corePct,
        satellitePercent: target.satellitePct,
        updatedAt: snapshotAt,
        sourceReferences: [],
      } satisfies Holding);

    existing.quantity += lot.quantity;
    existing.marketValue += marketValueBase;
    existing.costBasis += costBasisBase;
    existing.unrealizedPl += unrealizedBase;
    existing.sourceReferences?.push(lot.sourceReference ?? {});
    existing.averageCost = existing.quantity
      ? existing.costBasis / existing.quantity
      : 0;
    existing.currentPrice = lot.currentPrice ?? existing.currentPrice;
    grouped.set(symbol, existing);
  }

  const rawHoldings = Array.from(grouped.values()).map((holding) => ({
    ...holding,
    quantity: round(holding.quantity, 6),
    averageCost: round(holding.averageCost, 4),
    marketValue: round(holding.marketValue, 2),
    costBasis: round(holding.costBasis, 2),
    unrealizedPl: round(holding.unrealizedPl, 2),
    realizedPl: round(holding.realizedPl, 2),
  }));
  const totalSecurityValueBase = round(
    rawHoldings.reduce((total, holding) => total + holding.marketValue, 0),
    2
  );
  const totalCashBase = round(
    cashOperations.reduce(
      (total, operation) =>
        total +
        convertCurrency(
          operation.amount,
          operation.currency,
          baseCurrency,
          rates,
          missingFx
        ),
      0
    ),
    2
  );
  const totalPortfolioValue = round(totalSecurityValueBase + totalCashBase, 2);
  const totalInvestedBase = round(
    rawHoldings.reduce((total, holding) => total + holding.costBasis, 0),
    2
  );
  const unrealizedPlBase = round(
    rawHoldings.reduce((total, holding) => total + holding.unrealizedPl, 0),
    2
  );
  const realizedPlBase = round(
    rawHoldings.reduce((total, holding) => total + holding.realizedPl, 0),
    2
  );
  const holdings = rawHoldings.map<HoldingView>((holding) => {
    const actualAllocation = totalPortfolioValue
      ? round((holding.marketValue / totalPortfolioValue) * 100, 2)
      : 0;
    const investedAllocation = totalSecurityValueBase
      ? round((holding.marketValue / totalSecurityValueBase) * 100, 2)
      : 0;

    return {
      ...holding,
      actualAllocation,
      investedAllocation,
      drift: calculateDrift(actualAllocation, holding.targetAllocation),
      plPercent: calculatePlPercent(holding.marketValue, holding.costBasis),
    };
  });
  const coreValue = holdings.reduce(
    (total, holding) => total + holding.marketValue * (holding.corePercent / 100),
    0
  );
  const satelliteValue = holdings.reduce(
    (total, holding) =>
      total + holding.marketValue * (holding.satellitePercent / 100),
    0
  );

  return {
    holdings,
    totalSecurityValueBase,
    totalCashBase,
    totalPortfolioValue,
    totalInvestedBase,
    unrealizedPlBase,
    realizedPlBase,
    corePct: totalSecurityValueBase ? round((coreValue / totalSecurityValueBase) * 100) : 0,
    satellitePct: totalSecurityValueBase
      ? round((satelliteValue / totalSecurityValueBase) * 100)
      : 0,
    missingFx,
  };
}

export function matchInternalTransfers(
  operations: CashOperation[],
  rates: FxRateMap,
  options: { dayTolerance?: number; amountTolerancePct?: number } = {}
): InternalTransferMatch[] {
  const dayTolerance = options.dayTolerance ?? 3;
  const amountTolerancePct = options.amountTolerancePct ?? 2;
  const transfers = operations
    .filter((operation) => operation.normalizedType === "internal_transfer")
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const matches: InternalTransferMatch[] = [];
  const used = new Set<string>();

  for (const from of transfers.filter((operation) => operation.amount < 0)) {
    if (used.has(from.id)) continue;

    for (const to of transfers.filter((operation) => operation.amount > 0)) {
      if (used.has(to.id) || from.brokerAccountId === to.brokerAccountId) continue;

      const dayDelta = Math.abs(
        (new Date(to.occurredAt).getTime() - new Date(from.occurredAt).getTime()) /
          86_400_000
      );

      if (dayDelta > dayTolerance) continue;

      const missingFx: Array<{ from: CurrencyCode; to: CurrencyCode }> = [];
      const converted = Math.abs(
        convertCurrency(from.amount, from.currency, to.currency, rates, missingFx)
      );
      const tolerance = Math.max(1, Math.abs(to.amount) * (amountTolerancePct / 100));

      if (Math.abs(converted - Math.abs(to.amount)) <= tolerance) {
        const fxRate =
          from.currency.toUpperCase() === to.currency.toUpperCase()
            ? 1
            : rates[fxKey(from.currency, to.currency)] ?? null;

        matches.push({
          fromCashOperationId: from.id,
          toCashOperationId: to.id,
          fromBrokerAccountId: from.brokerAccountId,
          toBrokerAccountId: to.brokerAccountId,
          fromAmount: Math.abs(from.amount),
          fromCurrency: from.currency,
          toAmount: Math.abs(to.amount),
          toCurrency: to.currency,
          fxRate,
          occurredAt: to.occurredAt,
          confidence: round(100 - dayDelta * 10 - (Math.abs(converted - Math.abs(to.amount)) / tolerance) * 10),
        });
        used.add(from.id);
        used.add(to.id);
        break;
      }
    }
  }

  return matches;
}

function transactionMatchScore(manual: Transaction, imported: Transaction) {
  if (manual.source !== "manual" || imported.source !== "xtb_import") return 0;
  if (manual.type !== imported.type) return 0;
  if ((manual.symbol ?? "") !== (imported.symbol ?? "")) return 0;
  if (manual.currency !== imported.currency) return 0;

  const dayDelta = Math.abs(
    (new Date(imported.date).getTime() - new Date(manual.date).getTime()) / 86_400_000
  );
  const amountDelta = Math.abs(Math.abs(imported.amount) - Math.abs(manual.amount));
  const amountTolerance = Math.max(1, Math.abs(manual.amount) * 0.02);
  const quantityDelta =
    manual.quantity !== null && imported.quantity !== null
      ? Math.abs(manual.quantity - imported.quantity)
      : 0;
  const priceDelta =
    manual.price !== null && imported.price !== null
      ? Math.abs(manual.price - imported.price)
      : 0;

  if (dayDelta > 3 || amountDelta > amountTolerance || quantityDelta > 0.0001) {
    return 0;
  }

  return Math.max(0, round(100 - dayDelta * 10 - (amountDelta / amountTolerance) * 20 - priceDelta));
}

export function reconcileManualTransactions(
  transactions: Transaction[]
): ManualReconciliationMatch[] {
  const manual = transactions.filter((transaction) => transaction.source === "manual");
  const imported = transactions.filter((transaction) => transaction.source === "xtb_import");
  const matches: ManualReconciliationMatch[] = [];
  const usedImported = new Set<string>();

  for (const manualTransaction of manual) {
    let best: ManualReconciliationMatch | null = null;

    for (const importedTransaction of imported) {
      if (usedImported.has(importedTransaction.id)) continue;

      const score = transactionMatchScore(manualTransaction, importedTransaction);

      if (score >= 70 && (!best || score > best.score)) {
        best = {
          manualTransactionId: manualTransaction.id,
          importedTransactionId: importedTransaction.id,
          score,
        };
      }
    }

    if (best) {
      matches.push(best);
      usedImported.add(best.importedTransactionId);
    }
  }

  return matches;
}
