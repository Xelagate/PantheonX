// Live DEMO probe: open the minimum market long on Binance Demo Trading, then close it.
//   node scripts/binance-demo-order.mjs [SYMBOL]      (default BTCUSDT)
// Key: .env (perps-lens root) with BINANCE_DEMO_KEY and BINANCE_DEMO_SECRET.
import { fileURLToPath } from "node:url";
import { BASES, binance } from "../demo/binance.js";
import { checkOrder } from "../demo/ticket.js";

process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
const symbol = process.argv[2] || "BTCUSDT";
const bn = binance({ base: BASES.demo, key: process.env.BINANCE_DEMO_KEY, secret: process.env.BINANCE_DEMO_SECRET }); // demo only, never mainnet

await bn.syncTime();
const s = (await bn.exchangeInfo()).symbols.find(x => x.symbol === symbol);
const lot = s.filters.find(f => f.filterType === "MARKET_LOT_SIZE");
const notional = +s.filters.find(f => f.filterType === "MIN_NOTIONAL").notional;
const mark = +(await (await fetch(`${BASES.demo}/fapi/v1/premiumIndex?symbol=${symbol}`)).json()).markPrice;
const { qty, error } = checkOrder({ size: String(Math.ceil((notional * 1.1) / mark / +lot.stepSize) * +lot.stepSize), mark, step: lot.stepSize, min: lot.minQty, minNotional: notional, net: "demo" });
if (error) throw new Error(error);

console.log("balance", await bn.balance());
console.log("open", await bn.marketOrder(symbol, "BUY", qty));
console.log("positions", await bn.positions());
console.log("close", await bn.marketOrder(symbol, "SELL", qty, true));
