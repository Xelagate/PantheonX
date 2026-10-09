// Pacifica REST: a tiny API helper (mainnet overview, testnet trading) and the testnet venue adapter. No DOM.
import { signedBody } from "./pacifica-sign.js";

export const PACIFICA = { testnet: "https://test-api.pacifica.fi/api/v1", mainnet: "https://api.pacifica.fi/api/v1" };

export function pacificaApi(base, fetch = globalThis.fetch) {
  return async (path, body) => {
    const r = await fetch(`${base}/${path}`, { signal: AbortSignal.timeout(10000),
      ...(body && { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
    const res = await r.json().catch(() => undefined);
    if (res === undefined) throw Object.assign(new Error("Неожиданный ответ Pacifica"), { code: "bad-response" });
    if (!res.success) throw Object.assign(new Error(res.error || `HTTP ${r.status}`), { code: res.code ?? r.status, status: r.status });
    return res.data;
  };
}

// signMessage: (Uint8Array) => Promise<Uint8Array> — Phantom in the page.
export function pacificaVenue({ account, signMessage, fetch }) {
  const api = pacificaApi(PACIFICA.testnet, fetch);
  let info;
  const marks = async () => Object.fromEntries((await api("info/prices")).map(p => [p.symbol, +p.mark]));
  return {
    id: "pacifica", net: "testnet", canTrade: true,
    async markets() {
      info ??= await api("info");
      const mark = await marks();
      return info.filter(m => mark[m.symbol])
        .map(m => ({ coin: m.symbol, mark: mark[m.symbol], step: m.lot_size, min: m.lot_size, minNotional: +m.min_order_size }));
    },
    async balance() {
      const a = await api(`account?account=${encodeURIComponent(account)}`);
      return { wallet: +a.balance, available: +a.available_to_spend };
    },
    async positions() {
      const [rows, mark] = await Promise.all([api(`positions?account=${encodeURIComponent(account)}`), marks()]);
      return rows.map(p => {
        const long = p.side === "bid", size = +p.amount, entry = +p.entry_price, m = mark[p.symbol] ?? entry;
        return { coin: p.symbol, side: long ? "long" : "short", size: p.amount, entry, mark: m, upnl: (m - entry) * size * (long ? 1 : -1) };
      });
    },
    async marketOrder(coin, side, size, reduceOnly) {
      const data = { symbol: coin, amount: size, side: side === "long" ? "bid" : "ask", slippage_percent: "0.5",
        reduce_only: reduceOnly, client_order_id: crypto.randomUUID() };
      const d = await api("orders/create_market", await signedBody({ type: "create_market_order", data, account, signMessage }));
      return { status: "ACCEPTED", filled: size, avgPrice: null, id: d?.order_id ?? null };
    },
  };
}
