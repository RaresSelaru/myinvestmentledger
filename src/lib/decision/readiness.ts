import { calculateDecisionConfidence } from "@/lib/decision/confidence";
import { calculateDecisionEngine } from "@/lib/decision/engine";
import { persistDecisionResults } from "@/lib/decision/persistence";
import { summarizeRecentActivity } from "@/lib/decision/recent-activity";
import {
  DECISION_CALCULATION_VERSION,
  type DecisionPriceZones,
  type ManualDecisionInputs,
} from "@/lib/decision/types";
import { providerSymbolCandidates } from "@/lib/market-data/symbols";
import { enrichHoldings } from "@/lib/finance";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BrokerCashOverride,
  CompanyType,
  CurrencyCode,
  DecisionRole,
  Holding,
  HoldingView,
  Transaction,
  ZoneMode,
} from "@/lib/types";

type SupabaseClient = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

type Row = Record<string, unknown>;

function numberFrom(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapHolding(row: Row): Holding {
  const symbol = String(row.symbol ?? "").toUpperCase();
  const rowCurrency = String(row.currency ?? "RON");
  const priceCurrency = symbol.endsWith(".US") ? "USD" : rowCurrency;

  return {
    id: String(row.id),
    portfolioId: String(row.portfolio_id),
    symbol,
    companyName: nullableString(row.company_name),
    quantity: numberFrom(row.quantity),
    averageCost: numberFrom(row.average_cost),
    currentPrice: numberFrom(row.current_price),
    currency: priceCurrency,
    marketValue: numberFrom(row.market_value),
    costBasis: numberFrom(row.cost_basis),
    realizedPl: numberFrom(row.realized_pl),
    unrealizedPl: numberFrom(row.unrealized_pl),
    targetAllocation: numberFrom(row.target_allocation),
    maxAllocation:
      row.max_allocation === null ? null : nullableNumber(row.max_allocation),
    targetBuyPrice: nullableNumber(row.target_buy_price),
    targetSellPrice: nullableNumber(row.target_sell_price),
    corePercent: numberFrom(row.core_percent, 100),
    satellitePercent: numberFrom(row.satellite_percent),
    updatedAt: String(row.updated_at ?? ""),
    sourceReferences: Array.isArray(row.source_refs)
      ? (row.source_refs as Holding["sourceReferences"])
      : [],
  };
}

function mapTransaction(row: Row): Transaction {
  return {
    id: String(row.id),
    portfolioId: String(row.portfolio_id),
    brokerAccountId: row.broker_account_id ? String(row.broker_account_id) : null,
    date: String(row.occurred_at ?? row.trade_date ?? row.date ?? ""),
    type: String(row.transaction_type ?? row.type ?? "note") as Transaction["type"],
    symbol: row.symbol ? String(row.symbol).toUpperCase() : null,
    quantity: row.quantity === null ? null : nullableNumber(row.quantity),
    price: row.price === null ? null : nullableNumber(row.price),
    amount: numberFrom(row.amount),
    currency: String(row.currency ?? "RON"),
    source: String(row.source_type ?? row.source ?? "manual") as Transaction["source"],
    comment: nullableString(row.comment),
    realizedPl:
      row.realized_pl === null || row.realized_pl === undefined
        ? null
        : numberFrom(row.realized_pl),
  };
}

function mapCashOverride(row: Row): BrokerCashOverride {
  return {
    brokerAccountId: String(row.broker_account_id),
    amount: numberFrom(row.amount),
    currency: String(row.currency ?? "RON"),
    comment: nullableString(row.comment),
  };
}

function payloadObject(row: Row) {
  return typeof row.payload === "object" && row.payload !== null
    ? (row.payload as Row)
    : {};
}

function newestRow(rows: Row[]) {
  return rows
    .filter((row) => row.fetched_at || row.as_of)
    .sort((a, b) =>
      String(b.fetched_at ?? b.as_of).localeCompare(String(a.fetched_at ?? a.as_of))
    )[0];
}

function marketRowsBySymbol(rows: Row[], dataType: string) {
  const groups = new Map<string, Row[]>();

  for (const row of rows) {
    if (String(row.data_type ?? "quote") !== dataType) continue;
    const symbol = String(row.symbol ?? "").toUpperCase();
    if (!symbol) continue;
    groups.set(symbol, [...(groups.get(symbol) ?? []), row]);
  }

  return groups;
}

function pickMarketRow(groups: Map<string, Row[]>, symbol: string) {
  for (const candidate of providerSymbolCandidates(symbol)) {
    const row = newestRow(groups.get(candidate.toUpperCase()) ?? []);
    if (row) return row;
  }

  return null;
}

function applyDecisionLiveValuation({
  holdings,
  marketRows,
  baseCurrency,
  enabled,
}: {
  holdings: Holding[];
  marketRows: Row[];
  baseCurrency: CurrencyCode;
  enabled: boolean;
}) {
  if (!enabled) return holdings;

  const quoteRows = marketRowsBySymbol(marketRows, "quote");
  const fxRows = marketRowsBySymbol(marketRows, "fx");

  return holdings.map((holding) => {
    const quoteRow = pickMarketRow(quoteRows, holding.symbol);
    if (!quoteRow) return holding;

    const payload = payloadObject(quoteRow);
    const quotePrice = numberFrom(payload.price ?? quoteRow.price, NaN);
    const quoteCurrency = String(payload.currency ?? quoteRow.currency ?? holding.currency).toUpperCase();

    if (!Number.isFinite(quotePrice) || quotePrice <= 0) {
      return holding;
    }

    let convertedPrice = quotePrice;

    if (quoteCurrency !== baseCurrency.toUpperCase()) {
      const fxRow = pickMarketRow(fxRows, `${quoteCurrency}:${baseCurrency}`);
      const fxPayload = fxRow ? payloadObject(fxRow) : {};
      const fxRate = numberFrom(fxPayload.rate, NaN);

      if (!Number.isFinite(fxRate) || fxRate <= 0) {
        return {
          ...holding,
          currentPrice: quotePrice,
          currency: quoteCurrency,
          updatedAt: String(quoteRow.fetched_at ?? quoteRow.as_of ?? holding.updatedAt),
        };
      }

      convertedPrice = quotePrice * fxRate;
    }

    const marketValue = Number((holding.quantity * convertedPrice).toFixed(2));

    return {
      ...holding,
      currentPrice: quotePrice,
      currency: quoteCurrency,
      marketValue,
      unrealizedPl: Number((marketValue - holding.costBasis).toFixed(2)),
      updatedAt: String(quoteRow.fetched_at ?? quoteRow.as_of ?? holding.updatedAt),
    };
  });
}

function latestSnapshotCash(rows: Row[], overrides: BrokerCashOverride[] = []) {
  const latestByBroker = new Map<string, Row>();
  const overrideByBroker = new Map(
    overrides.map((override) => [override.brokerAccountId, override])
  );

  for (const row of rows) {
    const brokerAccountId = String(row.broker_account_id ?? "");
    if (brokerAccountId && !latestByBroker.has(brokerAccountId)) {
      latestByBroker.set(brokerAccountId, row);
    }
  }

  const snapshotTotal = Array.from(latestByBroker.values()).reduce((total, row) => {
    const brokerAccountId = String(row.broker_account_id ?? "");

    if (overrideByBroker.has(brokerAccountId)) return total;

    return total + numberFrom(row.free_margin ?? row.balance);
  }, 0);
  const overrideTotal = Array.from(overrideByBroker.values()).reduce(
    (total, override) => total + override.amount,
    0
  );

  return snapshotTotal + overrideTotal;
}

function mergeTargetIntoHolding(holding: Holding, target: Row | undefined): Holding {
  if (!target) return holding;

  return {
    ...holding,
    targetAllocation: numberFrom(
      target.target_allocation_pct ?? target.target_allocation,
      holding.targetAllocation
    ),
    maxAllocation: nullableNumber(
      target.max_allocation_pct ?? target.max_allocation
    ),
    targetBuyPrice: nullableNumber(target.target_buy_price),
    targetSellPrice: nullableNumber(target.target_sell_price),
    corePercent: numberFrom(target.core_pct ?? target.core_percent, holding.corePercent),
    satellitePercent: numberFrom(
      target.satellite_pct ?? target.satellite_percent,
      holding.satellitePercent
    ),
    role: nullableString(target.role) as DecisionRole | null,
    companyType: nullableString(target.company_type) as CompanyType | null,
    theme: nullableString(target.theme),
    zoneMode:
      (nullableString(target.zone_mode) as ZoneMode | null) ??
      holding.zoneMode ??
      "suggested",
    manualFairValue: nullableNumber(target.manual_fair_value),
    manualBuyAnchor:
      nullableNumber(target.manual_buy_anchor) ??
      nullableNumber(target.target_buy_price),
    manualTrimAnchor:
      nullableNumber(target.manual_trim_anchor) ??
      nullableNumber(target.target_sell_price),
    thesisIntegrityScore: nullableNumber(target.thesis_integrity_score),
    catalystQualityScore: nullableNumber(target.catalyst_quality_score),
    themeStrengthScore: nullableNumber(target.theme_strength_score),
    valueChainCriticalityScore: nullableNumber(
      target.value_chain_criticality_score
    ),
    macroUncertaintyScore: nullableNumber(target.macro_uncertainty_score),
    qualitativeComment: nullableString(target.qualitative_comment),
  };
}

function manualInputsFromHolding(holding: HoldingView): ManualDecisionInputs {
  const roleFromSplit: DecisionRole =
    holding.companyType === "speculative_prerevenue" &&
    holding.satellitePercent >= 70
      ? "speculative"
      : holding.corePercent >= 60
        ? "core"
        : "satellite";

  return {
    role: holding.role ?? roleFromSplit,
    companyType: holding.companyType ?? null,
    theme: holding.theme ?? null,
    zoneMode: holding.zoneMode ?? "suggested",
    manualFairValue: holding.manualFairValue ?? null,
    manualBuyAnchor: holding.manualBuyAnchor ?? holding.targetBuyPrice,
    manualTrimAnchor: holding.manualTrimAnchor ?? holding.targetSellPrice,
    thesisIntegrityScore: holding.thesisIntegrityScore ?? null,
    catalystQualityScore: holding.catalystQualityScore ?? null,
    themeStrengthScore: holding.themeStrengthScore ?? null,
    valueChainCriticalityScore: holding.valueChainCriticalityScore ?? null,
    macroUncertaintyScore: holding.macroUncertaintyScore ?? null,
    qualitativeComment: holding.qualitativeComment ?? null,
  };
}

function hasSymbolRow(rows: Row[], symbol: string) {
  const candidates = providerSymbolCandidates(symbol);

  return rows.some((row) => {
    const rowSymbol = String(
      row.symbol ?? row.internal_symbol ?? row.provider_symbol ?? ""
    ).toUpperCase();

    return candidates.includes(rowSymbol);
  });
}

function existingZonesFromRow(row: Row | undefined): Partial<DecisionPriceZones> | null {
  if (!row) return null;
  const rawOutputs =
    typeof row.raw_outputs_json === "object" && row.raw_outputs_json !== null
      ? (row.raw_outputs_json as Row)
      : {};

  return {
    strongAccumulation: nullableNumber(row.strong_accumulation),
    lightAccumulation: nullableNumber(row.light_accumulation),
    holdLow: nullableNumber(row.hold_low),
    holdHigh: nullableNumber(row.hold_high),
    trimReview: nullableNumber(row.trim_review),
    strongTrim: nullableNumber(row.strong_trim),
    exitReview: nullableNumber(rawOutputs.exitReview),
    currentZone:
      typeof rawOutputs.currentZone === "string"
        ? (rawOutputs.currentZone as DecisionPriceZones["currentZone"])
        : undefined,
  };
}

function latestRowsBySymbol(rows: Row[]) {
  const bySymbol = new Map<string, Row>();

  for (const row of rows) {
    const symbol = String(row.symbol ?? "").toUpperCase();
    if (symbol && !bySymbol.has(symbol)) {
      bySymbol.set(symbol, row);
    }
  }

  return bySymbol;
}

export async function recalculateDecisionEngineForPortfolio({
  supabase,
  userId,
  portfolioId,
  baseCurrency,
  symbols,
  reason = "portfolio_recalculate",
}: {
  supabase: SupabaseClient;
  userId: string;
  portfolioId: string;
  baseCurrency: CurrencyCode;
  symbols?: string[];
  reason?: string;
}) {
  const symbolFilter = new Set(symbols?.map((symbol) => symbol.toUpperCase()) ?? []);
  const [
    { data: holdingRows },
    { data: targetRows },
    { data: transactionRows },
    { data: snapshotRows },
    { data: cashOverrideRows },
    { data: marketRows },
    { data: settingRows },
    { data: mappingRows },
    { data: profileRows },
    { data: priceRows },
    { data: metricsRows },
    { data: ratioRows },
    { data: statementRows },
    { data: scoreRows },
    { data: zoneRows },
  ] = await Promise.all([
    supabase
      .from("holdings")
      .select("*")
      .eq("user_id", userId)
      .eq("portfolio_id", portfolioId),
    supabase
      .from("targets")
      .select("*")
      .eq("user_id", userId)
      .eq("portfolio_id", portfolioId),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("portfolio_id", portfolioId)
      .order("occurred_at", { ascending: false })
      .limit(1000),
    supabase
      .from("broker_account_snapshots")
      .select("*")
      .eq("user_id", userId)
      .eq("portfolio_id", portfolioId)
      .order("snapshot_at", { ascending: false }),
    supabase
      .from("broker_cash_overrides")
      .select("*")
      .eq("user_id", userId)
      .eq("portfolio_id", portfolioId),
    supabase
      .from("market_data_cache")
      .select("*")
      .eq("user_id", userId),
    supabase
      .from("market_data_settings")
      .select("live_prices_enabled, valuation_mode")
      .eq("user_id", userId)
      .eq("portfolio_id", portfolioId)
      .limit(1),
    supabase
      .from("symbol_mappings")
      .select("internal_symbol, provider_symbol, provider, verified")
      .eq("user_id", userId),
    supabase
      .from("company_profiles")
      .select("provider_symbol, expires_at")
      .eq("user_id", userId),
    supabase
      .from("price_history")
      .select("provider_symbol")
      .eq("user_id", userId)
      .limit(10000),
    supabase
      .from("financial_metrics")
      .select("provider_symbol")
      .eq("user_id", userId)
      .limit(10000),
    supabase
      .from("financial_ratios")
      .select("provider_symbol")
      .eq("user_id", userId)
      .limit(10000),
    supabase
      .from("financial_statements")
      .select("provider_symbol")
      .eq("user_id", userId)
      .limit(10000),
    supabase
      .from("decision_scores")
      .select("*")
      .eq("user_id", userId)
      .eq("portfolio_id", portfolioId)
      .order("calculated_at", { ascending: false })
      .limit(1000),
    supabase
      .from("price_zones")
      .select("*")
      .eq("user_id", userId)
      .eq("portfolio_id", portfolioId),
  ]);
  const targetBySymbol = new Map(
    (targetRows ?? []).map((row) => [
      String((row as Row).symbol ?? "").toUpperCase(),
      row as Row,
    ])
  );
  const settings = (settingRows?.[0] as Row | undefined) ?? {};
  const liveValuationEnabled =
    Boolean(settings.live_prices_enabled) &&
    String(settings.valuation_mode) === "live_prices";
  const mergedHoldings = (holdingRows ?? []).map((row) =>
    mergeTargetIntoHolding(
      mapHolding(row as Row),
      targetBySymbol.get(String((row as Row).symbol ?? "").toUpperCase())
    )
  );
  const liveHoldings = applyDecisionLiveValuation({
    holdings: mergedHoldings,
    marketRows: (marketRows ?? []) as Row[],
    baseCurrency,
    enabled: liveValuationEnabled,
  });
  const rawHoldings = liveHoldings
    .filter((holding) =>
      symbolFilter.size ? symbolFilter.has(holding.symbol.toUpperCase()) : true
    );
  const allRawHoldings = liveHoldings;
  const cashOverrides = (cashOverrideRows ?? []).map((row) =>
    mapCashOverride(row as Row)
  );
  const cash = latestSnapshotCash((snapshotRows ?? []) as Row[], cashOverrides);
  const totalSecurityValue = allRawHoldings.reduce(
    (total, holding) => total + holding.marketValue,
    0
  );
  const holdings = enrichHoldings(rawHoldings, totalSecurityValue + cash);
  const allHoldings = enrichHoldings(allRawHoldings, totalSecurityValue + cash);
  const transactions = (transactionRows ?? []).map((row) =>
    mapTransaction(row as Row)
  );
  const marketDataRows = (marketRows ?? []) as Row[];
  const zoneBySymbol = latestRowsBySymbol((zoneRows ?? []) as Row[]);
  const totalSpeculativeAllocation = allHoldings
    .reduce((total, holding) => {
      const satelliteExposure =
        holding.actualAllocation * (holding.satellitePercent / 100);
      const speculativeMultiplier =
        holding.companyType === "speculative_prerevenue" ? 1.25 : 1;

      return total + satelliteExposure * speculativeMultiplier;
    }, 0);
  const results = holdings.map((holding) => {
    const manualInputs = manualInputsFromHolding(holding);
    const quoteRows = marketDataRows.filter(
      (row) =>
        String(row.data_type ?? "quote") === "quote" &&
        providerSymbolCandidates(holding.symbol).includes(
          String(row.symbol ?? "").toUpperCase()
        )
    );
    const staleData = quoteRows
      .filter((row) => {
        const expiresAt = new Date(String(row.expires_at ?? 0)).getTime();
        return Number.isFinite(expiresAt) && expiresAt <= Date.now();
      })
      .map(() => "quote");
    const hasFundamentals =
      hasSymbolRow((metricsRows ?? []) as Row[], holding.symbol) ||
      hasSymbolRow((ratioRows ?? []) as Row[], holding.symbol) ||
      hasSymbolRow((statementRows ?? []) as Row[], holding.symbol);
    const confidence = calculateDecisionConfidence({
      holding,
      portfolioBaseCurrency: baseCurrency,
      manualInputs,
      hasQuote: quoteRows.length > 0,
      hasPriceHistory: hasSymbolRow((priceRows ?? []) as Row[], holding.symbol),
      hasCompanyProfile:
        hasSymbolRow((profileRows ?? []) as Row[], holding.symbol) ||
        marketDataRows.some(
          (row) =>
            String(row.data_type) === "profile" &&
            providerSymbolCandidates(holding.symbol).includes(
              String(row.symbol ?? "").toUpperCase()
            )
        ),
      hasFundamentals,
      hasSymbolMapping: hasSymbolRow((mappingRows ?? []) as Row[], holding.symbol),
      staleData,
    });
    const existingZones = existingZonesFromRow(
      zoneBySymbol.get(holding.symbol.toUpperCase())
    );
    const recentActivity = summarizeRecentActivity({
      holding,
      transactions,
      zones: existingZones ? ({ ...existingZones, zoneMode: manualInputs.zoneMode } as DecisionPriceZones) : null,
    });

    return calculateDecisionEngine({
      holding,
      manualInputs,
      confidence,
      recentActivity,
      totalSpeculativeAllocation,
      hasFundamentals,
      existingZones,
      recalculationReason: reason,
    });
  });

  const persisted = await persistDecisionResults({
    supabase,
    userId,
    portfolioId,
    results,
    previousScoreRows: (scoreRows ?? []) as Row[],
    existingZoneRows: (zoneRows ?? []) as Row[],
  });

  return {
    symbols: results.length,
    ...persisted,
  };
}

export async function recalculateDecisionEngineForSymbol({
  symbol,
  ...input
}: Parameters<typeof recalculateDecisionEngineForPortfolio>[0] & { symbol: string }) {
  return recalculateDecisionEngineForPortfolio({
    ...input,
    symbols: [symbol],
  });
}

export async function refreshDecisionReadinessForPortfolio(
  input: Parameters<typeof recalculateDecisionEngineForPortfolio>[0]
) {
  return recalculateDecisionEngineForPortfolio({
    ...input,
    reason: input.reason ?? "readiness_recalculated",
  });
}

export { DECISION_CALCULATION_VERSION };
