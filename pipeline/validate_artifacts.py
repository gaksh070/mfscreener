"""Standalone artifact-schema check, per build brief Phase 1 gate ("artifact
schemas validate"). Run after any job: `python -m pipeline.validate_artifacts`.
Exits non-zero with a readable report on the first class of failure found (not
just the first row) so a CI failure is diagnosable from the log alone.
"""
from __future__ import annotations

import sys
from pathlib import Path

from .jobs.common import DATA_DIR, FUNDS_JSON, NAV_DIR, load_json

REQUIRED_FUND_FIELDS = {
    "id", "market", "scheme_code", "name", "slug", "amc", "category",
    "sub_category", "benchmark", "inception", "expense_ratio", "aum", "nav",
    "nav_date", "currency", "returns", "rolling", "exit_load",
    "holdings_tier", "holdings_asof", "status",
}


def check_funds_json() -> list[str]:
    errors = []
    funds = load_json(FUNDS_JSON, default=None)
    if funds is None:
        return [f"{FUNDS_JSON} does not exist"]
    if not isinstance(funds, list) or not funds:
        return [f"{FUNDS_JSON} is not a non-empty list"]

    seen_ids = set()
    for i, f in enumerate(funds):
        missing = REQUIRED_FUND_FIELDS - f.keys()
        if missing:
            errors.append(f"funds[{i}] ({f.get('scheme_code')}) missing fields: {missing}")
        if f.get("market") not in ("IN", "US"):
            errors.append(f"funds[{i}] ({f.get('scheme_code')}) bad market: {f.get('market')!r}")
        if f.get("status") not in ("active", "closed"):
            errors.append(f"funds[{i}] ({f.get('scheme_code')}) bad status: {f.get('status')!r}")
        fid = f.get("id")
        if fid in seen_ids:
            errors.append(f"duplicate fund id: {fid}")
        seen_ids.add(fid)
        if f.get("status") == "active":
            nav = f.get("nav")
            if nav is not None and nav <= 0:
                errors.append(f"funds[{i}] ({f.get('scheme_code')}) active but nav <= 0: {nav}")
        if len(errors) > 50:
            errors.append("... truncated after 50 field-level errors")
            break
    return errors


def check_nav_files(sample_size: int = 200) -> list[str]:
    errors = []
    if not NAV_DIR.exists():
        return [f"{NAV_DIR} does not exist"]
    files = sorted(NAV_DIR.glob("*.json"))
    if not files:
        return [f"{NAV_DIR} contains no NAV history files"]
    for path in files[:sample_size]:
        history = load_json(path, default=None)
        if not isinstance(history, list) or not history:
            errors.append(f"{path.name}: not a non-empty list")
            continue
        prev_date = None
        for point in history:
            if not (isinstance(point, list) and len(point) == 2):
                errors.append(f"{path.name}: malformed point {point!r}")
                break
            d, nav = point
            if prev_date is not None and d <= prev_date:
                errors.append(f"{path.name}: dates not strictly increasing at {d}")
                break
            prev_date = d
            if not isinstance(nav, (int, float)) or nav <= 0:
                errors.append(f"{path.name}: non-positive NAV {nav!r} at {d}")
                break
    return errors


def check_meta_json() -> list[str]:
    errors = []
    meta = load_json(DATA_DIR / "meta.json", default=None)
    if meta is None:
        return [f"{DATA_DIR / 'meta.json'} does not exist"]
    if "jobs" not in meta:
        errors.append("meta.json missing 'jobs' key")
    return errors


def main() -> int:
    all_errors = []
    for name, fn in [("funds.json", check_funds_json), ("nav/*.json (sampled)", check_nav_files),
                      ("meta.json", check_meta_json)]:
        errs = fn()
        if errs:
            print(f"FAIL [{name}]:")
            for e in errs:
                print(f"  - {e}")
            all_errors.extend(errs)
        else:
            print(f"OK   [{name}]")

    if all_errors:
        print(f"\n{len(all_errors)} schema error(s) found.")
        return 1
    print("\nAll artifact schemas valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
