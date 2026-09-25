"""Spike: read-only view of Pacifica perps (Solana) — positions by wallet, funding vs Binance.

Throwaway probe, stdlib only, public endpoints, no keys, no signing.

    python3 perps_lens.py positions <solana_wallet>
    python3 perps_lens.py funding [top_n]
"""
import json
import sys
import urllib.request

PACIFICA = "https://api.pacifica.fi/api/v1"
BINANCE = "https://fapi.binance.com/fapi/v1"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "perps-lens"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


def pacifica(path):
    body = get(f"{PACIFICA}/{path}")
    if not body.get("success"):
        sys.exit(f"Pacifica error on {path}: {body.get('error')}")
    return body["data"]


def positions(wallet):
    marks = {p["symbol"]: float(p["mark"]) for p in pacifica("info/prices")}
    rows = pacifica(f"positions?account={wallet}")
    if not rows:
        print("No open positions.")
        return
    total = 0.0
    print(f"{'market':<10}{'side':<7}{'size':>12}{'entry':>14}{'mark':>14}{'uPnL $':>14}")
    for p in rows:
        size, entry = float(p["amount"]), float(p["entry_price"])
        mark = marks.get(p["symbol"], entry)
        sign = 1 if p["side"] == "bid" else -1
        pnl = (mark - entry) * size * sign
        total += pnl
        side = "long" if sign == 1 else "short"
        print(f"{p['symbol']:<10}{side:<7}{size:>12g}{entry:>14.4f}{mark:>14.4f}{pnl:>14,.2f}")
    print(f"{'total unrealized PnL':<57}{total:>14,.2f}")


def funding(top_n=15):
    pac = sorted(pacifica("info/prices"), key=lambda p: -float(p["volume_24h"]))
    bn_rate = {b["symbol"]: float(b["lastFundingRate"]) for b in get(f"{BINANCE}/premiumIndex")}
    bn_hours = {b["symbol"]: b["fundingIntervalHours"] for b in get(f"{BINANCE}/fundingInfo")}

    # Both normalised to "% per 8h", the unit traders usually quote.
    print(f"{'market':<10}{'Pacifica %/8h':>15}{'Binance %/8h':>15}{'diff':>10}  cheaper long on")
    shown = 0
    for p in pac:
        sym = f"{p['symbol']}USDT"
        if sym not in bn_rate:
            continue
        pac8 = float(p["funding"]) * 8 * 100
        bn8 = bn_rate[sym] / bn_hours.get(sym, 8) * 8 * 100
        cheaper = "same" if abs(pac8 - bn8) < 1e-4 else ("Pacifica" if pac8 < bn8 else "Binance")
        print(f"{p['symbol']:<10}{pac8:>15.4f}{bn8:>15.4f}{pac8 - bn8:>10.4f}  {cheaper}")
        shown += 1
        if shown == top_n:
            break


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["positions"] and len(args) == 2:
        positions(args[1])
    elif args[:1] == ["funding"]:
        funding(int(args[1]) if len(args) > 1 else 15)
    else:
        sys.exit(__doc__)
