# PantheonX — Perps Lens

All your perps in one window: Pacifica (Solana on-chain perps) next to Binance USDT-M Futures,
one portfolio and one order ticket.

Live: https://pantheonx.trade

Built for the Colosseum Crypto World's Fair hackathon (Sep–Oct 2026).

## What it does

- **Trade** — connect Phantom (Pacifica) and a Binance futures API key, see positions and PnL across
  both venues, open and close market orders from one ticket.
- **Market** — live Pacifica markets, funding compared with Binance (% per 8h), top traders.
- **Screener** — Binance perps table over PantheonX's screener service: sort, search, live updates;
  clicking a coin fills the ticket.
- **Order Flow** — PantheonX's order-flow tool, embedded.

Safety: Pacifica trading runs on **testnet** (use a separate empty wallet). Binance **Mainnet trades
real money** — every opening order is confirmed and capped at $50. Use a key with Futures only, no
Withdraw. The key stays in the browser tab and is sent only to Binance. Binance Demo keys are
view-only (Binance Demo blocks browser orders via CORS).

## What is here

| Path | What |
|---|---|
| `demo/index.html` | Static page, no build step, no backend (EN / RU / UK) |
| `demo/pacifica.js`, `demo/pacifica-sign.js` | Pacifica REST and order signing (canonical JSON + ed25519, base58) |
| `demo/binance.js` | Binance USDT-M futures REST with HMAC signing, venue adapter |
| `demo/funding.js` | Funding comparison Pacifica vs Binance |
| `demo/ticket.js` | Order checks shared by both venues: lot rounding, minimums, Mainnet cap |
| `demo/*.test.mjs` | Unit tests |
| `perps_lens.py` | Read-only CLI: `positions <wallet>`, `funding [top_n]`, stdlib only |
| `scripts/` | Live probes: throwaway testnet wallet, Pacifica testnet order, Binance Demo order |

## Run

```sh
node --test demo/*.test.mjs
python3 perps_lens.py funding 10
python3 -m http.server -d demo 8000   # then open http://localhost:8000/
```

`scripts/binance-demo-order.mjs` reads `BINANCE_DEMO_KEY` / `BINANCE_DEMO_SECRET` from `.env`
(see `.env.example`).
