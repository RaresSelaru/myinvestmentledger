export function normalizeMarketSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function providerSymbolCandidates(symbol: string) {
  const normalized = normalizeMarketSymbol(symbol);
  const candidates = [normalized];

  if (normalized.endsWith(".US")) {
    candidates.push(normalized.slice(0, -3));
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}
