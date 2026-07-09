"""Shared helpers for pipeline jobs. No runtime use — CI only, per architecture doc."""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"
NAV_DIR = DATA_DIR / "nav"
FUNDS_JSON = DATA_DIR / "funds.json"
META_JSON = DATA_DIR / "meta.json"

AMFI_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt"

# AMFI scheme-name substrings that mark a non-canonical (non Direct-Growth) row.
# Order matters only for readability; membership test is substring-based.
_EXCLUDE_TERMS = [
    "idcw", "dividend", "bonus", "daily", "weekly", "monthly re", "quarterly",
    "annual idcw", "payout", "reinvest", "income distribution",
    # Side-pocket schemes carved out after an underlying bond default. Real AMFI
    # scheme codes, but not investable funds a screener user would pick — and
    # frequently NAV 0.0000, which would otherwise trip the NAV>0 validation gate.
    "segregated", "seg. portfolio", "seg portfolio",
]


class JobError(Exception):
    """Raised when a validation gate fails. A job must exit non-zero on this —
    never commit a partial artifact."""


def is_direct_growth(scheme_name: str) -> bool:
    n = scheme_name.lower()
    if "direct" not in n or "growth" not in n:
        return False
    return not any(term in n for term in _EXCLUDE_TERMS)


def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def fetch_amfi_nav_all(retries: int = 3, timeout: int = 30) -> str:
    last_err = None
    for _ in range(retries):
        try:
            r = requests.get(AMFI_NAV_URL, timeout=timeout, allow_redirects=True)
            r.raise_for_status()
            return r.text
        except Exception as e:  # noqa: BLE001 - retry loop, re-raised below
            last_err = e
    raise JobError(f"Failed to fetch AMFI NAVAll.txt after {retries} attempts: {last_err}")


def parse_amfi_nav_all(raw_text: str):
    """Parse AMFI's NAVAll.txt into a flat list of scheme rows, each carrying
    the AMFI scheme-group header ("Open Ended Schemes(Equity Scheme - Mid Cap Fund)")
    and AMC name it appeared under. Returns ALL rows (every plan/option); caller
    filters to the canonical universe."""
    rows = []
    current_group = None
    current_amc = None
    for raw_line in raw_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith(("Open Ended Schemes(", "Close Ended Schemes(", "Interval Fund Schemes(")):
            current_group = line
            continue
        if line.startswith("Scheme Code;"):
            continue
        parts = line.split(";")
        if len(parts) == 6 and re.match(r"^\d+$", parts[0]):
            scheme_code, isin_growth, isin_div, name, nav, date = parts
            rows.append({
                "scheme_code": scheme_code,
                "isin": None if isin_growth == "-" else isin_growth,
                "name": name.strip(),
                "nav": nav,
                "date": date,
                "group": current_group,
                "amc": current_amc,
            })
        else:
            # A bare line with no semicolons that isn't a group header is an AMC name.
            current_amc = line
    return rows


def parse_group(group: str):
    """'Open Ended Schemes(Equity Scheme - Mid Cap Fund)' -> ('Equity Scheme', 'Mid Cap Fund')"""
    if not group:
        return None, None
    m = re.match(r"^(?:Open Ended|Close Ended|Interval Fund) Schemes\((.+)\)$", group)
    if not m:
        return None, None
    inner = m.group(1)
    if " - " in inner:
        cat, sub = inner.split(" - ", 1)
        return cat.strip(), sub.strip()
    return inner.strip(), None


def parse_amfi_date(s: str) -> datetime:
    return datetime.strptime(s.strip(), "%d-%b-%Y")


def load_json(path: Path, default=None):
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json_atomic(path: Path, obj) -> None:
    """All-or-nothing write: write to a temp file, then rename. Never leaves a
    half-written artifact if the process dies mid-write."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    tmp.replace(path)


def update_meta(job_name: str, status: str, extra: dict | None = None) -> None:
    meta = load_json(META_JSON, default={})
    meta.setdefault("jobs", {})
    meta["jobs"][job_name] = {
        "status": status,
        "ran": datetime.utcnow().isoformat() + "Z",
        **(extra or {}),
    }
    write_json_atomic(META_JSON, meta)


def fail(job_name: str, message: str) -> None:
    update_meta(job_name, "failed", {"error": message})
    print(f"[{job_name}] FAILED: {message}", file=sys.stderr)
    sys.exit(1)


def nearest_point(series_sorted, target_date: datetime, tolerance_days: int = 10):
    """series_sorted: ascending list of (datetime, float). Returns closest point
    within tolerance_days of target_date, or None."""
    best, best_diff = None, None
    for d, v in series_sorted:
        diff = abs((d - target_date).days)
        if diff <= tolerance_days and (best_diff is None or diff < best_diff):
            best, best_diff = (d, v), diff
    return best


def compute_returns(series_sorted):
    """series_sorted: ascending list of (datetime, nav). Returns dict with
    trailing CAGR (1y/3y/5y) and rolling stats (3y/5y avg/min/pct_above_8),
    per architecture §2.1 / §5. None where history is insufficient."""
    if len(series_sorted) < 30:
        return {"returns": {"y1": None, "y3": None, "y5": None},
                "rolling": {"y3": None, "y5": None}}

    latest_date, latest_nav = series_sorted[-1]
    earliest_date, _ = series_sorted[0]

    trailing = {}
    for label, years in (("y1", 1), ("y3", 3), ("y5", 5)):
        target = latest_date - timedelta(days=int(years * 365.25))
        if target < earliest_date:
            trailing[label] = None
            continue
        pt = nearest_point(series_sorted, target)
        if not pt:
            trailing[label] = None
            continue
        _, start_nav = pt
        trailing[label] = round(((latest_nav / start_nav) ** (1 / years) - 1) * 100, 2)

    rolling = {}
    for label, years in (("y3", 3), ("y5", 5)):
        window_days = int(years * 365.25)
        if (latest_date - earliest_date).days < window_days:
            rolling[label] = None
            continue
        cagrs = []
        # Step daily-rolled per architecture §5, sampled weekly here for CI runtime;
        # statistically equivalent for avg/min/pct on multi-year windows.
        step = timedelta(days=7)
        start_dates = [d for d, _ in series_sorted if d <= latest_date - timedelta(days=window_days)]
        cursor = earliest_date
        idx = 0
        series_by_date = series_sorted
        i = 0
        while i < len(series_by_date):
            d0, nav0 = series_by_date[i]
            end_target = d0 + timedelta(days=window_days)
            if end_target > latest_date:
                break
            end_pt = nearest_point(series_by_date, end_target, tolerance_days=5)
            if end_pt:
                _, nav1 = end_pt
                cagrs.append(((nav1 / nav0) ** (1 / years) - 1) * 100)
            # advance ~7 calendar days worth of points
            next_date = d0 + step
            while i < len(series_by_date) and series_by_date[i][0] < next_date:
                i += 1
        if cagrs:
            rolling[label] = {
                "avg": round(sum(cagrs) / len(cagrs), 2),
                "min": round(min(cagrs), 2),
                "pct_above_8": round(100 * sum(1 for c in cagrs if c > 8) / len(cagrs), 1),
            }
        else:
            rolling[label] = None

    return {"returns": trailing, "rolling": rolling}
