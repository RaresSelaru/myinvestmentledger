import crypto from "node:crypto";
import * as XLSX from "xlsx";
import type {
  CashOperation,
  CurrencyCode,
  PositionLot,
  SourceReference,
  Transaction,
  TransactionType,
} from "@/lib/types";

export type XtbSheetKind = "closed_positions" | "open_positions" | "pending_orders" | "cash_operations";

export type XtbImportStats = {
  parsedRows: number;
  rawRows: number;
  positionLots: number;
  cashOperations: number;
  transactions: number;
  sheetsDetected: Partial<Record<XtbSheetKind, string>>;
};

export type XtbWorkbookMeta = {
  accountNumber: string | null;
  accountCurrency: CurrencyCode | null;
  reportStartDate: string | null;
  reportEndDate: string | null;
  snapshotAt: string | null;
  balance: number | null;
  equity: number | null;
  margin: number | null;
  freeMargin: number | null;
  marginLevel: number | null;
};

export type ParsedXtbRow = {
  kind: XtbSheetKind;
  sheetName: string;
  rowNumber: number;
  rawJson: Record<string, unknown>;
  sourceFingerprint: string;
  fullRowHash: string;
  transaction: Omit<Transaction, "id" | "portfolioId" | "brokerAccountId"> | null;
  positionLot: Omit<PositionLot, "id" | "portfolioId" | "brokerAccountId"> | null;
  cashOperation: Omit<CashOperation, "id" | "portfolioId" | "brokerAccountId"> | null;
};

export type ParsedXtbWorkbook = {
  meta: XtbWorkbookMeta;
  rows: ParsedXtbRow[];
  stats: XtbImportStats;
};

type ParseOptions = {
  brokerAccountId: string;
  accountCurrency?: CurrencyCode | null;
};

type HeaderMap = Map<string, number>;

const DATE_RANGE_PATTERN = /(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/;

const HEADER_ALIASES: Record<string, string> = {
  id: "id",
  position: "position",
  pozitie: "position",
  symbol: "symbol",
  simbol: "symbol",
  type: "type",
  tip: "type",
  volume: "volume",
  volum: "volume",
  "open time": "openTime",
  "timp deschidere": "openTime",
  "open price": "openPrice",
  "pret deschidere": "openPrice",
  "market price": "marketPrice",
  "pret piata": "marketPrice",
  "close time": "closeTime",
  "timp inchidere": "closeTime",
  "close price": "closePrice",
  "pret inchidere": "closePrice",
  "open origin": "openOrigin",
  "close origin": "closeOrigin",
  "purchase value": "purchaseValue",
  "valoare cumparare": "purchaseValue",
  "sale value": "saleValue",
  "valoare vanzare": "saleValue",
  sl: "sl",
  tp: "tp",
  margin: "margin",
  commission: "commission",
  comision: "commission",
  swap: "swap",
  rollover: "rollover",
  "gross p/l": "grossPl",
  "gross pl": "grossPl",
  "profit brut": "grossPl",
  comment: "comment",
  comentariu: "comment",
  time: "time",
  timp: "time",
  amount: "amount",
  suma: "amount",
  price: "price",
  nominalvalue: "nominalValue",
  "nominal value": "nominalValue",
  order: "order",
  side: "side",
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

export function hashStable(value: unknown) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function normalizeLabel(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function labelKey(value: unknown) {
  return normalizeLabel(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/ ]/g, "")
    .trim();
}

function canonicalHeader(value: unknown) {
  const key = labelKey(value);
  return HEADER_ALIASES[key] ?? HEADER_ALIASES[key.replace(/\s+/g, "")] ?? null;
}

function jsonValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === undefined || value === "") {
    return null;
  }

  return value;
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const raw = String(value).trim().replace(/\s/g, "");

  if (!raw || raw.toLowerCase() === "none") {
    return null;
  }

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  const normalized =
    hasComma && hasDot
      ? raw.lastIndexOf(",") > raw.lastIndexOf(".")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "")
      : raw.replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseExcelDateNumber(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);

  if (!parsed) {
    return null;
  }

  return new Date(
    Date.UTC(
      parsed.y,
      parsed.m - 1,
      parsed.d,
      parsed.H ?? 0,
      parsed.M ?? 0,
      Math.floor(parsed.S ?? 0)
    )
  ).toISOString();
}

