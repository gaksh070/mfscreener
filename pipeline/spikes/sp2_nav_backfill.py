import requests, json, time
from pathlib import Path
from datetime import datetime, timedelta

HERE = Path(__file__).parent
IN = HERE / "sp2_test_funds.json"
OUT = HERE / "sp2_results.json"

with open(IN) as f:
    candidates = json.load(f)

def fetch_history(scheme_code, retries=4):
    for i in range(retries):
        try:
            r = requests.get(f"https://api.mfapi.in/mf/{scheme_code}", timeout=25)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if i == retries - 1:
                return {"error": str(e)}
            time.sleep(2)

def parse_date(s):
    return datetime.strptime(s, "%d-%m-%Y")

def nearest_nav(data_sorted, target_date, tolerance_days=7):
    # data_sorted: list of (date, nav) ascending by date
    best = None
    best_diff = None
    for d, n in data_sorted:
        diff = abs((d - target_date).days)
        if diff <= tolerance_days and (best_diff is None or diff < best_diff):
            best, best_diff = (d, n), diff
    return best

results = []
for c in candidates:
    sc = c["schemeCode"]
    print(f"Fetching {sc} {c['schemeName']}...")
    js = fetch_history(sc)
    if "error" in js or "data" not in js:
        results.append({**c, "status": "FETCH_FAILED", "error": js.get("error", "no data")})
        continue
    meta = js.get("meta", {})
    raw = js["data"]  # list of {"date": "dd-mm-yyyy", "nav": "123.45"}, typically descending by date
    series = []
    for row in raw:
        try:
            d = parse_date(row["date"])
            n = float(row["nav"])
            if n > 0:
                series.append((d, n))
        except Exception:
            continue
    series.sort(key=lambda x: x[0])
    if len(series) < 30:
        results.append({**c, "status": "INSUFFICIENT_HISTORY", "n_points": len(series)})
        continue

    latest_date, latest_nav = series[-1]
    earliest_date, earliest_nav = series[0]
    history_years = (latest_date - earliest_date).days / 365.25

    entry = {**c, "status": "OK", "amfi_scheme_type": meta.get("scheme_type"),
              "amfi_scheme_category": meta.get("scheme_category"),
              "n_nav_points": len(series),
              "earliest_date": earliest_date.strftime("%Y-%m-%d"),
              "latest_date": latest_date.strftime("%Y-%m-%d"),
              "latest_nav": latest_nav,
              "history_years": round(history_years, 2)}

    for label, years in [("y1", 1), ("y3", 3), ("y5", 5)]:
        target = latest_date - timedelta(days=int(years * 365.25))
        if target < earliest_date:
            entry[f"cagr_{label}"] = None
            entry[f"cagr_{label}_note"] = "insufficient history"
            continue
        pair = nearest_nav(series, target, tolerance_days=10)
        if not pair:
            entry[f"cagr_{label}"] = None
            entry[f"cagr_{label}_note"] = "no NAV near target date"
            continue
        start_date, start_nav = pair
        cagr = ((latest_nav / start_nav) ** (1 / years) - 1) * 100
        entry[f"cagr_{label}"] = round(cagr, 2)
        entry[f"cagr_{label}_start_date"] = start_date.strftime("%Y-%m-%d")
        entry[f"cagr_{label}_start_nav"] = start_nav

    results.append(entry)
    time.sleep(0.4)

with open(OUT, "w") as f:
    json.dump(results, f, indent=2)

ok = [r for r in results if r["status"] == "OK"]
print(f"\n{len(ok)}/{len(results)} funds successfully backfilled with computed CAGR.")
for r in ok:
    print(f"{r['amc']:20s} {r['category']:10s} 1Y={r.get('cagr_y1')}  3Y={r.get('cagr_y3')}  5Y={r.get('cagr_y5')}  hist={r['history_years']}y  pts={r['n_nav_points']}")
for r in results:
    if r["status"] != "OK":
        print(f"FAIL: {r['amc']} {r['schemeName']} -> {r['status']} {r.get('error','')}")
