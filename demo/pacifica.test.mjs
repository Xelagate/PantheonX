import { test } from "node:test";
import assert from "node:assert/strict";
import { pacificaVenue } from "./pacifica.js";

const res = data => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
function fakeFetch(seen = []) {
  return async (url, opts = {}) => {
    const path = new URL(url).pathname.replace("/api/v1/", "");
    seen.push({ path, opts });
    if (path === "info") return res([{ symbol: "SOL", lot_size: "0.01", min_order_size: "10" }, { symbol: "DEAD", lot_size: "1", min_order_size: "10" }]);
    if (path === "info/prices") return res([{ symbol: "SOL", mark: "117.6" }]);
    if (path === "account") return res({ balance: "992.34", available_to_spend: "900" });
    if (path === "positions") return res([{ symbol: "SOL", side: "ask", amount: "0.1", entry_price: "120" }]);
    if (path === "orders/create_market") return res({ order_id: 77 });
    return { ok: false, status: 404, json: async () => ({ success: false, error: "nope", code: 404 }) };
  };
}
const venue = seen => pacificaVenue({ account: "ACC", signMessage: async () => new Uint8Array(64), fetch: fakeFetch(seen) });

test("markets carry lot, USD minimum and mark; markets without a price are dropped", async () => {
  assert.deepEqual(await venue().markets(), [{ coin: "SOL", mark: 117.6, step: "0.01", min: "0.01", minNotional: 10 }]);
});

test("balance and positions map to the shared shape", async () => {
  const v = venue();
  assert.deepEqual(await v.balance(), { wallet: 992.34, available: 900 });
  const [p] = await v.positions();
  assert.equal(p.coin, "SOL"); assert.equal(p.side, "short"); assert.equal(p.size, "0.1");
  assert.equal(p.entry, 120); assert.equal(p.mark, 117.6);
  assert.ok(Math.abs(p.upnl - 0.24) < 1e-9);
});

test("market order posts a signed body with fixed 0.5% slippage", async () => {
  const seen = [];
  const o = await venue(seen).marketOrder("SOL", "long", "0.10", false);
  const req = seen.find(s => s.path === "orders/create_market");
  const body = JSON.parse(req.opts.body);
  assert.equal(req.opts.method, "POST");
  assert.deepEqual([body.account, body.symbol, body.side, body.amount, body.slippage_percent, body.reduce_only],
    ["ACC", "SOL", "bid", "0.10", "0.5", false]);
  assert.equal(typeof body.signature, "string");
  assert.deepEqual(o, { status: "ACCEPTED", filled: "0.10", avgPrice: null, id: 77 });
});

test("API errors carry a code; requests carry a timeout", async () => {
  const seen = [];
  const v = pacificaVenue({ account: "ACC", signMessage: async () => new Uint8Array(64),
    fetch: async (u, o) => { seen.push(o); return { ok: false, status: 400, json: async () => ({ success: false, error: "bad", code: 400 }) }; } });
  await assert.rejects(v.balance(), e => e.code === 400 && /bad/.test(e.message));
  assert.ok(seen[0].signal instanceof AbortSignal);
});