export function parseDate(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    return parseExcelDateNumber(value);
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const raw = String(value).trim();
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);

  if (dmy) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = dmy;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      )
    ).toISOString();
  }

  const direct = new Date(raw);

  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }

  return null;
}

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function stableDate(value: unknown) {
  const parsed = parseDate(value);

  if (!parsed) {
    return null;
  }

  const date = new Date(parsed);
  date.setUTCMilliseconds(0);
  return date.toISOString();
}

function normalizeSymbol(value: unknown) {
  const symbol = String(value ?? "").trim().toUpperCase();
  return symbol && symbol !== "NONE" ? symbol : null;
}

function detectSheetKind(sheetName: string): XtbSheetKind | null {
  const key = labelKey(sheetName);

  if (key.includes("cash") || key.includes("operation") || key.includes("numerar")) {
    return "cash_operations";
  }

  if (key.includes("pending") || key.includes("orders") || key.includes("ordin")) {
    return "pending_orders";
  }

  if (key.includes("closed") || key.includes("inchis")) {
    return "closed_positions";
  }

  if (key.includes("open") || key.includes("deschis")) {
    return "open_positions";
  }

  return null;
}

function findHeaderRow(rows: unknown[][], kind: XtbSheetKind) {
  return rows.findIndex((row) => {
    const labels = row.map(canonicalHeader).filter(Boolean);
    const set = new Set(labels);

    if (kind === "cash_operations") {
      return set.has("id") && set.has("type") && set.has("time") && set.has("amount");
    }

    if (kind === "pending_orders") {
      return set.has("id") && set.has("symbol") && set.has("price");
    }

    return set.has("position") && set.has("symbol") && set.has("volume");
  });
}

function buildHeaderMap(headerRow: unknown[]) {
  const map: HeaderMap = new Map();

  headerRow.forEach((header, index) => {
    const canonical = canonicalHeader(header);

    if (canonical && !map.has(canonical)) {
      map.set(canonical, index);
    }
  });

  return map;
}

function read(row: unknown[], headers: HeaderMap, key: string) {
  const index = headers.get(key);
  return index === undefined ? null : row[index];
}

function isMeaningfulRow(row: unknown[], headers: HeaderMap) {
  const id = read(row, headers, "id") ?? read(row, headers, "position");

  if (String(id ?? "").trim().toLowerCase() === "total") {
    return false;
  }

  return row.some((value) => {
    const normalized = normalizeLabel(value);
    return normalized && normalized !== "none";
  });
}

function rawRowJson(
  sheetName: string,
  rowNumber: number,
  headerRow: unknown[],
  row: unknown[]
) {
  const raw: Record<string, unknown> = {
    __sheetName: sheetName,
    __rowNumber: rowNumber,
  };

  headerRow.forEach((header, index) => {
    const label = String(header ?? `column_${index + 1}`).trim() || `column_${index + 1}`;
    raw[label] = jsonValue(row[index]);
  });

  return raw;
}

function normalizedValueForHash(header: unknown, value: unknown) {
  const canonical = canonicalHeader(header);

  if (
    canonical === "openTime" ||
    canonical === "closeTime" ||
    canonical === "time"
  ) {
    return stableDate(value);
  }

  if (
    canonical === "volume" ||
    canonical === "openPrice" ||
    canonical === "closePrice" ||
    canonical === "marketPrice" ||
    canonical === "purchaseValue" ||
    canonical === "saleValue" ||
    canonical === "commission" ||
    canonical === "swap" ||
    canonical === "rollover" ||
    canonical === "grossPl" ||
    canonical === "amount" ||
    canonical === "price" ||
    canonical === "margin" ||
    canonical === "nominalValue"
  ) {
    return parseNumber(value);
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).trim();
}

function normalizedRowForHash(
  sheetName: string,
  headerRow: unknown[],
  row: unknown[]
) {
  const normalized: Record<string, unknown> = {
    __sheetName: sheetName,
  };

  headerRow.forEach((header, index) => {
    const label = String(header ?? `column_${index + 1}`).trim() || `column_${index + 1}`;
    normalized[label] = normalizedValueForHash(header, row[index]);
  });

  return normalized;
}

