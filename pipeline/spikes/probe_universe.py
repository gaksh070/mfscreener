import re

path = "/tmp/NAVAll.txt"

EXCLUDE_TERMS = ["idcw", "dividend", "bonus", "ideal", "-daily", " daily ", "weekly", "monthly re",
                 "quarterly", "annual idcw", "payout", "reinvest", "income distribution"]

def is_direct_growth(name):
    n = name.lower()
    if "direct" not in n:
        return False
    if "growth" not in n:
        return False
    for t in EXCLUDE_TERMS:
        if t in n:
            return False
    return True

current_scheme_group = None  # e.g. "Open Ended Schemes(Equity Scheme - Mid Cap Fund)"
rows = []
with open(path, encoding="utf-8", errors="replace") as f:
    for line in f:
        line = line.rstrip("\n").strip()
        if not line:
            continue
        if line.startswith("Open Ended Schemes(") or line.startswith("Close Ended Schemes(") or line.startswith("Interval Fund Schemes("):
            current_scheme_group = line
            continue
        if line.startswith("Scheme Code;"):
            continue
        parts = line.split(";")
        if len(parts) == 6 and re.match(r"^\d+$", parts[0]):
            scheme_code, isin_g, isin_d, name, nav, date = parts
            rows.append({
                "scheme_code": scheme_code, "name": name, "nav": nav, "date": date,
                "group": current_scheme_group,
            })

print(f"Total data rows: {len(rows)}")

open_ended = [r for r in rows if r["group"] and r["group"].startswith("Open Ended")]
print(f"Open-ended rows: {len(open_ended)}")

direct_growth = [r for r in open_ended if is_direct_growth(r["name"])]
print(f"Open-ended Direct-Growth rows (all categories incl. debt/ETF/FoF): {len(direct_growth)}")

# equity + hybrid + index only (closer to PRD's screener-relevant universe)
def relevant_category(group):
    g = group.lower()
    return any(k in g for k in ["equity scheme", "hybrid scheme", "hybrid schemes", "index funds", "elss"])

equity_hybrid_index = [r for r in direct_growth if relevant_category(r["group"])]
print(f"...of which Equity/Hybrid/Index Direct-Growth: {len(equity_hybrid_index)}")

# breakdown by group
from collections import Counter
c = Counter(r["group"] for r in direct_growth)
for g, n in sorted(c.items(), key=lambda x: -x[1]):
    print(f"  {n:5d}  {g}")

# sample a few names to eyeball cleanliness of the filter
print("\nSample Direct-Growth names:")
for r in direct_growth[:10]:
    print(" ", r["scheme_code"], r["name"], "|", r["nav"], r["date"])
