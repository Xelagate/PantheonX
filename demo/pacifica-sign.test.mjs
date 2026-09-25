import { test } from "node:test";
import assert from "node:assert/strict";
import { base58, canonical, signedBody } from "./pacifica-sign.js";

test("canonical matches the Pacifica docs reference string", () => {
  const data = { symbol: "BTC", tif: "GTC", side: "bid", reduce_only: false, price: "100000", amount: "0.1",
    client_order_id: "12345678-1234-1234-1234-123456789abc" };
  assert.equal(canonical("create_order", data, 1748970123456, 5000),
    '{"data":{"amount":"0.1","client_order_id":"12345678-1234-1234-1234-123456789abc","price":"100000","reduce_only":false,"side":"bid","symbol":"BTC","tif":"GTC"},"expiry_window":5000,"timestamp":1748970123456,"type":"create_order"}');
});

test("base58 known vectors, including leading zeros", () => {
  assert.equal(base58(new TextEncoder().encode("Hello World!")), "2NEpo7TZRRrLZSi2U");
  assert.equal(base58(Uint8Array.from([0, 0, 0x28, 0x7f, 0xb4, 0xcd])), "11233QC4");
});

test("signedBody signs the canonical bytes and returns a flat body", async () => {
  const data = { symbol: "SOL", amount: "1", side: "ask", slippage_percent: "0.5", reduce_only: true };
  let signed;
  const body = await signedBody({
    type: "create_market_order", account: "Acc", now: 1, expiryWindow: 5000, data,
    signMessage: async m => { signed = new TextDecoder().decode(m); return Uint8Array.from([0, 1]); },
  });
  assert.equal(signed, canonical("create_market_order", data, 1, 5000));
  assert.deepEqual(body, { account: "Acc", signature: "12", timestamp: 1, expiry_window: 5000, ...data });
});
