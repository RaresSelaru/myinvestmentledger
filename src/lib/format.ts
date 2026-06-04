import type { CurrencyCode } from "@/lib/types";

export function formatCurrency(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "RON",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMoneyPrecise(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "RON",
    maximumFractionDigits: 2,
  }).format(value);
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
