// Order check shared by both venues: lot rounding, minimums, the Mainnet notional cap. No DOM.
export const MAINNET_CAP = 50;

// Round a positive amount DOWN to the lot step; returns a string with the step's decimals.
export function roundDown(raw, step) {
  const decimals = (step.split(".")[1] || "").replace(/0+$/, "").length;
  return (Math.floor(raw / +step + 1e-9) * +step).toFixed(decimals);
}

// Size entered in dollars -> coin quantity rounded down to the step; null when usd or mark is unusable.
export function usdToQty({ usd, mark, step }) {
  const raw = +String(usd ?? "").trim().replace(",", ".");
  if (!(raw > 0) || !Number.isFinite(raw) || !(mark > 0) || !Number.isFinite(mark)) return null;
  return roundDown(raw / mark, step);
}

// Errors carry `key` + `vars` for the page's dictionary; `error` stays a readable Russian message for scripts.
const fail = (error, key, vars = {}) => ({ error, key, vars });

export function checkOrder({ size, mark, step, min, minNotional = 0, net, reduceOnly = false, cap = MAINNET_CAP }) {
  const raw = +String(size ?? "").trim().replace(",", ".");
  if (!(raw > 0) || !Number.isFinite(raw)) return fail("Укажи размер больше нуля.", "e_size");
  if (!(mark > 0)) return fail("Нет цены рынка — обнови позже.", "e_mark");
  const qty = roundDown(raw, step), q = +qty;
  if (q < +min) return fail(`Размер меньше минимального лота ${min}.`, "e_lot", { min });
  const notional = q * mark;
  if (!reduceOnly && notional < minNotional) return fail(`Минимальный ордер — $${minNotional}. Увеличь размер.`, "e_notional", { min: minNotional });
  if (!reduceOnly && net === "mainnet" && notional > cap)
    return fail(`На Mainnet ордер ограничен $${cap}: сейчас ≈ $${notional.toFixed(2)}.`, "e_cap", { cap, usd: notional.toFixed(2) });
  return { qty, notional };
}

export const STALE_MS = 30000;

// True when a failed order may still have reached the exchange: network failure, timeout, unreadable reply, any 5xx.
export const unknownOutcome = e => e instanceof TypeError || e.name === "TimeoutError" || e.name === "AbortError" ||
  e.code === "bad-response" || e.status >= 500 || e.code === -1006 || e.code === -1007;
