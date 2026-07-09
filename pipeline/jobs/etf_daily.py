"""etf_daily job. Schedule: Mon-Fri 22:30 UTC, per architecture §3.

Price source: Yahoo Finance's public chart endpoint, NOT the "issuer/SEC price
data" named in the architecture doc. See DECISIONS.md (2026-07-09, "ETF price
source substitution") for why: SEC/EDGAR does not publish daily price series
(only periodic filings), and scraping ~75 individual issuer product pages has
the same acquisition-fragility problem surfaced by SP-1 for AMC holdings pages,
at 75x the surface area. Yahoo's chart endpoint is unauthenticated, free, and
redistributes real exchange closing prices; it is undocumented and could
change or block without notice, which is the explicit tradeoff being logged
here rather than silently accepted.

Each run fetches ~10y of daily closes per ticker and replaces the local history
wholesale — this makes the job self-seeding (first run acts as its own
backfill) and self-healing (a bad prior run doesn't compound).
"""
from __future__ import annotations

import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import requests

from .common import (
    DATA_DIR, FUNDS_JSON, NAV_DIR,
    compute_returns, load_json, slugify, update_meta, write_json_atomic,
)
from .validate import validate_day_over_day, validate_nav_value
from .common import JobError

JOB_NAME = "etf_daily"
CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
ETF_UNIVERSE_PATH = DATA_DIR.parent / "pipeline" / "etf_universe.json"
MAX_WORKERS = 8


def fetch_chart(ticker: str, retries: int = 3):
    for attempt in range(retries):
        try:
            r = requests.get(
                CHART_URL.format(ticker=ticker),
                params={"range": "10y", "interval": "1d"},
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=20,
            )
            r.raise_for_status()
            js = r.json()
            result = js.get("chart", {}).get("result")
            if not result:
                return None, None, js.get("chart", {}).get("error", "empty result")
            res = result[0]
            timestamps = res.get("timestamp", [])
            closes = res.get("indicators", {}).get("quote", [{}])[0].get("close", [])
            meta = res.get("meta", {})
            return timestamps, closes, meta
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                return None, None, str(e)
            time.sleep(1.5 * (attempt + 1))
    return None, None, "unreachable"


def process_one(entry: dict):
    ticker = entry["ticker"]
    timestamps, closes, meta_or_err = fetch_chart(ticker)
    if timestamps is None:
        return ticker, "error", meta_or_err

    series = []
    for ts, close in zip(timestamps, closes or []):
        if close is None:
            continue
        d = datetime.fromtimestamp(ts, tz=timezone.utc)
        series.append((d.strftime("%Y-%m-%d"), round(float(close), 4)))
    # de-dupe same-day (intraday timestamps collapse to one date), keep last
    by_date = {}
    for d, c in series:
        by_date[d] = c
    history = sorted(by_date.items())
    if len(history) < 30:
        return ticker, "insufficient_history", f"{len(history)} points"

    write_json_atomic(NAV_DIR / f"{ticker}.json", [[d, c] for d, c in history])
    return ticker, "ok", (history, meta_or_err)


def run() -> None:
    universe = load_json(ETF_UNIVERSE_PATH, default=[])
    if not universe:
        raise JobError(f"ETF universe file missing or empty: {ETF_UNIVERSE_PATH}")

    previous_funds = load_json(FUNDS_JSON, default=[])
    previous_by_ticker = {f["scheme_code"]: f for f in previous_funds if f.get("market") == "US"}
    in_funds = [f for f in previous_funds if f.get("market") == "IN"]

    results = {"ok": 0, "insufficient_history": 0, "error": 0}
    errors = []
    us_funds = []
    latest_dates = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(process_one, e): e for e in universe}
        for fut in as_completed(futures):
            ticker, status, payload = fut.result()
            results[status] += 1
            entry = futures[fut]
            prev_record = previous_by_ticker.get(ticker, {})

            if status != "ok":
                errors.append((ticker, payload))
                if prev_record:
                    us_funds.append(prev_record)  # keep last-good record; graceful staleness
                continue

            history, meta = payload
            latest_date, latest_price = history[-1]
            prev_price = history[-2][1] if len(history) > 1 else None
            try:
                validate_nav_value(ticker, latest_price)
                validate_day_over_day(ticker, prev_price, latest_price)
            except JobError as e:
                errors.append((ticker, str(e)))
                if prev_record:
                    us_funds.append(prev_record)
                continue

            latest_dates.append(latest_date)
            series_sorted = [(datetime.strptime(d, "%Y-%m-%d"), n) for d, n in history]
            ret = compute_returns(series_sorted)

            us_funds.append({
                "id": ticker,
                "market": "US",
                "scheme_code": ticker,
                "name": entry["name"],
                "slug": slugify(entry["name"]),
                "amc": entry["issuer"],
                "category": "ETF",
                "sub_category": entry["asset_class"],
                "benchmark": None,
                "inception": None,
                "expense_ratio": None,
                "aum": None,
                "nav": latest_price,
                "nav_date": latest_date,
                "currency": "USD",
                "returns": ret["returns"],
                "rolling": ret["rolling"],
                "exit_load": None,
                "holdings_tier": "thin",
                "holdings_asof": None,
                "status": "active",
            })

    write_json_atomic(FUNDS_JSON, in_funds + us_funds)

    etf_asof = max(latest_dates) if latest_dates else None
    meta = load_json(DATA_DIR / "meta.json", default={})
    meta["etf_prices_asof"] = etf_asof
    meta["last_build"] = datetime.utcnow().isoformat() + "Z"
    write_json_atomic(DATA_DIR / "meta.json", meta)

    status = "ok" if results["error"] == 0 else "partial"
    update_meta(JOB_NAME, status, {
        "universe_size": len(universe),
        "ok": results["ok"],
        "insufficient_history": results["insufficient_history"],
        "errors": results["error"],
        "etf_prices_asof": etf_asof,
    })
    print(f"[{JOB_NAME}] {status.upper()}: {results['ok']}/{len(universe)} tickers, "
          f"{results['error']} errors, etf_prices_asof={etf_asof}")
    if errors:
        print(f"[{JOB_NAME}] errors: {errors}")


if __name__ == "__main__":
    run()
    sys.exit(0)