function fingerprintFromParts(parts: Array<unknown>) {
  return parts.map((part) => String(part ?? "").trim().toLowerCase()).join(":");
}

function parseReportDateRange(rows: unknown[][]) {
  for (const row of rows.slice(0, 16)) {
    for (const cell of row) {
      const raw = String(cell ?? "");
      const match = raw.match(DATE_RANGE_PATTERN);

      if (match) {
        return {
          start: dateOnly(parseDate(match[1])),
          end: dateOnly(parseDate(match[2])),
        };
      }
    }
  }

  return { start: null, end: null };
}

function valueUnderLabel(rows: unknown[][], label: string) {
  const wanted = labelKey(label);

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 12); rowIndex += 1) {
    for (let colIndex = 0; colIndex < rows[rowIndex].length; colIndex += 1) {
      if (labelKey(rows[rowIndex][colIndex]) === wanted) {
        return rows[rowIndex + 1]?.[colIndex] ?? null;
      }
    }
  }

  return null;
}

function parseMetaFromSheet(rows: unknown[][]): Partial<XtbWorkbookMeta> {
  const dateRange = parseReportDateRange(rows);
  const snapshotAt =
    rows
      .slice(0, 12)
      .flat()
      .map(parseDate)
      .find(Boolean) ?? null;

  return {
    accountNumber: valueUnderLabel(rows, "Account")?.toString() ?? null,
    accountCurrency: valueUnderLabel(rows, "Currency")?.toString() ?? null,
    balance: parseNumber(valueUnderLabel(rows, "Balance")),
    equity: parseNumber(valueUnderLabel(rows, "Equity")),
    margin: parseNumber(valueUnderLabel(rows, "Margin")),
    freeMargin: parseNumber(valueUnderLabel(rows, "Free margin")),
    marginLevel: parseNumber(valueUnderLabel(rows, "Margin level")),
    reportStartDate: dateRange.start,
    reportEndDate: dateRange.end,
    snapshotAt,
  };
}

export function normalizeCashOperationType(value: unknown): TransactionType {
  const type = normalizeLabel(value);

  if (type.includes("deposit")) return "deposit";
  if (type.includes("withdraw")) return "withdrawal";
  if (type.includes("transfer")) return "internal_transfer";
  if (type.includes("stock purchase")) return "buy";
  if (type.includes("stock sale") || type.includes("close trade")) return "sell";
  if (type.includes("divident") || type.includes("dividend")) return "dividend";
  if (type.includes("interest")) return "interest";
  if (type.includes("withholding") || type.includes("tax")) return "tax";
  if (type.includes("commission")) return "fee";
  if (type.includes("correction") || type.includes("fractional")) return "adjustment";

  return "adjustment";
}

function parseTradeComment(comment: unknown) {
  const raw = String(comment ?? "");
  const match = raw.match(/\b(?:OPEN|CLOSE)?\s*(?:BUY|SELL)?\s*([0-9.,]+)\s*@\s*([0-9.,]+)/i);

  return {
    quantity: match ? parseNumber(match[1]) : null,
    price: match ? parseNumber(match[2]) : null,
  };
}

function referenceFor(row: Pick<ParsedXtbRow, "sheetName" | "rowNumber" | "sourceFingerprint">): SourceReference {
  return {
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
    sourceFingerprint: row.sourceFingerprint,
  };
}

function normalizeCashRow(
  row: unknown[],
  headers: HeaderMap,
  base: Omit<ParsedXtbRow, "transaction" | "positionLot" | "cashOperation">,
  accountCurrency: CurrencyCode
): ParsedXtbRow {
  const operationType = String(read(row, headers, "type") ?? "");
  const normalizedType = normalizeCashOperationType(operationType);
  const amount = parseNumber(read(row, headers, "amount")) ?? 0;
  const occurredAt = parseDate(read(row, headers, "time")) ?? new Date(0).toISOString();
  const description = String(read(row, headers, "comment") ?? "").trim() || null;
  const symbol = normalizeSymbol(read(row, headers, "symbol"));
  const parsedTrade = parseTradeComment(description);
  const sourceReference = referenceFor(base);
  const cashOperation = {
    operationType,
    normalizedType,
    amount,
    currency: accountCurrency,
    occurredAt,
    description,
    symbol,
    sourceFingerprint: base.sourceFingerprint,
    sourceReference,
  } satisfies Omit<CashOperation, "id" | "portfolioId" | "brokerAccountId">;
  const transaction = {
    date: occurredAt,
    type: normalizedType,
    symbol,
    quantity: parsedTrade.quantity,
    price: parsedTrade.price,
    amount,
    currency: accountCurrency,
    source: "xtb_import",
    comment: description,
    isReconciled: false,
    reconciledWithTransactionId: null,
    sourceFingerprint: base.sourceFingerprint,
    sourceReference,
    realizedPl: null,
  } satisfies Omit<Transaction, "id" | "portfolioId" | "brokerAccountId">;

  return { ...base, transaction, positionLot: null, cashOperation };
}

