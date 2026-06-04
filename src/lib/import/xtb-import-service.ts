import { computePortfolioState, type TargetConfig } from "@/lib/portfolio/engine";
import type { CashOperation, HoldingView, PositionLot, Transaction } from "@/lib/types";
import {
  parseXtbWorkbook,
  type ParsedXtbRow,
  type XtbImportStats,
  type XtbWorkbookMeta,
} from "@/lib/import/xtb-parser";

export type XtbImportMode = "dry-run" | "commit";

export type StoredRawRow = {
  id: string;
  sourceFingerprint: string;
  fullRowHash: string;
};

export type ImportFileInput = {
  id: string;
  userId: string;
  portfolioId: string;
  brokerAccountId: string;
  fileName: string;
  fileHash: string;
  storagePath: string;
  storageBucket: string;
  meta: XtbWorkbookMeta;
};

export type ImportResult = {
  importedFileId: string | null;
  stats: XtbImportStats & {
    newRows: number;
    duplicatesIgnored: number;
    correctedRows: number;
    status: "processing" | "completed" | "dry_run" | "failed";
    error?: string;
  };
  meta: XtbWorkbookMeta;
};

export type ImportRepository = {
  upsertImportedFile(input: ImportFileInput, stats: ImportResult["stats"]): Promise<string>;
  findRawRow(input: {
    userId: string;
    brokerAccountId: string;
    sourceFingerprint: string;
  }): Promise<StoredRawRow | null>;
  insertRawRow(input: RawRowWriteInput): Promise<StoredRawRow>;
  updateRawRow(id: string, input: RawRowWriteInput): Promise<StoredRawRow>;
  upsertTransaction(input: NormalizedWriteInput<Transaction>): Promise<void>;
  upsertPositionLot(input: NormalizedWriteInput<PositionLot>): Promise<void>;
  upsertCashOperation(input: NormalizedWriteInput<CashOperation>): Promise<void>;
  recomputePortfolio(input: {
    userId: string;
    portfolioId: string;
    brokerAccountId: string;
    importedFileId: string;
  }): Promise<void>;
};

export type RawRowWriteInput = {
  userId: string;
  portfolioId: string;
  brokerAccountId: string;
  importedFileId: string;
  row: ParsedXtbRow;
  status: "new" | "corrected";
};

export type NormalizedWriteInput<T> = {
  userId: string;
  portfolioId: string;
  brokerAccountId: string;
  importedFileId: string;
  rawImportRowId: string;
  row: ParsedXtbRow;
  value: T;
};

export function dryRunXtbImport(
  buffer: Buffer,
  input: { brokerAccountId: string; accountCurrency?: string | null }
): ImportResult {
  const parsed = parseXtbWorkbook(buffer, input);

  return {
    importedFileId: null,
    meta: parsed.meta,
    stats: {
      ...parsed.stats,
      newRows: parsed.rows.length,
      duplicatesIgnored: 0,
      correctedRows: 0,
      status: "dry_run",
    },
  };
}

async function writeNormalizedRows(
  repository: ImportRepository,
  input: {
    userId: string;
    portfolioId: string;
    brokerAccountId: string;
    importedFileId: string;
    row: ParsedXtbRow;
    rawImportRowId: string;
  }
) {
  if (input.row.transaction) {
    await repository.upsertTransaction({
      ...input,
      value: input.row.transaction as Transaction,
    });
  }

  if (input.row.positionLot) {
    await repository.upsertPositionLot({
      ...input,
      value: input.row.positionLot as PositionLot,
    });
  }

  if (input.row.cashOperation) {
    await repository.upsertCashOperation({
      ...input,
      value: input.row.cashOperation as CashOperation,
    });
  }
}

export async function commitXtbImport({
  buffer,
  file,
  repository,
}: {
  buffer: Buffer;
  file: ImportFileInput;
  repository: ImportRepository;
}): Promise<ImportResult> {
  const parsed = parseXtbWorkbook(buffer, {
    brokerAccountId: file.brokerAccountId,
    accountCurrency: file.meta.accountCurrency,
  });
  const stats: ImportResult["stats"] = {
    ...parsed.stats,
    newRows: 0,
    duplicatesIgnored: 0,
    correctedRows: 0,
    status: "processing",
  };
  const importedFileId = await repository.upsertImportedFile(
    { ...file, meta: parsed.meta },
    stats
  );

  try {
    for (const row of parsed.rows) {
      const existing = await repository.findRawRow({
        userId: file.userId,
        brokerAccountId: file.brokerAccountId,
        sourceFingerprint: row.sourceFingerprint,
      });

      const rawRow =
        existing?.fullRowHash === row.fullRowHash
          ? existing
          : existing
            ? await repository.updateRawRow(existing.id, {
                userId: file.userId,
                portfolioId: file.portfolioId,
                brokerAccountId: file.brokerAccountId,
                importedFileId,
                row,
                status: "corrected",
              })
            : await repository.insertRawRow({
                userId: file.userId,
                portfolioId: file.portfolioId,
                brokerAccountId: file.brokerAccountId,
                importedFileId,
                row,
                status: "new",
              });

      if (existing?.fullRowHash === row.fullRowHash) {
        stats.duplicatesIgnored += 1;
      } else if (existing) {
        stats.correctedRows += 1;
      } else {
        stats.newRows += 1;
      }

      await writeNormalizedRows(repository, {
        userId: file.userId,
        portfolioId: file.portfolioId,
        brokerAccountId: file.brokerAccountId,
        importedFileId,
        row,
        rawImportRowId: rawRow.id,
      });
    }

    stats.status = "completed";
    await repository.upsertImportedFile({ ...file, id: importedFileId, meta: parsed.meta }, stats);
    await repository.recomputePortfolio({
      userId: file.userId,
      portfolioId: file.portfolioId,
      brokerAccountId: file.brokerAccountId,
      importedFileId,
    });
  } catch (error) {
    stats.status = "failed";
    stats.error = error instanceof Error ? error.message : "Import failed";
    await repository.upsertImportedFile({ ...file, id: importedFileId, meta: parsed.meta }, stats);
    throw error;
  }

  return {
    importedFileId,
    stats,
    meta: parsed.meta,
  };
}

export function holdingsFromImportedSources(input: {
  portfolioId: string;
  baseCurrency: string;
  lots: PositionLot[];
  cashOperations: CashOperation[];
  targets: TargetConfig[];
  snapshotAt?: string;
}): HoldingView[] {
  return computePortfolioState({
    portfolioId: input.portfolioId,
    lots: input.lots,
    cashOperations: input.cashOperations,
    targets: input.targets,
    baseCurrency: input.baseCurrency,
    snapshotAt: input.snapshotAt,
  }).holdings;
}
