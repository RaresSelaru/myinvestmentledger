import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  commitXtbImport,
  dryRunXtbImport,
  type ImportFileInput,
  type ImportRepository,
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
  rawRows = new Map<string, StoredRawRow>();
  transactions = new Map<string, Transaction>();
  lots = new Map<string, PositionLot>();
  cash = new Map<string, CashOperation>();
  recomputeCalls = 0;

  async upsertImportedFile(input: ImportFileInput) {
    const key = `${input.userId}:${input.brokerAccountId}:${input.fileHash}`;
    const existing = this.importedFiles.get(key);

    if (existing) return existing;

    this.importedFiles.set(key, input.id);
    return input.id;
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
});
