import { normalizeMarketSymbol, providerSymbolCandidates } from "@/lib/market-data/symbols";
import type { CurrencyCode, MarketDataProviderName } from "@/lib/types";

export type SymbolMapping = {
  id?: string;
  internalSymbol: string;
  provider: MarketDataProviderName | string;
  providerSymbol: string;
  exchange: string | null;
  currency: CurrencyCode | null;
  assetType: string | null;
  verified: boolean;
};

export type ResolvedSymbol = {
  internalSymbol: string;
  provider: MarketDataProviderName | string;
  providerSymbol: string;
  exchange: string | null;
  currency: CurrencyCode | null;
  assetType: string | null;
  verified: boolean;
  source: "mapping" | "alias";
  candidates: string[];
};

export function mapSymbolMapping(row: Record<string, unknown>): SymbolMapping {
  return {
    id: row.id ? String(row.id) : undefined,
    internalSymbol: normalizeMarketSymbol(String(row.internal_symbol ?? "")),
    provider: String(row.provider ?? "auto"),
    providerSymbol: normalizeMarketSymbol(String(row.provider_symbol ?? "")),
    exchange: row.exchange ? String(row.exchange) : null,
    currency: row.currency ? String(row.currency) : null,
    assetType: row.asset_type ? String(row.asset_type) : null,
    verified: Boolean(row.verified),
  };
}

export function resolveProviderSymbol({
  internalSymbol,
  provider,
  mappings = [],
}: {
  internalSymbol: string;
  provider: MarketDataProviderName | string;
  mappings?: SymbolMapping[];
}): ResolvedSymbol {
  const normalized = normalizeMarketSymbol(internalSymbol);
  const matchingMapping = mappings.find(
    (mapping) =>
      normalizeMarketSymbol(mapping.internalSymbol) === normalized &&
      mapping.provider === provider &&
      mapping.providerSymbol
  );
  const candidates = providerSymbolCandidates(normalized);

  if (matchingMapping) {
    return {
      internalSymbol: normalized,
      provider,
      providerSymbol: matchingMapping.providerSymbol,
      exchange: matchingMapping.exchange,
      currency: matchingMapping.currency,
      assetType: matchingMapping.assetType,
      verified: matchingMapping.verified,
      source: "mapping",
      candidates,
    };
  }

  return {
    internalSymbol: normalized,
    provider,
    providerSymbol: candidates.at(-1) ?? normalized,
    exchange: null,
    currency: null,
    assetType: null,
    verified: false,
    source: "alias",
    candidates,
  };
}
