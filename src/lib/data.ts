import { cookies } from "next/headers";
import { cache } from "react";
import { computePortfolioSummary, enrichHoldings, rankCandidates, round } from "@/lib/finance";
import { providerSymbolCandidates } from "@/lib/market-data/symbols";
import { getPreviewWorkspaceData } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AccountOverview,
  BrokerCashOverride,
  BrokerAccount,
  Holding,
  MarketDataApiKeyStatus,
  MarketDataProviderName,
  MarketDataSettings,
  Portfolio,
  SettingsData,
  StrategyData,
  Transaction,
  WorkspaceData,
  WorkspaceShellData,
} from "@/lib/types";

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

const ACTIVE_PORTFOLIO_COOKIE = "mil_active_portfolio_id";

const DEFAULT_MARKET_SETTINGS: MarketDataSettings = {
  livePricesEnabled: false,
  valuationMode: "import_snapshot",
  preferredProvider: "auto",
  quoteRefreshIntervalSeconds: 120,
};

async function createDefaultWorkspace(
  supabase: SupabaseClient,
  user: { id: string; email?: string }
) {
  await supabase.from("profiles").upsert({
    user_id: user.id,
    email: user.email ?? null,
    default_currency: "RON",
    updated_at: new Date().toISOString(),
  });

  const { data: portfolio } = await supabase
    .from("portfolios")
    .insert({
      user_id: user.id,
      name: "Main Portfolio",
      base_currency: "RON",
      tags: ["core"],
    })
    .select("id")
    .single();

  if (!portfolio?.id) {
    return null;
  }

  await supabase.from("portfolio_memberships").insert({
    user_id: user.id,
    portfolio_id: portfolio.id,
    role: "owner",
  });

  await supabase.from("broker_accounts").insert({
    user_id: user.id,
    portfolio_id: portfolio.id,
    name: "XTB RON account",
    broker: "XTB",
    base_currency: "RON",
  });

  return portfolio.id as string;
}

function mapPortfolio(row: Record<string, unknown>): Portfolio {
  return {
    id: String(row.id),
    name: String(row.name ?? "Main Portfolio"),
    baseCurrency: String(row.base_currency ?? "RON"),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  };
}

function mapBrokerAccount(row: Record<string, unknown>): BrokerAccount {
  return {
    id: String(row.id),
    portfolioId: String(row.portfolio_id),
    name: String(row.name ?? "Broker account"),
    broker: String(row.broker ?? "Manual"),
    baseCurrency: String(row.base_currency ?? "RON"),
  };
}

function numberFrom(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function latestSnapshotCash(
  rows: Record<string, unknown>[],
  overrides: BrokerCashOverride[] = []
) {
  const latestByBroker = new Map<string, Record<string, unknown>>();
  const overrideByBroker = new Map(
    overrides.map((override) => [override.brokerAccountId, override])
  );

  for (const row of rows) {
    const brokerAccountId = String(row.broker_account_id ?? "");
    if (brokerAccountId && !latestByBroker.has(brokerAccountId)) {
      latestByBroker.set(brokerAccountId, row);
    }
  }

  if (!latestByBroker.size && !overrideByBroker.size) {
    return null;
  }

  const snapshotTotal = Array.from(latestByBroker.values()).reduce((total, row) => {
    const brokerAccountId = String(row.broker_account_id ?? "");

    if (overrideByBroker.has(brokerAccountId)) {
      return total;
    }

    const cashValue = row.free_margin ?? row.balance;
    return total + numberFrom(cashValue);
  }, 0);
  const overrideTotal = Array.from(overrideByBroker.values()).reduce(
    (total, override) => total + override.amount,
    0
  );

  return snapshotTotal + overrideTotal;
}

function mapHolding(row: Record<string, unknown>): Holding {
  const symbol = String(row.symbol ?? "");
  const rowCurrency = String(row.currency ?? "RON");
  const priceCurrency = symbol.toUpperCase().endsWith(".US")
    ? "USD"
    : rowCurrency;

  return {
    id: String(row.id),
    portfolioId: String(row.portfolio_id),
    symbol,
    companyName: row.company_name ? String(row.company_name) : null,
    quantity: numberFrom(row.quantity),
    averageCost: numberFrom(row.average_cost),
    currentPrice: numberFrom(row.current_price),
    currency: priceCurrency,
    marketValue: numberFrom(row.market_value),
    costBasis: numberFrom(row.cost_basis),
    realizedPl: numberFrom(row.realized_pl),
    unrealizedPl: numberFrom(row.unrealized_pl),
    targetAllocation: numberFrom(row.target_allocation),
    maxAllocation: row.max_allocation === null ? null : numberFrom(row.max_allocation),
    targetBuyPrice: row.target_buy_price === null ? null : numberFrom(row.target_buy_price),
    targetSellPrice:
      row.target_sell_price === null ? null : numberFrom(row.target_sell_price),
    corePercent: numberFrom(row.core_percent, 100),
    satellitePercent: numberFrom(row.satellite_percent),
    updatedAt: String(row.updated_at ?? ""),
    sourceReferences: Array.isArray(row.source_refs)
      ? (row.source_refs as Holding["sourceReferences"])
      : [],
  };
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    portfolioId: String(row.portfolio_id),
    brokerAccountId: row.broker_account_id ? String(row.broker_account_id) : null,
    date: String(row.occurred_at ?? row.trade_date ?? row.date ?? ""),
    type: String(row.transaction_type ?? row.type ?? "note") as Transaction["type"],
    symbol: row.symbol ? String(row.symbol) : null,
    quantity: row.quantity === null ? null : numberFrom(row.quantity),
    price: row.price === null ? null : numberFrom(row.price),
    amount: numberFrom(row.amount),
    currency: String(row.currency ?? "RON"),
    source: String(row.source_type ?? row.source ?? "manual") as Transaction["source"],
    sourceLabel:
      String(row.source_type ?? row.source ?? "manual") === "xtb_import"
        ? "XTB import"
        : "Manual",
    comment: row.comment ? String(row.comment) : null,
    isReconciled: Boolean(row.is_reconciled),
    reconciledWithTransactionId: row.reconciled_with_transaction_id
      ? String(row.reconciled_with_transaction_id)
      : null,
    sourceFingerprint: row.source_fingerprint
      ? String(row.source_fingerprint)
      : null,
    realizedPl:
      row.realized_pl === null || row.realized_pl === undefined
        ? null
        : numberFrom(row.realized_pl),
  };
}

