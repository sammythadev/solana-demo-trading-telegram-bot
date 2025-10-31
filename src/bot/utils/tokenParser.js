export function parseDexData(data) {
  if (!data || typeof data !== 'object') return null;

  // helper to safely access nested properties
  const firstPair = Array.isArray(data.pairs) && data.pairs.length ? data.pairs[0] : null;
  const baseToken = firstPair && firstPair.baseToken ? firstPair.baseToken : data.baseToken || data.token || {};

  const sanitizeNumStr = (s) => {
    if (s === null || s === undefined) return null;
    if (typeof s === 'number') return s;
    if (typeof s === 'object') return null;
    // sanitize strings like "$1,234.56", "1,234", "0.0001494", "+12.3%"
    if (typeof s === 'string') {
      const cleaned = s.replace(/[^0-9eE+\-\.]/g, '');
      if (cleaned === '' || cleaned === '.' || cleaned === '-' ) return null;
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    const cleaned = String(s).replace(/[^0-9.-]+/g, '');
    if (cleaned === '' || cleaned === '.' || cleaned === '-' ) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const priceUsd = sanitizeNumStr(
    data.priceUsd ??
    (firstPair && firstPair.priceUsd) ??
    baseToken.priceUsd ??
    (firstPair && firstPair.price) ??
    (data.token && data.token.priceUsd) ??
    null
  );

  const liquidityUsd = sanitizeNumStr(
    (data.liquidity && (data.liquidity.usd ?? data.liquidityUsd)) ??
    (firstPair && firstPair.liquidity && (firstPair.liquidity.usd ?? firstPair.liquidityUsd)) ??
    data.liquidityUsd ??
    (data.stats && (data.stats.liquidityUsd ?? data.stats.liquidity)) ??
    null
  );

  const fdv = sanitizeNumStr(
    data.fdv ?? data.fdvUsd ?? data.fdv_usd ??
    (data.stats && (data.stats.fdv ?? data.stats.fdvUsd)) ??
    (firstPair && firstPair.fdv) ??
    null
  );

  const change24h = (() => {
    const candidates = [
      data.priceChange,
      data.price_change,
      data.priceChange24h,
      data.price_change_24h,
      (firstPair && firstPair.priceChange),
      (firstPair && firstPair.price_change),
      (data.stats && data.stats.priceChange),
      (data.priceChange && data.priceChange.h24),
      (data.priceChange && data.priceChange['24h']),
      (data.price_change && data.price_change.h24),
      (data.price_change && data.price_change['24h'])
    ];
    for (const c of candidates) {
      if (c === null || c === undefined) continue;
      if (typeof c === 'object') {
        const v = c.h24 ?? c['24h'] ?? c.change ?? c.percent ?? null;
        const n = sanitizeNumStr(v);
        if (n !== null) return n;
      } else {
        // c may be a string like "12.34%" or number
        const n = sanitizeNumStr(c);
        if (n !== null) return n;
      }
    }
    return null;
  })();

  const url = data.url ?? (firstPair && firstPair.url) ?? null;

  const name = baseToken.name ?? data.name ?? null;
  const symbol = baseToken.symbol ?? data.symbol ?? null;

  return {
    name,
    symbol,
    priceUsd,
    liquidityUsd,
    fdv,
    change24h,
    url,
    raw: data
  };
}
