# Perps Lens

Solana perpetuals on [Pacifica](https://pacifica.fi) next to the CEX view a trader already uses:
positions and PnL by wallet, funding compared with Binance, and market orders signed in Phantom.

Live demo: https://xelagate.github.io/perps-lens-demo/ (read-only, mainnet data).
Testnet trading: https://xelagate.github.io/perps-lens-demo/?net=testnet

Built for the Colosseum Crypto World's Fair hackathon (Sep–Oct 2026).

## What is here

| Path | What |
|---|---|
| `demo/index.html` | Static page, no build step: wallet positions and PnL, top traders, markets; on `?net=testnet` connect Phantom and open/close market orders |
| `demo/pacifica-sign.js` | Pacifica order signing (canonical JSON + ed25519, base58), shared by the page and the scripts |
| `demo/pacifica-sign.test.mjs` | Tests against the reference string from Pacifica's docs |
| `perps_lens.py` | Read-only CLI: `positions <wallet>`, `funding [top_n]` (Pacifica vs Binance), stdlib only |
| `scripts/new-testnet-wallet.mjs` | Generates a throwaway testnet wallet into gitignored `.secrets/` |
| `scripts/testnet-order.mjs` | Opens and closes a minimum testnet market order with that wallet |

## Run

```sh
node --test demo/pacifica-sign.test.mjs
python3 perps_lens.py funding 10
python3 -m http.server -d demo 8000   # then open http://localhost:8000/?net=testnet
```

Trading is testnet only. Use a separate test wallet, never a wallet holding real funds.
