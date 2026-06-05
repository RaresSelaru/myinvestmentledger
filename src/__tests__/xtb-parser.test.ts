import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseXtbWorkbook, normalizeCashOperationType, parseDate, parseNumber } from "@/lib/import/xtb-parser";

const fixturePath = path.join(
  process.cwd(),
  "src/__tests__/fixtures/xtb-sample-anonymized.xlsx"
);

describe("XTB workbook parser", () => {
  it("detects known XTB sheets and parses metadata", () => {
    const parsed = parseXtbWorkbook(fs.readFileSync(fixturePath), {
      brokerAccountId: "broker-1",
    });

    expect(parsed.stats.sheetsDetected.closed_positions).toBe("CLOSED POSITION HISTORY");
    expect(parsed.stats.sheetsDetected.open_positions).toBe("OPEN POSITION 04062026");
    expect(parsed.stats.sheetsDetected.cash_operations).toBe("CASH OPERATION HISTORY");
    expect(parsed.meta.accountNumber).toBe("00000000");
    expect(parsed.meta.accountCurrency).toBe("RON");
    expect(parsed.meta.reportStartDate).toBe("2025-05-04");
    expect(parsed.meta.reportEndDate).toBe("2026-06-04");
  });

  it("normalizes open positions, closed positions, and cash operations", () => {
    const parsed = parseXtbWorkbook(fs.readFileSync(fixturePath), {
      brokerAccountId: "broker-1",
    });

    expect(parsed.stats.positionLots).toBeGreaterThan(40);
    expect(parsed.stats.cashOperations).toBeGreaterThan(300);
    expect(parsed.stats.transactions).toBeGreaterThan(400);

    const firstOpen = parsed.rows.find((row) => row.kind === "open_positions");
    const firstCash = parsed.rows.find((row) => row.kind === "cash_operations");
    const firstClosed = parsed.rows.find((row) => row.kind === "closed_positions");

    expect(firstOpen?.positionLot?.symbol).toBe("LEU.US");
    expect(firstOpen?.positionLot?.currency).toBe("USD");
    expect(firstOpen?.positionLot?.sourceFingerprint).toContain("xtb:broker-1:position:");
    expect(firstCash?.cashOperation?.normalizedType).toBe("tax");
    expect(firstCash?.sourceFingerprint).toContain("xtb:broker-1:cash:");
    expect(firstClosed?.transaction?.type).toBe("sell");
    expect(firstClosed?.transaction?.realizedPl).not.toBeNull();
  });

  it("handles localized numbers, dates, and XTB operation labels", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("1,234.56")).toBe(1234.56);
    expect(parseDate("04/06/2026")?.slice(0, 10)).toBe("2026-06-04");
    expect(normalizeCashOperationType("DIVIDENT")).toBe("dividend");
    expect(normalizeCashOperationType("Free-funds Interest")).toBe("interest");
    expect(normalizeCashOperationType("transfer")).toBe("internal_transfer");
  });
});
