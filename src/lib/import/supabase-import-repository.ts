import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computePortfolioState,
  matchInternalTransfers,
  reconcileManualTransactions,
  type TargetConfig,
} from "@/lib/portfolio/engine";
import type {
  CashOperation,
  PositionLot,
  Transaction,
} from "@/lib/types";
import type {
  ImportFileInput,
  ImportRepository,
  ImportResult,
  NormalizedWriteInput,
  RawRowWriteInput,
  StoredRawRow,
} from "@/lib/import/xtb-import-service";

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function numberFrom(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dbImportStatus(status: ImportResult["stats"]["status"]) {
  if (status === "completed") return "succeeded";
  if (status === "dry_run") return "pending";
  return status;
}

function mapPositionLot(row: Record<string, unknown>): PositionLot {
  return {
    id: String(row.id),
    portfolioId: String(row.portfolio_id),
    brokerAccountId: String(row.broker_account_id),
    symbol: String(row.symbol),
    side: String(row.side ?? "buy") === "sell" ? "sell" : "buy",
    quantity: numberFrom(row.quantity),
    openPrice: numberFrom(row.open_price),
    currentPrice: nullableNumber(row.current_price),
    costBasis: numberFrom(row.cost_basis),
    marketValue: nullableNumber(row.market_value),
    unrealizedPl: nullableNumber(row.unrealized_pl),
    currency: String(row.currency),
    openedAt: row.opened_at ? String(row.opened_at) : null,
    sourceFingerprint: String(row.source_fingerprint),
  };
}

function mapCashOperation(row: Record<string, unknown>): CashOperation {
  return {
    id: String(row.id),
    portfolioId: String(row.portfolio_id),
    brokerAccountId: String(row.broker_account_id),
    operationType: String(row.operation_type),
    normalizedType: String(row.normalized_type) as CashOperation["normalizedType"],
    amount: numberFrom(row.amount),
    currency: String(row.currency),
    occurredAt: String(row.occurred_at),
    description: row.description ? String(row.description) : null,
    symbol: row.symbol ? String(row.symbol) : null,
    sourceFingerprint: String(row.source_fingerprint),
  };
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    portfolioId: String(row.portfolio_id),
    brokerAccountId: row.broker_account_id ? String(row.broker_account_id) : null,
    date: String(row.occurred_at ?? row.trade_date),
    type: String(row.transaction_type ?? row.type) as Transaction["type"],
    symbol: row.symbol ? String(row.symbol) : null,
    quantity: nullableNumber(row.quantity),
    price: nullableNumber(row.price),
    amount: numberFrom(row.amount),
    currency: String(row.currency),
    source: String(row.source_type ?? row.source) as Transaction["source"],
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

function mapTarget(row: Record<string, unknown>): TargetConfig {
  return {
    symbol: String(row.symbol),
    targetAllocationPct: numberFrom(
      row.target_allocation_pct ?? row.target_allocation
    ),
    maxAllocationPct: nullableNumber(row.max_allocation_pct ?? row.max_allocation),
    corePct: numberFrom(row.core_pct ?? row.core_percent, 100),
    satellitePct: numberFrom(row.satellite_pct ?? row.satellite_percent),
    targetBuyPrice: nullableNumber(row.target_buy_price),
    targetSellPrice: nullableNumber(row.target_sell_price),
    riskLevel: row.risk_level ? String(row.risk_level) : null,
    convictionLevel: row.conviction_level ? String(row.conviction_level) : null,
    recommendationsDisabled: Boolean(row.recommendations_disabled),
  };
}

export class SupabaseImportRepository implements ImportRepository {
  constructor(private supabase: SupabaseClient) {}

  async upsertImportedFile(
    input: ImportFileInput,
    stats: ImportResult["stats"]
  ): Promise<string> {
    const { data: existing, error: existingError } = await this.supabase
      .from("imported_files")
      .select("id")
      .eq("user_id", input.userId)
      .eq("broker_account_id", input.brokerAccountId)
      .eq("file_hash", input.fileHash)
      .maybeSingle();

    if (existingError) throw existingError;

    const id = existing?.id ? String(existing.id) : input.id;
    const { data, error } = await this.supabase
      .from("imported_files")
      .upsert(
        {
          id,
          user_id: input.userId,
          portfolio_id: input.portfolioId,
          broker_account_id: input.brokerAccountId,
          original_filename: input.fileName,
          file_name: input.fileName,
          storage_bucket: input.storageBucket,
          storage_path: input.storagePath,
          file_hash: input.fileHash,
          parser: "xtb_excel_v1",
          status: dbImportStatus(stats.status),
          imported_at: new Date().toISOString(),
          report_start_date: input.meta.reportStartDate,
          report_end_date: input.meta.reportEndDate,
          account_currency: input.meta.accountCurrency,
          result: stats,
          import_stats: stats,
        },
        { onConflict: "user_id,broker_account_id,file_hash" }
      )
      .select("id")
      .single();

    if (error) throw error;

    return String(data.id);
  }

  async findRawRow(input: {
    userId: string;
    brokerAccountId: string;
    sourceFingerprint: string;
  }): Promise<StoredRawRow | null> {
    const { data, error } = await this.supabase
      .from("raw_import_rows")
      .select("id, source_fingerprint, full_row_hash")
      .eq("user_id", input.userId)
      .eq("broker_account_id", input.brokerAccountId)
      .eq("source_fingerprint", input.sourceFingerprint)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: String(data.id),
      sourceFingerprint: String(data.source_fingerprint),
      fullRowHash: String(data.full_row_hash),
    };
  }

  async insertRawRow(input: RawRowWriteInput): Promise<StoredRawRow> {
    return this.writeRawRow(input);
  }

  async updateRawRow(id: string, input: RawRowWriteInput): Promise<StoredRawRow> {
    return this.writeRawRow(input, id);
  }

  private async writeRawRow(
    input: RawRowWriteInput,
    id?: string
  ): Promise<StoredRawRow> {
    const payload = {
      id,
      user_id: input.userId,
      portfolio_id: input.portfolioId,
      broker_account_id: input.brokerAccountId,
      imported_file_id: input.importedFileId,
      source_row_number: input.row.rowNumber,
      row_hash: input.row.fullRowHash,
      raw_payload: input.row.rawJson,
      normalized_payload: {
        kind: input.row.kind,
        transaction: input.row.transaction,
        position_lot: input.row.positionLot,
        cash_operation: input.row.cashOperation,
      },
      sheet_name: input.row.sheetName,
      row_number: input.row.rowNumber,
      raw_json: input.row.rawJson,
      source_fingerprint: input.row.sourceFingerprint,
      full_row_hash: input.row.fullRowHash,
      status: input.status,
    };
    const query = id
      ? this.supabase.from("raw_import_rows").upsert(payload)
      : this.supabase.from("raw_import_rows").insert(payload);
    const { data, error } = await query.select("id, source_fingerprint, full_row_hash").single();

    if (error) throw error;

    return {
      id: String(data.id),
      sourceFingerprint: String(data.source_fingerprint),
      fullRowHash: String(data.full_row_hash),
    };
  }

  async upsertTransaction(input: NormalizedWriteInput<Transaction>) {
    const value = input.value;

    const { error } = await this.supabase.from("transactions").upsert(
      {
        user_id: input.userId,
        portfolio_id: input.portfolioId,
        broker_account_id: input.brokerAccountId,
        imported_file_id: input.importedFileId,
        raw_import_row_id: input.rawImportRowId,
        trade_date: dateOnly(value.date),
        occurred_at: value.date,
        type: value.type,
        transaction_type: value.type,
        source: "xtb_import",
        source_type: "xtb_import",
        symbol: value.symbol,
        quantity: value.quantity,
        price: value.price,
        amount: value.amount,
        currency: value.currency,
        comment: value.comment,
        source_fingerprint: input.row.sourceFingerprint,
        full_row_hash: input.row.fullRowHash,
      },
      { onConflict: "user_id,broker_account_id,source_fingerprint" }
    );

    if (error) throw error;
  }

  async upsertPositionLot(input: NormalizedWriteInput<PositionLot>) {
    const value = input.value;
    const { error } = await this.supabase.from("position_lots").upsert(
      {
        user_id: input.userId,
        portfolio_id: input.portfolioId,
        broker_account_id: input.brokerAccountId,
        imported_file_id: input.importedFileId,
        raw_import_row_id: input.rawImportRowId,
        symbol: value.symbol,
        side: value.side,
        quantity: value.quantity,
        open_price: value.openPrice,
        current_price: value.currentPrice,
        cost_basis: value.costBasis,
        market_value: value.marketValue,
        unrealized_pl: value.unrealizedPl,
        currency: value.currency,
        opened_at: value.openedAt,
        source_fingerprint: input.row.sourceFingerprint,
        full_row_hash: input.row.fullRowHash,
      },
      { onConflict: "user_id,broker_account_id,source_fingerprint" }
    );

    if (error) throw error;
  }

  async upsertCashOperation(input: NormalizedWriteInput<CashOperation>) {
    const value = input.value;
    const { error } = await this.supabase.from("cash_operations").upsert(
      {
        user_id: input.userId,
        portfolio_id: input.portfolioId,
        broker_account_id: input.brokerAccountId,
        imported_file_id: input.importedFileId,
        raw_import_row_id: input.rawImportRowId,
        operation_type: value.operationType,
        normalized_type: value.normalizedType,
        amount: value.amount,
        currency: value.currency,
        occurred_at: value.occurredAt,
        description: value.description,
        symbol: value.symbol,
        source_fingerprint: input.row.sourceFingerprint,
        full_row_hash: input.row.fullRowHash,
      },
      { onConflict: "user_id,broker_account_id,source_fingerprint" }
    );

    if (error) throw error;
  }

  async recomputePortfolio(input: {
    userId: string;
    portfolioId: string;
    brokerAccountId: string;
    importedFileId: string;
  }) {
    const [
      { data: portfolioRows },
      { data: lotRows },
      { data: cashRows },
      { data: targetRows },
      { data: transactionRows },
    ] =
      await Promise.all([
        this.supabase
          .from("portfolios")
          .select("base_currency")
          .eq("user_id", input.userId)
          .eq("id", input.portfolioId)
          .limit(1),
        this.supabase
          .from("position_lots")
          .select("*")
          .eq("user_id", input.userId)
          .eq("portfolio_id", input.portfolioId),
        this.supabase
          .from("cash_operations")
          .select("*")
          .eq("user_id", input.userId)
          .eq("portfolio_id", input.portfolioId),
        this.supabase
          .from("targets")
          .select("*")
          .eq("user_id", input.userId)
          .eq("portfolio_id", input.portfolioId),
        this.supabase
          .from("transactions")
          .select("*")
          .eq("user_id", input.userId)
          .eq("portfolio_id", input.portfolioId),
      ]);
    const baseCurrency = String(portfolioRows?.[0]?.base_currency ?? "RON");
    const state = computePortfolioState({
      portfolioId: input.portfolioId,
      lots: (lotRows ?? []).map((row) => mapPositionLot(row as Record<string, unknown>)),
      cashOperations: (cashRows ?? []).map((row) =>
        mapCashOperation(row as Record<string, unknown>)
      ),
      targets: (targetRows ?? []).map((row) => mapTarget(row as Record<string, unknown>)),
      baseCurrency,
    });
    const cashOperations = (cashRows ?? []).map((row) =>
      mapCashOperation(row as Record<string, unknown>)
    );
    const internalTransferMatches = matchInternalTransfers(cashOperations, {});
    const reconciliationMatches = reconcileManualTransactions(
      (transactionRows ?? []).map((row) =>
        mapTransaction(row as Record<string, unknown>)
      )
    );

    for (const match of reconciliationMatches) {
      await this.supabase
        .from("transactions")
        .update({
          is_reconciled: true,
          reconciled_with_transaction_id: match.importedTransactionId,
          reconciled_transaction_id: match.importedTransactionId,
        })
        .eq("id", match.manualTransactionId)
        .eq("user_id", input.userId);
    }

    for (const match of internalTransferMatches) {
      await this.supabase.from("internal_transfers").upsert(
        {
          user_id: input.userId,
          portfolio_id: input.portfolioId,
          from_broker_account_id: match.fromBrokerAccountId,
          to_broker_account_id: match.toBrokerAccountId,
          from_amount: match.fromAmount,
          from_currency: match.fromCurrency,
          to_amount: match.toAmount,
          to_currency: match.toCurrency,
          fx_rate: match.fxRate,
          occurred_at: match.occurredAt,
          transfer_date: dateOnly(match.occurredAt),
          amount: match.fromAmount,
          currency: match.fromCurrency,
          comment: "Auto-linked from XTB transfer cash operations",
          match_confidence: match.confidence,
        },
        {
          onConflict:
            "user_id,portfolio_id,from_broker_account_id,to_broker_account_id,occurred_at",
        }
      );
    }

    await this.supabase
      .from("holdings")
      .delete()
      .eq("user_id", input.userId)
      .eq("portfolio_id", input.portfolioId);

    if (state.holdings.length) {
      const holdingPayload = state.holdings.map((holding) => ({
        user_id: input.userId,
        portfolio_id: input.portfolioId,
        symbol: holding.symbol,
        company_name: holding.companyName,
        quantity: holding.quantity,
        average_cost: holding.averageCost,
        current_price: holding.currentPrice,
        currency: holding.currency,
        market_value: holding.marketValue,
        cost_basis: holding.costBasis,
        realized_pl: holding.realizedPl,
        unrealized_pl: holding.unrealizedPl,
        target_allocation: holding.targetAllocation,
        max_allocation: holding.maxAllocation,
        target_buy_price: holding.targetBuyPrice,
        target_sell_price: holding.targetSellPrice,
        core_percent: holding.corePercent,
        satellite_percent: holding.satellitePercent,
        source_refs: holding.sourceReferences ?? [],
      }));

      await this.supabase.from("holdings").upsert(holdingPayload, {
        onConflict: "user_id,portfolio_id,symbol",
      });

      await this.supabase.from("holdings_snapshot").insert(
        state.holdings.map((holding) => ({
          user_id: input.userId,
          portfolio_id: input.portfolioId,
          broker_account_id: input.brokerAccountId,
          imported_file_id: input.importedFileId,
          symbol: holding.symbol,
          quantity: holding.quantity,
          average_cost: holding.averageCost,
          cost_basis: holding.costBasis,
          current_price: holding.currentPrice,
          market_value: holding.marketValue,
          market_value_base: holding.marketValue,
          unrealized_pl: holding.unrealizedPl,
          realized_pl: holding.realizedPl,
          currency: holding.currency,
          snapshot_at: new Date().toISOString(),
          source_refs: holding.sourceReferences ?? [],
        }))
      );
    }
  }
}
