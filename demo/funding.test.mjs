import { test } from "node:test";
import assert from "node:assert/strict";
import { fundingRows } from "./funding.js";

test("normalises to %/8h, keeps shared markets by volume, sorts by |spread|", () => {
  const prices = [
    { symbol: "BTC", funding: "0.0000125", volume_24h: "900" },  // 0.01 %/8h
    { symbol: "ETH", funding: "0.0000125", volume_24h: "800" },
    { symbol: "SOL", funding: "-0.00001", volume_24h: "700" },  // -0.008 %/8h
    { symbol: "XAU", funding: "0.0001", volume_24h: "999" },     // not on Binance
    { symbol: "DOGE", funding: "0", volume_24h: "1" },           // cut by top
  ];
  const premium = [{ symbol: "BTCUSDT", lastFundingRate: "0.0001" }, { symbol: "ETHUSDT", lastFundingRate: "-0.00005" },
    { symbol: "SOLUSDT", lastFundingRate: "0.0001" }, { symbol: "DOGEUSDT", lastFundingRate: "0.01" }];
  const info = [{ symbol: "SOLUSDT", fundingIntervalHours: 4 }]; // 0.01% per 4h = 0.02 %/8h
  const rows = fundingRows({ prices, premium, info, top: 3 });
  assert.deepEqual(rows.map(r => r.coin), ["SOL", "ETH", "BTC"]);
  const [sol, eth, btc] = rows;
  assert.ok(Math.abs(sol.pac + 0.008) < 1e-12 && Math.abs(sol.bn - 0.02) < 1e-12);
  assert.equal(sol.cheaperLong, "pacifica");
  assert.ok(Math.abs(eth.spread - 0.015) < 1e-12 && eth.cheaperLong === "binance");
  assert.ok(Math.abs(eth.apr - 0.015 * 3 * 365) < 1e-9);
  assert.equal(btc.cheaperLong, null); // equal rates
});
