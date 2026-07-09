"""nav_daily job. Schedule: Mon-Fri 17:45 UTC (~23:15 IST), per architecture §3.

AMFI NAVAll.txt -> parse -> filter to canonical universe (Open-Ended, Direct-Growth
plans only, per PRD R-7 / DECISIONS.md 2026-07-09) -> validate -> append to each
scheme's NAV history -> recompute trailing + rolling returns -> rebuild funds.json.

Known gap (see DECISIONS.md): AMFI's NAVAll.txt does not carry expense_ratio,
benchmark, inception date, or exit load. Those fields are emitted as null until a
separate source is wired up. Flagged to the operator, not silently invented.
"""
from __future__ import annotations

import sys
from datetime import datetime

from .common import (
    DATA_DIR, FUNDS_JSON, NAV_DIR,
    compute_returns, fail, fetch_amfi_nav_all, is_direct_growth, load_json,
    parse_amfi_date, parse_amfi_nav_all, parse_group, slugify, update_meta,
    write_json_atomic,
)
from .validate import (
    validate_day_over_day, validate_nav_value, validate_row_count_delta,
    validate_universe_coverage,
)
from .common import JobError

JOB_NAME = "nav_daily"


def run() -> None:
    previous_funds = load_json(FUNDS_JSON, default=[])
    previous_by_code = {f["scheme_code"]: f for f in previous_funds if f.get("market") == "IN"}
    previous_universe_size = len(previous_by_code) or None

    try:
        raw_text = fetch_amfi_nav_all()
        all_rows = parse_amfi_nav_all(raw_text)
        canonical_rows = [
            r for r in all_rows
            if r["group"] and r["group"].startswith("Open Ended Schemes(") and is_direct_growth(r["name"])
        ]

        validate_universe_coverage(len(canonical_rows), previous_universe_size)
        validate_row_count_delta(len(canonical_rows), previous_universe_size)

        as_of_dates = set()
        new_funds = []
        closed_count = 0
        today = datetime.utcnow()
        for row in canonical_rows:
            scheme_code = row["scheme_code"]
            try:
                nav = float(row["nav"])
            except ValueError:
                raise JobError(f"scheme {scheme_code}: unparseable NAV {row['nav']!r}")
            nav_date = parse_amfi_date(row["date"])
            category, sub_category = parse_group(row["group"])
            prev_record = previous_by_code.get(scheme_code, {})

            # A stale (>10 days old) zero/negative NAV means AMFI itself has stopped
            # updating this scheme -- a wound-up/merged fund (PRD F-02 edge case),
            # not a live data anomaly. Retain the record with status "closed" and
            # last-good NAV rather than crash the whole job over one dead scheme.
            is_stale_zero = nav <= 0 and (today - nav_date).days > 10
            if is_stale_zero:
                closed_count += 1
                new_funds.append({
                    "id": row["isin"] or prev_record.get("id") or scheme_code,
                    "market": "IN", "scheme_code": scheme_code, "name": row["name"],
                    "slug": slugify(row["name"]), "amc": row["amc"],
                    "category": category, "sub_category": sub_category,
                    "benchmark": prev_record.get("benchmark"), "inception": prev_record.get("inception"),
                    "expense_ratio": prev_record.get("expense_ratio"), "aum": prev_record.get("aum"),
                    "nav": prev_record.get("nav"), "nav_date": prev_record.get("nav_date"),
                    "currency": "INR",
                    "returns": prev_record.get("returns", {"y1": None, "y3": None, "y5": None}),
                    "rolling": prev_record.get("rolling", {"y3": None, "y5": None}),
                    "exit_load": prev_record.get("exit_load"),
                    "holdings_tier": prev_record.get("holdings_tier", "thin"),
                    "holdings_asof": prev_record.get("holdings_asof"),
                    "status": "closed",
                })
                continue

            validate_nav_value(scheme_code, nav)
            as_of_dates.add(nav_date.date())

            nav_path = NAV_DIR / f"{scheme_code}.json"
            history = load_json(nav_path, default=[])  # list of [iso_date, nav]
            prev_nav = history[-1][1] if history else None
            validate_day_over_day(scheme_code, prev_nav, nav)

            nav_date_iso = nav_date.strftime("%Y-%m-%d")
            if not history or history[-1][0] != nav_date_iso:
                history.append([nav_date_iso, nav])
                write_json_atomic(nav_path, history)

            series_sorted = [(datetime.strptime(d, "%Y-%m-%d"), n) for d, n in history]
            ret = compute_returns(series_sorted)

            new_funds.append({
                "id": row["isin"] or prev_record.get("id") or scheme_code,
                "market": "IN",
                "scheme_code": scheme_code,
                "name": row["name"],
                "slug": slugify(row["name"]),
                "amc": row["amc"],
                "category": category,
                "sub_category": sub_category,
                "benchmark": prev_record.get("benchmark"),
                "inception": prev_record.get("inception"),
                "expense_ratio": prev_record.get("expense_ratio"),
                "aum": prev_record.get("aum"),
                "nav": nav,
                "nav_date": nav_date_iso,
                "currency": "INR",
                "returns": ret["returns"],
                "rolling": ret["rolling"],
                "exit_load": prev_record.get("exit_load"),
                "holdings_tier": prev_record.get("holdings_tier", "thin"),
                "holdings_asof": prev_record.get("holdings_asof"),
                "status": "active",
            })

        # preserve non-IN (US ETF) records already in funds.json untouched
        us_funds = [f for f in previous_funds if f.get("market") != "IN"]
        write_json_atomic(FUNDS_JSON, new_funds + us_funds)

        nav_asof = max(as_of_dates).isoformat() if as_of_dates else None
        meta = load_json(DATA_DIR / "meta.json", default={})
        meta["nav_asof"] = nav_asof
        meta["last_build"] = datetime.utcnow().isoformat() + "Z"
        write_json_atomic(DATA_DIR / "meta.json", meta)

        update_meta(JOB_NAME, "ok", {
            "universe_size": len(canonical_rows),
            "closed_schemes": closed_count,
            "nav_asof": nav_asof,
            "data_gaps": ["expense_ratio", "benchmark", "inception", "exit_load", "aum"],
        })
        print(f"[{JOB_NAME}] OK: {len(canonical_rows)} schemes ({closed_count} closed), nav_asof={nav_asof}")

    except JobError as e:
        fail(JOB_NAME, str(e))


if __name__ == "__main__":
    run()
    sys.exit(0)