function mapMarketDataSettings(row?: Record<string, unknown> | null): MarketDataSettings {
  if (!row) {
    return DEFAULT_MARKET_SETTINGS;
  }

  return {
    livePricesEnabled: Boolean(row.live_prices_enabled),
    valuationMode:
      String(row.valuation_mode) === "live_prices"
        ? "live_prices"
        : "import_snapshot",
    preferredProvider: [
      "auto",
      "finnhub",
      "fmp",
      "alpha_vantage",
      "twelve_data",
    ].includes(String(row.preferred_provider))
      ? (String(row.preferred_provider) as MarketDataSettings["preferredProvider"])
      : "auto",
    quoteRefreshIntervalSeconds:
      numberFrom(row.quote_refresh_interval_seconds, 120) >= 60
        ? Math.min(numberFrom(row.quote_refresh_interval_seconds, 120), 3600)
        : 120,
  };
}

function mapApiKey(row: Record<string, unknown>): MarketDataApiKeyStatus {
  return {
    provider: String(row.provider) as MarketDataProviderName,
    enabled: Boolean(row.enabled),
    keyLast4: row.key_last4 ? String(row.key_last4) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function mapCashOverride(row: Record<string, unknown>): BrokerCashOverride {
  return {
    brokerAccountId: String(row.broker_account_id),
    amount: numberFrom(row.amount),
    currency: String(row.currency ?? "RON"),
    comment: row.comment ? String(row.comment) : null,
  };
}

function isVisibleActivity(transaction: Transaction) {
  if (transaction.source !== "xtb_import") {
    return true;
  }

  const comment = transaction.comment ?? "";

  if (comment === "Broker-reported open position") {
    return false;
  }

  if (/^Profit of position/i.test(comment)) {
    return false;
  }

  if (/^CLOSE (BUY|SELL)/i.test(comment)) {
    return false;
  }

  return true;
}

function newestRow(rows: Record<string, unknown>[]) {
  return rows
    .filter((row) => row.fetched_at || row.as_of)
    .sort((a, b) =>
      String(b.fetched_at ?? b.as_of).localeCompare(String(a.fetched_at ?? a.as_of))
    )[0];
}

function payloadObject(row: Record<string, unknown>) {
  return typeof row.payload === "object" && row.payload !== null
    ? (row.payload as Record<string, unknown>)
    : {};
}

type MarketRowMatch = {
  row: Record<string, unknown>;
  isStale: boolean;
};

function updateMarketRowGroup(
  groups: Map<string, { latest?: Record<string, unknown>; fresh?: Record<string, unknown> }>,
  key: string,
  row: Record<string, unknown>,
  isFresh: boolean
) {
  const current = groups.get(key) ?? {};
  const latest = newestRow(
    [row, current.latest].filter(Boolean) as Record<string, unknown>[]
  );
  const fresh = isFresh
    ? newestRow([row, current.fresh].filter(Boolean) as Record<string, unknown>[])
    : current.fresh;

  groups.set(key, { latest, fresh });
}

function pickMarketRow(
  groups: Map<string, { latest?: Record<string, unknown>; fresh?: Record<string, unknown> }>,
  keys: string[]
): MarketRowMatch | null {
  for (const key of keys) {
    const group = groups.get(key.toUpperCase());

    if (group?.fresh) {
      return { row: group.fresh, isStale: false };
    }
  }

  for (const key of keys) {
    const group = groups.get(key.toUpperCase());

    if (group?.latest) {
      return { row: group.latest, isStale: true };
    }
  }

  return null;
}

function applyLiveValuation(input: {
  holdings: Holding[];
  marketRows: Record<string, unknown>[];
  baseCurrency: string;
  settings: MarketDataSettings;
}) {
  if (
    !input.settings.livePricesEnabled ||
    input.settings.valuationMode !== "live_prices" ||
    !input.marketRows.length
  ) {
    return {
      holdings: input.holdings,
      source: "XTB snapshot",
      status: "snapshot" as const,
    };
  }

  const now = Date.now();
  const quoteRows = new Map<
    string,
    { latest?: Record<string, unknown>; fresh?: Record<string, unknown> }
  >();
  const fxRows = new Map<
    string,
    { latest?: Record<string, unknown>; fresh?: Record<string, unknown> }
  >();

  for (const row of input.marketRows) {
    const expiresAt = new Date(String(row.expires_at ?? 0)).getTime();
    const isFresh = Number.isFinite(expiresAt) && expiresAt > now;
    const dataType = String(row.data_type ?? "quote");
    const symbol = String(row.symbol ?? "").toUpperCase();

    if (dataType === "quote") {
      updateMarketRowGroup(quoteRows, symbol, row, isFresh);
    } else if (dataType === "fx") {
      updateMarketRowGroup(fxRows, symbol, row, isFresh);
    }
  }

  let liveCount = 0;
  let freshCount = 0;
  let staleCount = 0;
  const holdings = input.holdings.map((holding) => {
    const quoteMatch = pickMarketRow(
      quoteRows,
      providerSymbolCandidates(holding.symbol)
    );

    if (!quoteMatch) {
      return holding;
    }

    const quoteRow = quoteMatch.row;
    const payload = payloadObject(quoteRow);
    const quotePrice = numberFrom(payload.price ?? quoteRow.price, NaN);
    const quoteCurrency = String(payload.currency ?? quoteRow.currency ?? "USD");

    if (!Number.isFinite(quotePrice) || quotePrice <= 0) {
      return holding;
    }

    let convertedPrice = quotePrice;

    if (quoteCurrency.toUpperCase() !== input.baseCurrency.toUpperCase()) {
      const fxMatch = pickMarketRow(fxRows, [
        `${quoteCurrency}:${input.baseCurrency}`,
      ]);

      if (!fxMatch) {
        return holding;
      }

      const fxPayload = payloadObject(
        fxMatch.row
      );
      const fxRate = numberFrom(fxPayload.rate, NaN);

      if (!Number.isFinite(fxRate) || fxRate <= 0) {
        return holding;
      }

      convertedPrice = quotePrice * fxRate;
      if (fxMatch.isStale) {
        staleCount += 1;
      }
    }

    liveCount += 1;
    if (quoteMatch.isStale) {
      staleCount += 1;
    } else {
      freshCount += 1;
    }
    const marketValue = round(holding.quantity * convertedPrice, 2);

    return {
      ...holding,
      currentPrice: round(quotePrice, 4),
      currency: quoteCurrency.toUpperCase(),
      marketValue,
      unrealizedPl: round(marketValue - holding.costBasis, 2),
      updatedAt: String(quoteRow.fetched_at ?? quoteRow.as_of ?? holding.updatedAt),
      sourceReferences: [
        ...(holding.sourceReferences ?? []),
        {
          provider: String(quoteRow.provider ?? "market data"),
          fetchedAt: String(quoteRow.fetched_at ?? quoteRow.as_of ?? ""),
        },
      ],
    };
  });

  return {
    holdings,
    source: liveCount
      ? staleCount
        ? "Cached live quotes"
        : "Live quotes"
      : "XTB snapshot",
    status:
      liveCount === input.holdings.length && staleCount === 0
        ? ("live" as const)
        : liveCount > 0 && freshCount === 0
          ? ("stale" as const)
          : liveCount > 0
          ? ("partial" as const)
          : ("snapshot" as const),
  };
}

function buildAccountOverview(input: {
  holdings: Holding[];
  cash: number;
  currency: string;
}): AccountOverview {
  const bySymbol = new Map<
    string,
    {
      symbol: string;
      name: string;
      marketValue: number;
      costBasis: number;
      unrealizedPl: number;
      updatedAt: string;
    }
  >();

  for (const holding of input.holdings) {
    const symbol = holding.symbol.toUpperCase();
    const current = bySymbol.get(symbol) ?? {
      symbol,
      name: holding.companyName ?? symbol,
      marketValue: 0,
      costBasis: 0,
      unrealizedPl: 0,
      updatedAt: holding.updatedAt,
    };

    current.name = current.name === symbol && holding.companyName
      ? holding.companyName
      : current.name;
    current.marketValue += holding.marketValue;
    current.costBasis += holding.costBasis;
    current.unrealizedPl += holding.unrealizedPl;
    current.updatedAt =
      String(holding.updatedAt).localeCompare(current.updatedAt) > 0
        ? holding.updatedAt
        : current.updatedAt;
    bySymbol.set(symbol, current);
  }

  const holdingsValue = Array.from(bySymbol.values()).reduce(
    (total, item) => total + item.marketValue,
    0
  );
  const totalValue = round(holdingsValue + input.cash, 2);
  const holdingItems = Array.from(bySymbol.values())
    .map((item) => ({
      kind: "holding" as const,
      symbol: item.symbol,
      name: item.name,
      marketValue: round(item.marketValue, 2),
      allocation: totalValue ? round((item.marketValue / totalValue) * 100, 2) : 0,
      unrealizedPl: round(item.unrealizedPl, 2),
      plPercent: item.costBasis
        ? round((item.unrealizedPl / item.costBasis) * 100, 2)
        : 0,
      currency: input.currency,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);

  const cashItem = {
    kind: "cash" as const,
    symbol: "CASH",
    name: "Free cash",
    marketValue: round(input.cash, 2),
    allocation: totalValue ? round((input.cash / totalValue) * 100, 2) : 0,
    unrealizedPl: null,
    plPercent: null,
    currency: input.currency,
  };
  const updatedAt =
    Array.from(bySymbol.values())
      .map((item) => item.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? "Not available";

  return {
    totalValue,
    totalCash: round(input.cash, 2),
    currency: input.currency,
    updatedAt,
    items: [...holdingItems, cashItem].sort((a, b) => b.marketValue - a.marketValue),
  };
}

function previewShell(): WorkspaceShellData {
  const preview = getPreviewWorkspaceData();

  return {
    isPreview: preview.isPreview,
    isLocked: preview.isLocked,
    userEmail: preview.userEmail,
    portfolios: preview.portfolios,
    activePortfolio: preview.activePortfolio,
    brokerAccounts: preview.brokerAccounts,
  };
}

const getWorkspaceBase = cache(async (): Promise<{
  supabase: SupabaseClient | null;
  userId: string | null;
  userEmail: string;
  isPreview: boolean;
  isLocked: boolean;
  portfolios: Portfolio[];
  activePortfolio: Portfolio;
  brokerAccounts: BrokerAccount[];
}> => {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const preview = getPreviewWorkspaceData();
    return { ...preview, supabase: null, userId: null };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    const preview = getPreviewWorkspaceData();
    return { ...preview, supabase: null, userId: null };
  }

  let { data: portfolioRows } = await supabase
    .from("portfolios")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!portfolioRows?.length) {
    await createDefaultWorkspace(supabase, {
      id: user.id,
      email: user.email ?? undefined,
    });

    const refreshed = await supabase
      .from("portfolios")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    portfolioRows = refreshed.data;
  }

  const portfolios = (portfolioRows ?? []).map((row) =>
    mapPortfolio(row as Record<string, unknown>)
  );
  const cookieStore = await cookies();
  const selectedPortfolioId = cookieStore.get(ACTIVE_PORTFOLIO_COOKIE)?.value;
  const activePortfolio =
    portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ??
    portfolios[0] ??
    {
      id: "missing-portfolio",
      name: "Main Portfolio",
      baseCurrency: "RON",
      tags: [],
    };

  let { data: brokerRows } = await supabase
    .from("broker_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("portfolio_id", activePortfolio.id)
    .order("created_at", { ascending: true });

  if (!brokerRows?.length && activePortfolio.id !== "missing-portfolio") {
    await supabase.from("broker_accounts").insert({
      user_id: user.id,
      portfolio_id: activePortfolio.id,
      name: `XTB ${activePortfolio.baseCurrency} account`,
      broker: "XTB",
      base_currency: activePortfolio.baseCurrency,
    });

    const refreshed = await supabase
      .from("broker_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("portfolio_id", activePortfolio.id)
      .order("created_at", { ascending: true });
    brokerRows = refreshed.data;
  }

  return {
    supabase,
    userId: user.id,
    userEmail: user.email ?? "Signed in",
    isPreview: false,
    isLocked: false,
    portfolios,
    activePortfolio,
    brokerAccounts: (brokerRows ?? []).map((row) =>
      mapBrokerAccount(row as Record<string, unknown>)
    ),
  };
});

export async function getWorkspaceShellData(): Promise<WorkspaceShellData> {
  const base = await getWorkspaceBase();

  if (base.isPreview) {
    return previewShell();
  }

  return {
    isPreview: base.isPreview,
    isLocked: base.isLocked,
    userEmail: base.userEmail,
    portfolios: base.portfolios,
    activePortfolio: base.activePortfolio,
    brokerAccounts: base.brokerAccounts,
  };
}

export async function getWorkspaceData(): Promise<WorkspaceData> {
  const base = await getWorkspaceBase();

  if (base.isPreview || !base.supabase || !base.userId) {
    return getPreviewWorkspaceData();
  }

  const [
    { data: holdingRows },
    { data: transactionRows },
    { data: snapshotRows },
    { data: realizedRows },
    { data: settingsRows },
    { data: cashOverrideRows },
    { data: marketRows },
    { data: allHoldingRows },
    { data: allSnapshotRows },
    { data: allCashOverrideRows },
  ] = await Promise.all([
    base.supabase
      .from("holdings")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .order("symbol", { ascending: true }),
    base.supabase
      .from("transactions")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .order("occurred_at", { ascending: false })
      .limit(50),
    base.supabase
      .from("broker_account_snapshots")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .order("snapshot_at", { ascending: false }),
    base.supabase
      .from("transactions")
      .select("realized_pl")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .not("realized_pl", "is", null),
    base.supabase
      .from("market_data_settings")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .limit(1),
    base.supabase
      .from("broker_cash_overrides")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id),
    base.supabase
      .from("market_data_cache")
      .select("*")
      .eq("user_id", base.userId)
      .in("data_type", ["quote", "fx"]),
    base.supabase
      .from("holdings")
      .select("*")
      .eq("user_id", base.userId)
      .order("symbol", { ascending: true }),
    base.supabase
      .from("broker_account_snapshots")
      .select("*")
      .eq("user_id", base.userId)
      .order("snapshot_at", { ascending: false }),
    base.supabase
      .from("broker_cash_overrides")
      .select("*")
      .eq("user_id", base.userId),
  ]);

  const marketDataSettings = mapMarketDataSettings(
    (settingsRows?.[0] as Record<string, unknown> | undefined) ?? null
  );
  const rawHoldings = (holdingRows ?? []).map((row) =>
    mapHolding(row as Record<string, unknown>)
  );
  const transactions = (transactionRows ?? []).map((row) =>
    mapTransaction(row as Record<string, unknown>)
  );
  const visibleTransactions = transactions.filter(isVisibleActivity);
  const valuation = applyLiveValuation({
    holdings: rawHoldings,
    marketRows: (marketRows ?? []) as Record<string, unknown>[],
    baseCurrency: base.activePortfolio.baseCurrency,
    settings: marketDataSettings,
  });
  const cashOverrides = (cashOverrideRows ?? []).map((row) =>
    mapCashOverride(row as Record<string, unknown>)
  );
  const brokerCash = latestSnapshotCash(
    (snapshotRows ?? []) as Record<string, unknown>[],
    cashOverrides
  );
  const realizedPl =
    realizedRows?.length
      ? realizedRows.reduce(
          (total, row) => total + numberFrom((row as Record<string, unknown>).realized_pl),
          0
        )
      : null;
  const summary = computePortfolioSummary(
    valuation.holdings,
    transactions,
    base.activePortfolio.baseCurrency,
    { cash: brokerCash, realizedPl }
  );
  summary.valuationMode = marketDataSettings.valuationMode;
  summary.valuationSource = valuation.source;
  summary.cashSource =
    brokerCash === null
      ? "Ledger fallback"
      : cashOverrides.length
        ? "Manual cash override + broker snapshot"
        : "Broker cash snapshot";
  summary.dataStatus = valuation.status;
  const holdings = enrichHoldings(valuation.holdings, summary.totalValue);
  const allRawHoldings = (allHoldingRows ?? []).map((row) =>
    mapHolding(row as Record<string, unknown>)
  );
  const allCashOverrides = (allCashOverrideRows ?? []).map((row) =>
    mapCashOverride(row as Record<string, unknown>)
  );
  const accountCash = latestSnapshotCash(
    (allSnapshotRows ?? []) as Record<string, unknown>[],
    allCashOverrides
  );
  const accountValuation = applyLiveValuation({
    holdings: allRawHoldings,
    marketRows: (marketRows ?? []) as Record<string, unknown>[],
    baseCurrency: base.activePortfolio.baseCurrency,
    settings: marketDataSettings,
  });
  const accountOverview = buildAccountOverview({
    holdings: accountValuation.holdings,
    cash: accountCash ?? 0,
    currency: base.activePortfolio.baseCurrency,
  });

  return {
    isPreview: base.isPreview,
    isLocked: base.isLocked,
    userEmail: base.userEmail,
    portfolios: base.portfolios,
    activePortfolio: base.activePortfolio,
    brokerAccounts: base.brokerAccounts,
    holdings,
    transactions: visibleTransactions,
    summary,
    accountOverview,
    marketDataSettings,
    accumulationCandidates: rankCandidates(holdings, "accumulation"),
    trimmingCandidates: rankCandidates(holdings, "trimming"),
  };
}

export async function getPortfolioData(): Promise<
  Pick<
    WorkspaceData,
    | "isPreview"
    | "isLocked"
    | "userEmail"
    | "portfolios"
    | "activePortfolio"
    | "brokerAccounts"
    | "holdings"
    | "summary"
    | "marketDataSettings"
  >
> {
  const base = await getWorkspaceBase();

  if (base.isPreview || !base.supabase || !base.userId) {
    const preview = getPreviewWorkspaceData();
    return {
      isPreview: preview.isPreview,
      isLocked: preview.isLocked,
      userEmail: preview.userEmail,
      portfolios: preview.portfolios,
      activePortfolio: preview.activePortfolio,
      brokerAccounts: preview.brokerAccounts,
      holdings: preview.holdings,
      summary: preview.summary,
      marketDataSettings: DEFAULT_MARKET_SETTINGS,
    };
  }

  const [
    { data: holdingRows },
    { data: snapshotRows },
    { data: settingsRows },
    { data: cashOverrideRows },
    { data: marketRows },
  ] = await Promise.all([
    base.supabase
      .from("holdings")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .order("symbol", { ascending: true }),
    base.supabase
      .from("broker_account_snapshots")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .order("snapshot_at", { ascending: false }),
    base.supabase
      .from("market_data_settings")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .limit(1),
    base.supabase
      .from("broker_cash_overrides")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id),
    base.supabase
      .from("market_data_cache")
      .select("*")
      .eq("user_id", base.userId)
      .in("data_type", ["quote", "fx"]),
  ]);

  const rawHoldings = (holdingRows ?? []).map((row) =>
    mapHolding(row as Record<string, unknown>)
  );
  const marketDataSettings = mapMarketDataSettings(
    (settingsRows?.[0] as Record<string, unknown> | undefined) ?? null
  );
  const valuation = applyLiveValuation({
    holdings: rawHoldings,
    marketRows: (marketRows ?? []) as Record<string, unknown>[],
    baseCurrency: base.activePortfolio.baseCurrency,
    settings: marketDataSettings,
  });
  const cashOverrides = (cashOverrideRows ?? []).map((row) =>
    mapCashOverride(row as Record<string, unknown>)
  );
  const brokerCash = latestSnapshotCash(
    (snapshotRows ?? []) as Record<string, unknown>[],
    cashOverrides
  );
  const summary = computePortfolioSummary(
    valuation.holdings,
    [],
    base.activePortfolio.baseCurrency,
    { cash: brokerCash }
  );
  summary.valuationMode = marketDataSettings.valuationMode;
  summary.valuationSource = valuation.source;
  summary.cashSource =
    brokerCash === null
      ? "Ledger fallback"
      : cashOverrides.length
        ? "Manual cash override + broker snapshot"
        : "Broker cash snapshot";
  summary.dataStatus = valuation.status;

  return {
    isPreview: base.isPreview,
    isLocked: base.isLocked,
    userEmail: base.userEmail,
    portfolios: base.portfolios,
    activePortfolio: base.activePortfolio,
    brokerAccounts: base.brokerAccounts,
    holdings: enrichHoldings(valuation.holdings, summary.totalValue),
    summary,
    marketDataSettings,
  };
}

export async function getStockDetailData(symbol: string): Promise<
  Pick<
    WorkspaceData,
    | "isPreview"
    | "isLocked"
    | "userEmail"
    | "portfolios"
    | "activePortfolio"
    | "brokerAccounts"
    | "summary"
    | "marketDataSettings"
  > & {
    holding: WorkspaceData["holdings"][number] | null;
    transactions: Transaction[];
  }
> {
  const base = await getWorkspaceBase();
  const normalizedSymbol = symbol.toUpperCase();

  if (base.isPreview || !base.supabase || !base.userId) {
    const preview = getPreviewWorkspaceData();
    return {
      isPreview: preview.isPreview,
      isLocked: preview.isLocked,
      userEmail: preview.userEmail,
      portfolios: preview.portfolios,
      activePortfolio: preview.activePortfolio,
      brokerAccounts: preview.brokerAccounts,
      summary: preview.summary,
      marketDataSettings: DEFAULT_MARKET_SETTINGS,
      holding:
        preview.holdings.find(
          (holding) => holding.symbol.toUpperCase() === normalizedSymbol
        ) ?? null,
      transactions: preview.transactions.filter(
        (transaction) => transaction.symbol?.toUpperCase() === normalizedSymbol
      ),
    };
  }

  const [
    { data: holdingRows },
    { data: transactionRows },
    { data: snapshotRows },
    { data: realizedRows },
    { data: settingsRows },
    { data: cashOverrideRows },
    { data: marketRows },
  ] = await Promise.all([
    base.supabase
      .from("holdings")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .order("symbol", { ascending: true }),
    base.supabase
      .from("transactions")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .eq("symbol", normalizedSymbol)
      .order("occurred_at", { ascending: false })
      .limit(80),
    base.supabase
      .from("broker_account_snapshots")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .order("snapshot_at", { ascending: false }),
    base.supabase
      .from("transactions")
      .select("realized_pl")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .eq("symbol", normalizedSymbol)
      .not("realized_pl", "is", null),
    base.supabase
      .from("market_data_settings")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id)
      .limit(1),
    base.supabase
      .from("broker_cash_overrides")
      .select("*")
      .eq("user_id", base.userId)
      .eq("portfolio_id", base.activePortfolio.id),
    base.supabase
      .from("market_data_cache")
      .select("*")
      .eq("user_id", base.userId)
      .in("data_type", ["quote", "fx"]),
  ]);

  const marketDataSettings = mapMarketDataSettings(
    (settingsRows?.[0] as Record<string, unknown> | undefined) ?? null
  );
  const rawHoldings = (holdingRows ?? []).map((row) =>
    mapHolding(row as Record<string, unknown>)
  );
  const valuation = applyLiveValuation({
    holdings: rawHoldings,
    marketRows: (marketRows ?? []) as Record<string, unknown>[],
    baseCurrency: base.activePortfolio.baseCurrency,
    settings: marketDataSettings,
  });
  const cashOverrides = (cashOverrideRows ?? []).map((row) =>
    mapCashOverride(row as Record<string, unknown>)
  );
  const brokerCash = latestSnapshotCash(
    (snapshotRows ?? []) as Record<string, unknown>[],
    cashOverrides
  );
  const realizedPl =
    realizedRows?.length
      ? realizedRows.reduce(
          (total, row) => total + numberFrom((row as Record<string, unknown>).realized_pl),
          0
        )
      : null;
  const summary = computePortfolioSummary(
    valuation.holdings,
    [],
    base.activePortfolio.baseCurrency,
    { cash: brokerCash, realizedPl }
  );
  summary.valuationMode = marketDataSettings.valuationMode;
  summary.valuationSource = valuation.source;
  summary.cashSource =
    brokerCash === null
      ? "Ledger fallback"
      : cashOverrides.length
        ? "Manual cash override + broker snapshot"
        : "Broker cash snapshot";
  summary.dataStatus = valuation.status;
  const holdings = enrichHoldings(valuation.holdings, summary.totalValue);

  return {
    isPreview: base.isPreview,
    isLocked: base.isLocked,
    userEmail: base.userEmail,
    portfolios: base.portfolios,
    activePortfolio: base.activePortfolio,
    brokerAccounts: base.brokerAccounts,
    summary,
    marketDataSettings,
    holding:
      holdings.find((holding) => holding.symbol.toUpperCase() === normalizedSymbol) ??
      null,
    transactions: (transactionRows ?? [])
      .map((row) => mapTransaction(row as Record<string, unknown>))
      .filter(isVisibleActivity),
  };
}

export async function getStrategyData(): Promise<StrategyData> {
  const base = await getWorkspaceBase();

  if (base.isPreview || !base.supabase || !base.userId) {
    const preview = getPreviewWorkspaceData();
    return {
      isPreview: preview.isPreview,
      isLocked: preview.isLocked,
      userEmail: preview.userEmail,
      portfolios: preview.portfolios,
      activePortfolio: preview.activePortfolio,
      brokerAccounts: preview.brokerAccounts,
      holdings: preview.holdings,
    };
  }

  const { data: holdingRows } = await base.supabase
    .from("holdings")
    .select("*")
    .eq("user_id", base.userId)
    .eq("portfolio_id", base.activePortfolio.id)
    .order("symbol", { ascending: true });

  const summary = computePortfolioSummary(
    (holdingRows ?? []).map((row) => mapHolding(row as Record<string, unknown>)),
    [],
    base.activePortfolio.baseCurrency
  );

  return {
    isPreview: base.isPreview,
    isLocked: base.isLocked,
    userEmail: base.userEmail,
    portfolios: base.portfolios,
    activePortfolio: base.activePortfolio,
    brokerAccounts: base.brokerAccounts,
    holdings: enrichHoldings(
      (holdingRows ?? []).map((row) => mapHolding(row as Record<string, unknown>)),
      summary.totalValue
    ),
  };
}

export async function getSettingsData(): Promise<SettingsData> {
  const base = await getWorkspaceBase();

  if (base.isPreview || !base.supabase || !base.userId) {
    const preview = getPreviewWorkspaceData();
    return {
      isPreview: preview.isPreview,
      isLocked: preview.isLocked,
      userEmail: preview.userEmail,
      portfolios: preview.portfolios,
      activePortfolio: preview.activePortfolio,
      brokerAccounts: preview.brokerAccounts,
      marketDataSettings: DEFAULT_MARKET_SETTINGS,
      apiKeys: [],
      cashOverrides: [],
    };
  }

  const [{ data: settingsRows }, { data: keyRows }, { data: overrideRows }] =
    await Promise.all([
      base.supabase
        .from("market_data_settings")
        .select("*")
        .eq("user_id", base.userId)
        .eq("portfolio_id", base.activePortfolio.id)
        .limit(1),
      base.supabase
        .from("market_data_api_keys")
        .select("provider, enabled, key_last4, updated_at")
        .eq("user_id", base.userId)
        .order("provider", { ascending: true }),
      base.supabase
        .from("broker_cash_overrides")
        .select("*")
        .eq("user_id", base.userId)
        .eq("portfolio_id", base.activePortfolio.id),
    ]);

  return {
    isPreview: base.isPreview,
    isLocked: base.isLocked,
    userEmail: base.userEmail,
    portfolios: base.portfolios,
    activePortfolio: base.activePortfolio,
    brokerAccounts: base.brokerAccounts,
    marketDataSettings: mapMarketDataSettings(
      (settingsRows?.[0] as Record<string, unknown> | undefined) ?? null
    ),
    apiKeys: (keyRows ?? []).map((row) =>
      mapApiKey(row as Record<string, unknown>)
    ),
    cashOverrides: (overrideRows ?? []).map((row) =>
      mapCashOverride(row as Record<string, unknown>)
    ),
  };
}

export async function getActivityData(): Promise<
  Pick<
    WorkspaceData,
    | "isPreview"
    | "isLocked"
    | "userEmail"
    | "portfolios"
    | "activePortfolio"
    | "brokerAccounts"
    | "transactions"
  >
> {
  const base = await getWorkspaceBase();

  if (base.isPreview || !base.supabase || !base.userId) {
    const preview = getPreviewWorkspaceData();
    return {
      isPreview: preview.isPreview,
      isLocked: preview.isLocked,
      userEmail: preview.userEmail,
      portfolios: preview.portfolios,
      activePortfolio: preview.activePortfolio,
      brokerAccounts: preview.brokerAccounts,
      transactions: preview.transactions,
    };
  }

  const { data: transactionRows } = await base.supabase
    .from("transactions")
    .select("*")
    .eq("user_id", base.userId)
    .eq("portfolio_id", base.activePortfolio.id)
    .order("occurred_at", { ascending: false })
    .limit(250);

  return {
    isPreview: base.isPreview,
    isLocked: base.isLocked,
    userEmail: base.userEmail,
    portfolios: base.portfolios,
    activePortfolio: base.activePortfolio,
    brokerAccounts: base.brokerAccounts,
    transactions: (transactionRows ?? [])
      .map((row) => mapTransaction(row as Record<string, unknown>))
      .filter(isVisibleActivity),
  };
}
