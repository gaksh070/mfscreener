"""backfill job (one-time / manual re-run). Per architecture §3.

Seeds full historical NAV per canonical scheme from a free historical-NAV API
(api.mfapi.in), validated for reliability in Phase 0 SP-2 (see
pipeline/spikes/SPIKE_REPORT.md: 19/19 funds backfilled, 4 independent spot-checks
matched published 5Y CAGR within 0.01pp against a ±0.2pp gate).

Run after nav_daily has established the canonical universe in funds.json. Safe to
re-run: each scheme's history is fully replaced from the source of truth, not
appended to.
"""
from __future__ import annotations

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import requests

from .common import (
    DATA_DIR, FUNDS_JSON, NAV_DIR,
    compute_returns, load_json, update_meta, write_json_atomic,
)

JOB_NAME = "backfill"
MFAPI_BASE = "https://api.mfapi.in/mf"
MAX_WORKERS = 10


def fetch_history(scheme_code: str, retries: int = 3):
    for attempt in range(retries):
        try:
            r = requests.get(f"{MFAPI_BASE}/{scheme_code}", timeout=25)
            r.raise_for_status()
            js = r.json()
            if "data" not in js:
                return None, "no 'data' field in response"
            return js["data"], None
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                return None, str(e)
            time.sleep(1.5 * (attempt + 1))
    return None, "unreachable"


def backfill_one(fund: dict):
    scheme_code = fund["scheme_code"]
    raw, err = fetch_history(scheme_code)
    if err:
        return scheme_code, "error", err
    series = []
    for row in raw:
        try:
            d = datetime.strptime(row["date"], "%d-%m-%Y")
            n = float(row["nav"])
        except (ValueError, KeyError):
            continue
        if n > 0:
            series.append((d, n))
    if len(series) < 30:
        return scheme_code, "insufficient_history", f"{len(series)} points"

    series.sort(key=lambda x: x[0])
    history = [[d.strftime("%Y-%m-%d"), n] for d, n in series]
    write_json_atomic(NAV_DIR / f"{scheme_code}.json", history)
    return scheme_code, "ok", len(series)


def run(limit: int | None = None) -> None:
    funds = load_json(FUNDS_JSON, default=[])
    india_funds = [f for f in funds if f.get("market") == "IN" and f.get("status") != "closed"]
    if limit:
        india_funds = india_funds[:limit]

    results = {"ok": 0, "insufficient_history": 0, "error": 0}
    errors = []
    funds_by_code = {f["scheme_code"]: f for f in funds}

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(backfill_one, f): f for f in india_funds}
        done = 0
        for fut in as_completed(futures):
            scheme_code, status, detail = fut.result()
            results[status] += 1
            done += 1
            if status == "error":
                errors.append((scheme_code, detail))
            if done % 100 == 0 or done == len(india_funds):
                print(f"[{JOB_NAME}] {done}/{len(india_funds)} processed "
                      f"(ok={results['ok']}, insufficient={results['insufficient_history']}, "
                      f"error={results['error']})")

    # recompute returns for every successfully backfilled scheme and rewrite funds.json
    updated = 0
    for f in funds:
        if f.get("market") != "IN":
            continue
        nav_path = NAV_DIR / f"{f['scheme_code']}.json"
        history = load_json(nav_path, default=None)
        if not history:
            continue
        series_sorted = [(datetime.strptime(d, "%Y-%m-%d"), n) for d, n in history]
        ret = compute_returns(series_sorted)
        f["returns"] = ret["returns"]
        f["rolling"] = ret["rolling"]
        updated += 1

    write_json_atomic(FUNDS_JSON, funds)

    coverage_pct = round(100 * results["ok"] / len(india_funds), 1) if india_funds else 0.0
    update_meta(JOB_NAME, "ok", {
        "attempted": len(india_funds),
        "ok": results["ok"],
        "insufficient_history": results["insufficient_history"],
        "errors": results["error"],
        "coverage_pct": coverage_pct,
        "returns_recomputed": updated,
    })
    print(f"[{JOB_NAME}] DONE: {results['ok']}/{len(india_funds)} backfilled "
          f"({coverage_pct}% coverage), {results['insufficient_history']} too-new, "
          f"{results['error']} errors, {updated} funds' returns recomputed")
    if errors[:10]:
        print(f"[{JOB_NAME}] sample errors: {errors[:10]}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None,
                         help="backfill only the first N funds (for local testing)")
    args = parser.parse_args()
    run(limit=args.limit)
    sys.exit(0)