function normalizeOpenPositionRow(
  row: unknown[],
  headers: HeaderMap,
  base: Omit<ParsedXtbRow, "transaction" | "positionLot" | "cashOperation">,
  accountCurrency: CurrencyCode
): ParsedXtbRow {
  const symbol = normalizeSymbol(read(row, headers, "symbol")) ?? "";
  const quantity = parseNumber(read(row, headers, "volume")) ?? 0;
  const openPrice = parseNumber(read(row, headers, "openPrice")) ?? 0;
  const currentPrice = parseNumber(read(row, headers, "marketPrice"));
  const costBasis = parseNumber(read(row, headers, "purchaseValue")) ?? quantity * openPrice;
  const unrealizedPl = parseNumber(read(row, headers, "grossPl"));
  const marketValue = unrealizedPl === null ? costBasis : costBasis + unrealizedPl;
  const openedAt = parseDate(read(row, headers, "openTime"));
  const side = normalizeLabel(read(row, headers, "type")) === "sell" ? "sell" : "buy";
  const sourceReference = referenceFor(base);
  const positionLot = {
    symbol,
    side,
    quantity,
    openPrice,
    currentPrice,
    costBasis,
    marketValue,
    unrealizedPl,
    currency: accountCurrency,
    openedAt,
    sourceFingerprint: base.sourceFingerprint,
    sourceReference,
  } satisfies Omit<PositionLot, "id" | "portfolioId" | "brokerAccountId">;
  return { ...base, transaction: null, positionLot, cashOperation: null };
}

function normalizeClosedPositionRow(
  row: unknown[],
  headers: HeaderMap,
  base: Omit<ParsedXtbRow, "transaction" | "positionLot" | "cashOperation">,
  accountCurrency: CurrencyCode
): ParsedXtbRow {
  const symbol = normalizeSymbol(read(row, headers, "symbol"));
  const quantity = parseNumber(read(row, headers, "volume"));
  const closePrice = parseNumber(read(row, headers, "closePrice"));
  const saleValue = parseNumber(read(row, headers, "saleValue")) ?? 0;
  const closeTime = parseDate(read(row, headers, "closeTime")) ?? new Date(0).toISOString();
  const grossPl = parseNumber(read(row, headers, "grossPl"));
  const sourceReference = referenceFor(base);
  const transaction = {
    date: closeTime,
    type: "sell",
    symbol,
    quantity,
    price: closePrice,
    amount: saleValue,
    currency: accountCurrency,
    source: "xtb_import",
    comment: grossPl === null ? "Closed position" : `Closed position. Gross P/L ${grossPl}`,
    isReconciled: false,
    reconciledWithTransactionId: null,
    sourceFingerprint: base.sourceFingerprint,
    sourceReference,
    realizedPl: grossPl,
  } satisfies Omit<Transaction, "id" | "portfolioId" | "brokerAccountId">;

  return { ...base, transaction, positionLot: null, cashOperation: null };
}

