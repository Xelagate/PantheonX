import { test } from "node:test";
import assert from "node:assert/strict";
import { checkOrder, unknownOutcome, usdToQty } from "./ticket.js";

const sol = { mark: 117.6, step: "0.01", min: "0.01", minNotional: 5 };

test("rounds down to the step and accepts a comma", () => {
  assert.deepEqual(checkOrder({ ...sol, size: "0,057", net: "mainnet" }), { qty: "0.05", notional: 0.05 * 117.6 });
});

test("rejects empty, junk and non-positive sizes", () => {
  for (const size of ["", "abc", "0", "-1"])
    assert.match(checkOrder({ ...sol, size, net: "testnet" }).error, /больше нуля/);
});

test("rejects below min lot and below min notional", () => {
  assert.match(checkOrder({ ...sol, size: "0.004", net: "testnet" }).error, /лота 0\.01/);
  assert.match(checkOrder({ ...sol, size: "0.02", net: "testnet" }).error, /\$5/);
});

test("Mainnet cap blocks an open above $50, testnet is uncapped", () => {
  assert.match(checkOrder({ ...sol, size: "0.5", net: "mainnet" }).error, /\$50/);
  assert.equal(checkOrder({ ...sol, size: "0.5", net: "testnet" }).qty, "0.50");
});

test("cap and min notional ignore reduce-only", () => {
  assert.equal(checkOrder({ ...sol, size: "3", net: "mainnet", reduceOnly: true }).qty, "3.00");
  assert.equal(checkOrder({ ...sol, size: "0.02", net: "mainnet", reduceOnly: true }).qty, "0.02");
});

test("whole-number steps produce integer quantities", () => {
  assert.equal(checkOrder({ mark: 0.01, step: "1", min: "1", size: "1234.9", net: "testnet" }).qty, "1234");
});

test("rejects NaN mark (price guard)", () => {
  assert.match(checkOrder({ ...sol, mark: NaN, size: "0.05", net: "mainnet" }).error, /цены/);
});

test("rejects non-finite sizes (Infinity)", () => {
  assert.match(checkOrder({ ...sol, size: "Infinity", net: "mainnet" }).error, /больше нуля/);
});

test("exact boundary: mark 100 with cap $50", () => {
  assert.equal(checkOrder({ mark: 100, step: "0.01", min: "0.01", size: "0.5", net: "mainnet" }).qty, "0.50");
  assert.match(checkOrder({ mark: 100, step: "0.01", min: "0.01", size: "0.51", net: "mainnet" }).error, /\$50/);
});

test("unknownOutcome: only failures where the order may have been sent", () => {
  const err = props => Object.assign(new Error("x"), props);
  assert.equal(unknownOutcome(err({ code: -1001, status: 503 })), true);
  assert.equal(unknownOutcome(new TypeError("fetch failed")), true);
  assert.equal(unknownOutcome(new DOMException("t", "TimeoutError")), true);
  assert.equal(unknownOutcome(err({ code: "bad-response" })), true);
  assert.equal(unknownOutcome(err({ code: -2019, status: 400 })), false);
  assert.equal(unknownOutcome(err({ code: 4001 })), false);
});

test("usdToQty rounds dollars down to whole steps", () => {
  assert.equal(usdToQty({ usd: "10", mark: 192.15, step: "0.01" }), "0.05");
  assert.equal(usdToQty({ usd: "9.6075", mark: 192.15, step: "0.01" }), "0.05"); // exactly 0.05 × mark: no float drift below
  assert.equal(usdToQty({ usd: "1", mark: 192.15, step: "0.01" }), "0.00"); // below one step
  assert.equal(usdToQty({ usd: "50", mark: 0.01, step: "1" }), "5000");
  for (const mark of [0, NaN, -1, Infinity]) assert.equal(usdToQty({ usd: "10", mark, step: "0.01" }), null);
  assert.equal(usdToQty({ usd: "abc", mark: 192.15, step: "0.01" }), null);
});

test("errors carry a dictionary key", () => {
  assert.deepEqual(checkOrder({ ...sol, size: "0.5", net: "mainnet" }).vars, { cap: 50, usd: "58.80" });
  assert.equal(checkOrder({ ...sol, size: "0.004", net: "testnet" }).key, "e_lot");
});
