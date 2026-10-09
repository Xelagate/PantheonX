import { test } from "node:test";
import assert from "node:assert/strict";
import { binance, binanceVenue, sign } from "./binance.js";

test("sign matches the Binance docs HMAC vector", async () => {
  assert.equal(
    await sign("symbol=LTCBTC&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559",
      "NhqPtmdSJYdKjVHjA7PZj4Mge3R5YNiP1e3UZjInClVN65XAbvqqM6A7H5fATj0j"),
    "c8db56825ae71d6d79447849e617115f4a920fa2acdcab2b053c4b2838bd6b71");
});

test("marketOrder sends a signed POST with the key header", async () => {
  let req;
  const fetch = async (url, opts) => { req = { url, opts }; return { ok: true, json: async () => ({ orderId: 1 }) }; };
  const bn = binance({ base: "https://x", key: "K", secret: "S", fetch });
  await bn.marketOrder("BTCUSDT", "SELL", "0.001", true);
  const u = new URL(req.url);
  assert.equal(req.opts.method, "POST");
  assert.equal(req.opts.headers["X-MBX-APIKEY"], "K");
  assert.equal(u.origin + u.pathname, "https://x/fapi/v1/order");
  const p = u.searchParams;
  assert.deepEqual([p.get("symbol"), p.get("side"), p.get("type"), p.get("quantity"), p.get("reduceOnly")],
    ["BTCUSDT", "SELL", "MARKET", "0.001", "true"]);
  const unsigned = u.search.slice(1).replace(/&signature=.*$/, "");
  assert.equal(p.get("signature"), await sign(unsigned, "S"));
});

test("errors carry the Binance code, or the HTTP status for a non-JSON body", async () => {
  const json = binance({ base: "https://x", key: "K", secret: "S",
    fetch: async () => ({ ok: false, status: 400, json: async () => ({ code: -2019, msg: "Margin is insufficient." }) }) });
  await assert.rejects(json.positions(), e => e.code === -2019 && e.status === 400 && /Margin/.test(e.message));
  const html = binance({ base: "https://x", key: "K", secret: "S",
    fetch: async () => ({ ok: false, status: 451, json: async () => { throw new SyntaxError("not json"); } }) });
  await assert.rejects(html.positions(), e => e.code === 451);
});

const ok = body => ({ ok: true, status: 200, json: async () => body });
// Routes fake Binance responses by path; records every request.
function fakeFetch(routes, seen = []) {
  return async (url, opts) => {
    const u = new URL(url);
    seen.push({ path: u.pathname, params: u.searchParams, opts });
    const r = routes[u.pathname];
    if (!r) throw new Error("unexpected " + u.pathname);
    return typeof r === "function" ? r(u.searchParams) : ok(r);
  };
}
const ROUTES = {
  "/fapi/v1/time": { serverTime: Date.now() },
  "/fapi/v1/exchangeInfo": { symbols: [
    { symbol: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USDT", status: "TRADING", contractType: "PERPETUAL", filters: [
      { filterType: "LOT_SIZE", stepSize: "0.01", minQty: "0.01" },
      { filterType: "MARKET_LOT_SIZE", stepSize: "0.01", minQty: "0.01" },
      { filterType: "MIN_NOTIONAL", notional: "5" }] },
    { symbol: "SOLUSDC", baseAsset: "SOL", quoteAsset: "USDC", status: "TRADING", contractType: "PERPETUAL", filters: [] }] },
  "/fapi/v1/premiumIndex": [{ symbol: "SOLUSDT", markPrice: "117.6" }],
  "/fapi/v3/positionRisk": [
    { symbol: "SOLUSDT", positionAmt: "-0.05", entryPrice: "120", markPrice: "117.6", unRealizedProfit: "0.12" },
    { symbol: "BTCUSDT", positionAmt: "0", entryPrice: "0", markPrice: "1", unRealizedProfit: "0" }],
  "/fapi/v3/balance": [{ asset: "USDT", balance: "100.5", availableBalance: "90" }],
  "/fapi/v1/order": { status: "FILLED", executedQty: "0.05", avgPrice: "117.60", orderId: 812345 },
};

test("venue maps markets by coin with lot and notional limits", async () => {
  const v = await binanceVenue(binance({ base: "https://x", key: "K", secret: "S", fetch: fakeFetch(ROUTES) }), "mainnet");
  assert.equal(v.canTrade, true);
  assert.deepEqual(await v.markets(), [{ coin: "SOL", mark: 117.6, step: "0.01", min: "0.01", minNotional: 5 }]);
});

test("venue maps positions and drops empty ones", async () => {
  const v = await binanceVenue(binance({ base: "https://x", key: "K", secret: "S", fetch: fakeFetch(ROUTES) }), "demo");
  assert.equal(v.canTrade, false);
  assert.deepEqual(await v.positions(), [{ coin: "SOL", side: "short", size: "0.05", entry: 120, mark: 117.6, upnl: 0.12 }]);
  assert.deepEqual(await v.balance(), { wallet: 100.5, available: 90 });
});

test("venue order: coin and side map to symbol and BUY/SELL, result is normalised", async () => {
  const seen = [];
  const v = await binanceVenue(binance({ base: "https://x", key: "K", secret: "S", fetch: fakeFetch(ROUTES, seen) }), "mainnet");
  const o = await v.marketOrder("SOL", "short", "0.05", true);
  const p = seen.at(-1).params;
  assert.deepEqual([p.get("symbol"), p.get("side"), p.get("quantity"), p.get("reduceOnly")], ["SOLUSDT", "SELL", "0.05", "true"]);
  assert.deepEqual(o, { status: "FILLED", filled: "0.05", avgPrice: 117.6, id: 812345 });
});

test("a 2xx non-JSON body is an explicit error", async () => {
  const bn = binance({ base: "https://x", key: "K", secret: "S",
    fetch: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("x"); } }) });
  await assert.rejects(bn.positions(), e => e.code === "bad-response");
});

test("every request carries a timeout signal", async () => {
  const seen = [];
  await binance({ base: "https://x", key: "K", secret: "S", fetch: fakeFetch(ROUTES, seen) }).balance();
  assert.ok(seen[0].opts.signal instanceof AbortSignal);
});

test("a 5xx with a JSON body keeps the HTTP status next to the Binance code", async () => {
  const bn = binance({ base: "https://x", key: "K", secret: "S",
    fetch: async () => ({ ok: false, status: 503, json: async () => ({ code: -1001, msg: "Internal error" }) }) });
  await assert.rejects(bn.marketOrder("BTCUSDT", "BUY", "0.001", false), e => e.code === -1001 && e.status === 503);
});