function fingerprintForRow(
  kind: XtbSheetKind,
  brokerAccountId: string,
  row: unknown[],
  headers: HeaderMap
) {
  const brokerId = read(row, headers, "id") ?? read(row, headers, "position");

  if (brokerId !== null && brokerId !== undefined && String(brokerId).trim() && String(brokerId).toLowerCase() !== "none") {
    const scope =
      kind === "cash_operations"
        ? "cash"
        : kind === "pending_orders"
          ? "order"
          : "position";
    const rowDiscriminator =
      kind === "closed_positions"
        ? [
            stableDate(read(row, headers, "closeTime")),
            parseNumber(read(row, headers, "volume")),
            parseNumber(read(row, headers, "saleValue")),
          ]
        : [];

    return fingerprintFromParts([
      "xtb",
      brokerAccountId,
      scope,
      brokerId,
      kind,
      ...rowDiscriminator,
    ]);
  }

  return fingerprintFromParts([
    "xtb",
    brokerAccountId,
    kind,
    stableDate(read(row, headers, "time") ?? read(row, headers, "openTime") ?? read(row, headers, "closeTime")),
    read(row, headers, "symbol"),
    read(row, headers, "type"),
    parseNumber(read(row, headers, "volume")),
    parseNumber(read(row, headers, "price") ?? read(row, headers, "openPrice") ?? read(row, headers, "closePrice")),
    parseNumber(read(row, headers, "amount") ?? read(row, headers, "purchaseValue") ?? read(row, headers, "saleValue")),
  ]);
}

export function parseXtbWorkbook(buffer: Buffer, options: ParseOptions): ParsedXtbWorkbook {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: true,
    dense: false,
  });
  const rows: ParsedXtbRow[] = [];
  const sheetsDetected: Partial<Record<XtbSheetKind, string>> = {};
  let meta: XtbWorkbookMeta = {
    accountNumber: null,
    accountCurrency: options.accountCurrency ?? null,
    reportStartDate: null,
    reportEndDate: null,
    snapshotAt: null,
    balance: null,
    equity: null,
    margin: null,
    freeMargin: null,
    marginLevel: null,
  };

  for (const sheetName of workbook.SheetNames) {
    const kind = detectSheetKind(sheetName);

    if (!kind) {
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    const sheetMeta = parseMetaFromSheet(matrix);
    meta = {
      ...meta,
      accountNumber: meta.accountNumber ?? sheetMeta.accountNumber ?? null,
      accountCurrency: options.accountCurrency ?? meta.accountCurrency ?? sheetMeta.accountCurrency ?? null,
      reportStartDate: meta.reportStartDate ?? sheetMeta.reportStartDate ?? null,
      reportEndDate: meta.reportEndDate ?? sheetMeta.reportEndDate ?? null,
      snapshotAt: meta.snapshotAt ?? sheetMeta.snapshotAt ?? null,
      balance: meta.balance ?? sheetMeta.balance ?? null,
      equity: meta.equity ?? sheetMeta.equity ?? null,
      margin: meta.margin ?? sheetMeta.margin ?? null,
      freeMargin: meta.freeMargin ?? sheetMeta.freeMargin ?? null,
      marginLevel: meta.marginLevel ?? sheetMeta.marginLevel ?? null,
    };

    const headerRowIndex = findHeaderRow(matrix, kind);

    if (headerRowIndex < 0) {
      continue;
    }

    sheetsDetected[kind] = sheetName;
    const headerRow = matrix[headerRowIndex];
    const headers = buildHeaderMap(headerRow);
    const accountCurrency = options.accountCurrency ?? meta.accountCurrency ?? "RON";

    for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex];

      if (!isMeaningfulRow(row, headers)) {
        continue;
      }

      const rowNumber = rowIndex + 1;
      const rawJson = rawRowJson(sheetName, rowNumber, headerRow, row);
      const normalizedHashJson = normalizedRowForHash(sheetName, headerRow, row);
      const sourceFingerprint = fingerprintForRow(kind, options.brokerAccountId, row, headers);
      const base = {
        kind,
        sheetName,
        rowNumber,
        rawJson,
        sourceFingerprint,
        fullRowHash: hashStable({ kind, rawJson: normalizedHashJson }),
      };

      if (kind === "cash_operations") {
        rows.push(normalizeCashRow(row, headers, base, accountCurrency));
      } else if (kind === "open_positions") {
        rows.push(normalizeOpenPositionRow(row, headers, base, accountCurrency));
      } else if (kind === "closed_positions") {
        rows.push(normalizeClosedPositionRow(row, headers, base, accountCurrency));
      }
    }
  }

  return {
    meta,
    rows,
    stats: {
      parsedRows: rows.length,
      rawRows: rows.length,
      positionLots: rows.filter((row) => row.positionLot).length,
      cashOperations: rows.filter((row) => row.cashOperation).length,
      transactions: rows.filter((row) => row.transaction).length,
      sheetsDetected,
    },
  };
}
