// Live TESTNET probe: open a ~$11 market long, then close it, signed with .secrets/testnet-wallet.json.
//   node scripts/testnet-order.mjs [SYMBOL]      (default SOL)
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { signedBody } from "../demo/pacifica-sign.js";

const API = "https://test-api.pacifica.fi/api/v1"; // testnet only, never mainnet
const symbol = process.argv[2] || "SOL";

const wallet = JSON.parse(readFileSync(new URL("../.secrets/testnet-wallet.json", import.meta.url)));
const secret = Buffer.from(wallet.secretKey);
const key = createPrivateKey({ format: "jwk", key: { kty: "OKP", crv: "Ed25519",
  d: secret.subarray(0, 32).toString("base64url"), x: secret.subarray(32).toString("base64url") } });
const signMessage = async m => sign(null, m, key);

async function call(method, path, body) {
  const r = await fetch(`${API}/${path}`, { method, headers: { "Content-Type": "application/json" },
    body: body && JSON.stringify(body) });
  const res = await r.json();
  if (!path.startsWith("info")) console.log(method, path, r.status, JSON.stringify(res));
  return res;
}

async function market(side, amount, reduce_only) {
  const data = { symbol, amount, side, slippage_percent: "0.5", reduce_only, client_order_id: crypto.randomUUID() };
  return call("POST", "orders/create_market",
    await signedBody({ type: "create_market_order", data, account: wallet.publicKey, signMessage }));
}

const info = (await call("GET", "info")).data.find(m => m.symbol === symbol);
const mark = +(await call("GET", "info/prices")).data.find(p => p.symbol === symbol).mark;
const lot = +info.lot_size, decimals = (info.lot_size.split(".")[1] || "").length;
const amount = (Math.ceil((+info.min_order_size * 1.1) / mark / lot) * lot).toFixed(decimals);

const open = await market("bid", amount, false);
if (!open.success) process.exit(1);
await call("GET", `positions?account=${wallet.publicKey}`);
const close = await market("ask", amount, true);
process.exit(close.success ? 0 : 1);
