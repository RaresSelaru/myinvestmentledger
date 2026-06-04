import { cookies } from "next/headers";
import { cache } from "react";
import { computePortfolioSummary, enrichHoldings, rankCandidates } from "@/lib/finance";
import { getPreviewWorkspaceData } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BrokerAccount,
  Holding,
  Portfolio,
  Transaction,
  WorkspaceData,
  WorkspaceShellData,
} from "@/lib/types";

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

const ACTIVE_PORTFOLIO_COOKIE = "mil_active_portfolio_id";

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

function mapHolding(row: Record<string, unknown>): Holding {
  return {
    id: String(row.id),
    portfolioId: String(row.portfolio_id),
    symbol: String(row.symbol ?? ""),
    companyName: row.company_name ? String(row.company_name) : null,
    quantity: numberFrom(row.quantity),
    averageCost: numberFrom(row.average_cost),
    currentPrice: numberFrom(row.current_price),
    currency: String(row.currency ?? "RON"),
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

  const [{ data: holdingRows }, { data: transactionRows }] = await Promise.all([
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
  ]);

  const rawHoldings = (holdingRows ?? []).map((row) =>
    mapHolding(row as Record<string, unknown>)
  );
  const transactions = (transactionRows ?? []).map((row) =>
    mapTransaction(row as Record<string, unknown>)
  );
  const summary = computePortfolioSummary(
    rawHoldings,
    transactions,
    base.activePortfolio.baseCurrency
  );
  const holdings = enrichHoldings(rawHoldings, summary.totalValue);

  return {
    isPreview: base.isPreview,
    isLocked: base.isLocked,
    userEmail: base.userEmail,
    portfolios: base.portfolios,
    activePortfolio: base.activePortfolio,
    brokerAccounts: base.brokerAccounts,
    holdings,
    transactions,
    summary,
    accumulationCandidates: rankCandidates(holdings, "accumulation"),
    trimmingCandidates: rankCandidates(holdings, "trimming"),
  };
}
