import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  commitXtbImport,
  dryRunXtbImport,
  type ImportFileInput,
  type ImportRepository,
  type ImportRestorePoint,
  type NormalizedWriteInput,
  type RawRowWriteInput,
  type StoredRawRow,
} from "@/lib/import/xtb-import-service";
import type { CashOperation, PositionLot, Transaction } from "@/lib/types";

const fixturePath = path.join(
  process.cwd(),
  "src/__tests__/fixtures/xtb-sample-anonymized.xlsx"
);

class MemoryImportRepository implements ImportRepository {
  importedFiles = new Map<string, string>();
  importedFileRows = new Map<string, Record<string, unknown>>();
  rawRows = new Map<string, StoredRawRow>();
  transactions = new Map<string, Transaction>();
  lots = new Map<string, PositionLot>();
  cash = new Map<string, CashOperation>();
  recomputeCalls = 0;
  failAfterTransactionWrites: number | null = null;
  transactionWrites = 0;

  async upsertImportedFile(input: ImportFileInput) {
    const key = `${input.userId}:${input.brokerAccountId}:${input.fileHash}`;
    const existing = this.importedFiles.get(key);

    if (existing) return existing;

    this.importedFiles.set(key, input.id);
    this.importedFileRows.set(key, { ...input });
    return input.id;
  }

  async createImportRestorePoint(input: {
    userId: string;
    portfolioId: string;
    brokerAccountId: string;
    fileHash: string;
    sourceFingerprints: string[];
  }): Promise<ImportRestorePoint> {
    const key = `${input.userId}:${input.brokerAccountId}:${input.fileHash}`;
    const fingerprints = new Set(input.sourceFingerprints);

    const rawRows: Record<string, unknown>[] = [];
    for (const fingerprint of fingerprints) {
      const rowKey = `${input.userId}:${input.brokerAccountId}:${fingerprint}`;
      const row = this.rawRows.get(rowKey);
      if (row) {
        rawRows.push({ rowKey, row });
      }
    }

    return {
      importedFile: this.importedFileRows.get(key) ?? null,
      rawRows,
      transactions: [...this.transactions.entries()]
        .filter(([fingerprint]) => fingerprints.has(fingerprint))
        .map(([fingerprint, value]) => ({ fingerprint, value })),
      positionLots: [...this.lots.entries()]
        .filter(([fingerprint]) => fingerprints.has(fingerprint))
        .map(([fingerprint, value]) => ({ fingerprint, value })),
      cashOperations: [...this.cash.entries()]
        .filter(([fingerprint]) => fingerprints.has(fingerprint))
        .map(([fingerprint, value]) => ({ fingerprint, value })),
      holdings: [],
      brokerAccountSnapshots: [],
    };
  }

  async rollbackImport(input: {
    userId: string;
    brokerAccountId: string;
    fileHash: string;
    sourceFingerprints: string[];
    restorePoint: ImportRestorePoint;
  }) {
    const fingerprints = new Set(input.sourceFingerprints);

    for (const fingerprint of fingerprints) {
      this.rawRows.delete(`${input.userId}:${input.brokerAccountId}:${fingerprint}`);
    }
    for (const fingerprint of fingerprints) {
      this.transactions.delete(fingerprint);
      this.lots.delete(fingerprint);
      this.cash.delete(fingerprint);
    }

    for (const item of input.restorePoint.rawRows) {
      this.rawRows.set(String(item.rowKey), item.row as StoredRawRow);
    }
    for (const item of input.restorePoint.transactions) {
      this.transactions.set(String(item.fingerprint), item.value as Transaction);
    }
    for (const item of input.restorePoint.positionLots) {
      this.lots.set(String(item.fingerprint), item.value as PositionLot);
    }
    for (const item of input.restorePoint.cashOperations) {
      this.cash.set(String(item.fingerprint), item.value as CashOperation);
    }

    const fileKey = `${input.userId}:${input.brokerAccountId}:${input.fileHash}`;
    if (input.restorePoint.importedFile) {
      this.importedFileRows.set(fileKey, input.restorePoint.importedFile);
      this.importedFiles.set(fileKey, String(input.restorePoint.importedFile.id));
    } else {
      this.importedFileRows.delete(fileKey);
      this.importedFiles.delete(fileKey);
    }
  }

  async findRawRow(input: {
    userId: string;
    brokerAccountId: string;
    sourceFingerprint: string;
  }) {
    return this.rawRows.get(`${input.userId}:${input.brokerAccountId}:${input.sourceFingerprint}`) ?? null;
  }

  async insertRawRow(input: RawRowWriteInput) {
    const row = {
      id: `raw-${this.rawRows.size + 1}`,
      sourceFingerprint: input.row.sourceFingerprint,
      fullRowHash: input.row.fullRowHash,
    };
    this.rawRows.set(
      `${input.userId}:${input.brokerAccountId}:${input.row.sourceFingerprint}`,
      row
    );
    return row;
  }

  async updateRawRow(id: string, input: RawRowWriteInput) {
    const row = {
      id,
      sourceFingerprint: input.row.sourceFingerprint,
      fullRowHash: input.row.fullRowHash,
    };
    this.rawRows.set(
      `${input.userId}:${input.brokerAccountId}:${input.row.sourceFingerprint}`,
      row
    );
    return row;
  }

  async upsertTransaction(input: NormalizedWriteInput<Transaction>) {
    this.transactionWrites += 1;
    if (
      this.failAfterTransactionWrites !== null &&
      this.transactionWrites > this.failAfterTransactionWrites
    ) {
      throw new Error("Simulated import failure");
    }

    this.transactions.set(input.row.sourceFingerprint, {
      ...input.value,
      id: input.row.sourceFingerprint,
      portfolioId: input.portfolioId,
      brokerAccountId: input.brokerAccountId,
    });
  }

