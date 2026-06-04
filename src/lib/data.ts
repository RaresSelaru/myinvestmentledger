import { redirect } from "next/navigation";
import { computePortfolioSummary, enrichHoldings, rankCandidates } from "@/lib/finance";
import { getPreviewWorkspaceData } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BrokerAccount,
  Holding,
  Portfolio,
  Transaction,
  WorkspaceData,
} from "@/lib/types";

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

async function ensureDefaultWorkspace(
  supabase: SupabaseClient,
  user: { id: string; email?: string }
) {
  await supabase.from("profiles").upsert({
    user_id: user.id,
    email: user.email ?? null,
    default_currency: "RON",
    updated_at: new Date().toISOString(),
  });

  const { data: existingPortfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingPortfolio?.id) {
    const { data: existingBrokerAccount } = await supabase
      .from("broker_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("portfolio_id", existingPortfolio.id)
      .limit(1)
      .maybeSingle();

    if (!existingBrokerAccount?.id) {
      await supabase.from("broker_accounts").insert({
        user_id: user.id,
        portfolio_id: existingPortfolio.id,
        name: "XTB RON account",
        broker: "XTB",
        base_currency: "RON",
      });
    }

    return existingPortfolio.id as string;
  }

  const { data: portfolio } = await supabase
    .from("portfolios")
    .insert({
      user_id: user.id,
      name: "Main Portfolio",
      base_currency: "RON",
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

export async function getWorkspaceData(): Promise<WorkspaceData> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return getPreviewWorkspaceData();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activePortfolioId = await ensureDefaultWorkspace(supabase, {
    id: user.id,
    email: user.email ?? undefined,
  });

  const [{ data: portfolioRows }, { data: brokerRows }, { data: holdingRows }, { data: transactionRows }] =
    await Promise.all([
      supabase
        .from("portfolios")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("broker_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("holdings")
        .select("*")
        .eq("user_id", user.id)
        .eq("portfolio_id", activePortfolioId)
        .order("symbol", { ascending: true }),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("portfolio_id", activePortfolioId)
        .order("occurred_at", { ascending: false })
        .limit(20),
    ]);

  const portfolios = (portfolioRows ?? []).map((row) =>
    mapPortfolio(row as Record<string, unknown>)
  );
  const activePortfolio =
    portfolios.find((portfolio) => portfolio.id === activePortfolioId) ??
    portfolios[0] ??
    {
      id: String(activePortfolioId),
      name: "Main Portfolio",
      baseCurrency: "RON",
    };
  const brokerAccounts = (brokerRows ?? []).map((row) =>
    mapBrokerAccount(row as Record<string, unknown>)
  );
  const rawHoldings = (holdingRows ?? []).map((row) =>
    mapHolding(row as Record<string, unknown>)
  );
  const transactions = (transactionRows ?? []).map((row) =>
    mapTransaction(row as Record<string, unknown>)
  );
  const summary = computePortfolioSummary(
    rawHoldings,
    transactions,
    activePortfolio.baseCurrency
  );
  const holdings = enrichHoldings(rawHoldings, summary.totalValue);

  return {
    isPreview: false,
    userEmail: user.email ?? "Signed in",
    portfolios,
    activePortfolio,
    brokerAccounts,
    holdings,
    transactions,
    summary,
    accumulationCandidates: rankCandidates(holdings, "accumulation"),
    trimmingCandidates: rankCandidates(holdings, "trimming"),
  };
}
