// Binance USDT-M futures REST: HMAC request signing, a small client, and the venue adapter. No DOM; browser and node.
export const BASES = { demo: "https://demo-fapi.binance.com", mainnet: "https://fapi.binance.com" };

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const hmacKey = secret => crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const hmac = async (key, query) => hex(await crypto.subtle.sign("HMAC", key, enc.encode(query)));

export async function sign(query, secret) { return hmac(await hmacKey(secret), query); }

export function binance({ base, key, secret, fetch = globalThis.fetch }) {
  let offset = 0, keyP;
  async function call(method, path, params = {}, signed = true) {
    let query = new URLSearchParams(params).toString();
    const headers = {};
    if (signed) {
      query += `${query && "&"}recvWindow=5000&timestamp=${Date.now() + offset}`;
      query += `&signature=${await hmac(await (keyP ??= hmacKey(secret)), query)}`;
      headers["X-MBX-APIKEY"] = key;
    }
    const r = await fetch(`${base}${path}${query && "?" + query}`, { method, headers, signal: AbortSignal.timeout(10000) });
    const body = await r.json().catch(() => undefined);
    if (!r.ok) throw Object.assign(new Error(body?.msg || `HTTP ${r.status}`), { code: body?.code ?? r.status, status: r.status });
    if (body === undefined) throw Object.assign(new Error("Неожиданный ответ биржи"), { code: "bad-response" });
    return body;
  }
  return {
    async syncTime() { offset = (await call("GET", "/fapi/v1/time", {}, false)).serverTime - Date.now(); },
    exchangeInfo: () => call("GET", "/fapi/v1/exchangeInfo", {}, false),
    premiumIndex: () => call("GET", "/fapi/v1/premiumIndex", {}, false),
    fundingInfo: () => call("GET", "/fapi/v1/fundingInfo", {}, false),
    async balance() {
      const usdt = (await call("GET", "/fapi/v3/balance")).find(b => b.asset === "USDT");
      return { wallet: +(usdt?.balance ?? 0), available: +(usdt?.availableBalance ?? 0) };
    },
    async positions() { return (await call("GET", "/fapi/v3/positionRisk")).filter(p => +p.positionAmt !== 0); },
    marketOrder: (symbol, side, quantity, reduceOnly = false) => call("POST", "/fapi/v1/order",
      { symbol, side, type: "MARKET", quantity, ...(reduceOnly && { reduceOnly: "true" }), newOrderRespType: "RESULT" }),
  };
}

// Venue adapter: the shape index.html renders for every exchange (coins, not symbols; "long"/"short").
export async function binanceVenue(client, net) {
  await client.syncTime();
  const lots = {}, coinOf = {};
  for (const s of (await client.exchangeInfo()).symbols) {
    if (s.status !== "TRADING" || s.contractType !== "PERPETUAL" || s.quoteAsset !== "USDT") continue;
    const f = t => s.filters.find(x => x.filterType === t);
    const lot = f("MARKET_LOT_SIZE") || f("LOT_SIZE");
    lots[s.baseAsset] = { symbol: s.symbol, step: lot.stepSize, min: lot.minQty, minNotional: +(f("MIN_NOTIONAL")?.notional ?? 0) };
    coinOf[s.symbol] = s.baseAsset;
  }
  return {
    id: "binance", net, canTrade: net === "mainnet",
    async markets() {
      const mark = Object.fromEntries((await client.premiumIndex()).map(p => [p.symbol, +p.markPrice]));
      return Object.entries(lots).filter(([, l]) => mark[l.symbol])
        .map(([coin, { symbol, ...l }]) => ({ coin, mark: mark[symbol], ...l }));
    },
    balance: () => client.balance(),
    async positions() {
      return (await client.positions()).map(p => ({ coin: coinOf[p.symbol] ?? p.symbol, side: +p.positionAmt > 0 ? "long" : "short",
        size: p.positionAmt.replace("-", ""), entry: +p.entryPrice, mark: +p.markPrice, upnl: +p.unRealizedProfit }));
    },
    async marketOrder(coin, side, size, reduceOnly) {
      const o = await client.marketOrder(lots[coin].symbol, side === "long" ? "BUY" : "SELL", size, reduceOnly);
      return { status: o.status, filled: o.executedQty, avgPrice: +o.avgPrice || null, id: o.orderId };
    },
  };
}