  async upsertPositionLot(input: NormalizedWriteInput<PositionLot>) {
    this.lots.set(input.row.sourceFingerprint, {
      ...input.value,
      id: input.row.sourceFingerprint,
      portfolioId: input.portfolioId,
      brokerAccountId: input.brokerAccountId,
    });
  }

  async upsertCashOperation(input: NormalizedWriteInput<CashOperation>) {
    this.cash.set(input.row.sourceFingerprint, {
      ...input.value,
      id: input.row.sourceFingerprint,
      portfolioId: input.portfolioId,
      brokerAccountId: input.brokerAccountId,
    });
  }

  async recomputePortfolio() {
    this.recomputeCalls += 1;
  }
}

function importFile(fileHash: string): ImportFileInput {
  return {
    id: `file-${fileHash}`,
    userId: "user-1",
    portfolioId: "portfolio-1",
    brokerAccountId: "broker-1",
    fileName: "xtb-sample-anonymized.xlsx",
    fileHash,
    storagePath: `user-1/portfolio-1/broker-1/${fileHash}.xlsx`,
    storageBucket: "broker-reports",
    meta: {
      accountNumber: null,
      accountCurrency: null,
      reportStartDate: null,
      reportEndDate: null,
      snapshotAt: null,
      balance: null,
      equity: null,
      margin: null,
      freeMargin: null,
      marginLevel: null,
    },
  };
}

function workbookWithoutFirstCashRow(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const sheetName = "CASH OPERATION HISTORY";
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  });
  workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet([
    ...rows.slice(0, 12),
    ...rows.slice(13),
  ]);
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

function workbookWithCorrectedCashAmount(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const sheetName = "CASH OPERATION HISTORY";
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  });
  rows[12][6] = 501;
  workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rows);
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("XTB import engine", () => {
  it("dry-runs without a repository write", () => {
    const result = dryRunXtbImport(fs.readFileSync(fixturePath), {
      brokerAccountId: "broker-1",
    });

    expect(result.importedFileId).toBeNull();
    expect(result.stats.status).toBe("dry_run");
    expect(result.stats.parsedRows).toBeGreaterThan(400);
  });

  it("ignores duplicate rows on repeated import", async () => {
    const buffer = fs.readFileSync(fixturePath);
    const repository = new MemoryImportRepository();
    const first = await commitXtbImport({
      buffer,
      file: importFile("same"),
      repository,
    });
    const second = await commitXtbImport({
      buffer,
      file: importFile("same"),
      repository,
    });

    expect(first.stats.newRows).toBeGreaterThan(400);
    expect(second.stats.newRows).toBe(0);
    expect(second.stats.duplicatesIgnored).toBe(first.stats.parsedRows);
    expect(repository.recomputeCalls).toBe(2);
  });

  it("repairs duplicate raw rows that are missing normalized records", async () => {
    const buffer = fs.readFileSync(fixturePath);
    const repository = new MemoryImportRepository();
    const first = await commitXtbImport({
      buffer,
      file: importFile("same"),
      repository,
    });

    repository.transactions.clear();
    repository.lots.clear();
    repository.cash.clear();

    const second = await commitXtbImport({
      buffer,
      file: importFile("same"),
      repository,
    });

    expect(second.stats.newRows).toBe(0);
    expect(second.stats.duplicatesIgnored).toBe(first.stats.parsedRows);
    expect(repository.transactions.size).toBeGreaterThan(400);
    expect(repository.cash.size).toBeGreaterThan(300);
    expect(repository.lots.size).toBeGreaterThan(50);
  });

  it("inserts missing historical rows from overlapping later imports", async () => {
    const buffer = fs.readFileSync(fixturePath);
    const repository = new MemoryImportRepository();
    const partial = workbookWithoutFirstCashRow(buffer);
    const first = await commitXtbImport({
      buffer: partial,
      file: importFile("partial"),
      repository,
    });
    const second = await commitXtbImport({
      buffer,
      file: importFile("full"),
      repository,
    });

    expect(first.stats.newRows).toBeGreaterThan(400);
    expect(second.stats.newRows).toBe(1);
    expect(second.stats.duplicatesIgnored).toBeGreaterThan(400);
  });

  it("detects corrected rows by fingerprint and changed full-row hash", async () => {
    const buffer = fs.readFileSync(fixturePath);
    const repository = new MemoryImportRepository();
    await commitXtbImport({ buffer, file: importFile("base"), repository });
    const corrected = await commitXtbImport({
      buffer: workbookWithCorrectedCashAmount(buffer),
      file: importFile("corrected"),
      repository,
    });

    expect(corrected.stats.correctedRows).toBe(1);
    expect(corrected.stats.newRows).toBe(0);
  });

  it("rolls back partial writes when a committed import fails", async () => {
    const buffer = fs.readFileSync(fixturePath);
    const repository = new MemoryImportRepository();
    repository.failAfterTransactionWrites = 10;

    await expect(
      commitXtbImport({
        buffer,
        file: importFile("rollback"),
        repository,
      })
    ).rejects.toThrow("Simulated import failure");

    expect(repository.rawRows.size).toBe(0);
    expect(repository.transactions.size).toBe(0);
    expect(repository.cash.size).toBe(0);
    expect(repository.lots.size).toBe(0);
    expect(repository.recomputeCalls).toBe(0);
  });
});
