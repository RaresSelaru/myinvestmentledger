import type { CurrencyCode } from "@/lib/types";

export function formatCurrency(value: number, currency: CurrencyCode) {
  const sign = value < 0 ? "-" : "";
  const amount = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.abs(value));

  return `${sign}${amount} ${currency || "RON"}`;
}

export function formatMoneyPrecise(value: number, currency: CurrencyCode) {
  const sign = value < 0 ? "-" : "";
  const amount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  return `${sign}${amount} ${currency || "RON"}`;
}

export function formatPercent(value: number, options?: { signed?: boolean }) {
  const sign = options?.signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

export function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
