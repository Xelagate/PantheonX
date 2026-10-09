// Funding comparison Pacifica vs Binance, both as % per 8h (same normalisation as perps_lens.py funding()). No DOM.
// prices: Pacifica info/prices (hourly `funding`); premium: Binance premiumIndex; info: Binance fundingInfo (missing = 8h).
export function fundingRows({ prices, premium, info, top = 10 }) {
  const bnRate = new Map(premium.map(b => [b.symbol, +b.lastFundingRate]));
  const bnHours = new Map(info.map(b => [b.symbol, +b.fundingIntervalHours]));
  return prices.filter(p => bnRate.has(p.symbol + "USDT"))
    .sort((a, b) => b.volume_24h - a.volume_24h).slice(0, top)
    .map(p => {
      const sym = p.symbol + "USDT", pac = +p.funding * 8 * 100, bn = bnRate.get(sym) / (bnHours.get(sym) || 8) * 8 * 100;
      const spread = pac - bn;
      return { coin: p.symbol, pac, bn, spread, apr: Math.abs(spread) * 3 * 365,
        cheaperLong: Math.abs(spread) < 1e-4 ? null : pac < bn ? "pacifica" : "binance" };
    })
    .filter(r => Number.isFinite(r.spread))
    .sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread));
}
