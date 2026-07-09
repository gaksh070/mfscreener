# Phase 0 Spike Report

Run once, live, against real public endpoints (mfapi.in, AMC websites) on 2026-07-09.
Scripts: `sp2_nav_backfill.py` (+ `sp2_test_funds.json`, `sp2_results.json`). SP-1 had no
surviving deterministic parser code to check in — see below for why.

---

## SP-2 (R-3): Is a free historical-NAV source reliable enough to backfill rolling returns?

**Method:** Picked 19 diverse Direct-Growth schemes across 17 AMCs and 7 categories
(large/mid/small/flexi/value/sectoral/index). Pulled full NAV history for each from
`api.mfapi.in` (the MFAPI-style source named in the architecture doc), computed trailing
1Y/3Y/5Y CAGR client-side, then cross-checked 4 of them (HDFC Mid Cap, Parag Parikh Flexi
Cap, SBI Small Cap, Tata Digital India) against Value Research's live fund pages as an
independent same-date reference.

**Result: PASS, comfortably.**
- 19/19 funds backfilled successfully — no missing schemes, no zero/negative NAVs, no
  day-over-day discontinuities. History depth ranged 9.6–13.5 years, 2,370–3,326 NAV points.
- All 4 spot-checks matched NAV to the exact rupee-and-paise and 5Y CAGR within **0.01
  percentage points** — an order of magnitude inside the ±0.2pp acceptance gate:

  | Fund | Our 5Y CAGR | Independent 5Y CAGR (same date) | Diff |
  |---|---|---|---|
  | HDFC Mid Cap Fund – Direct Growth | 20.34% | 20.33% | 0.01pp |
  | Parag Parikh Flexi Cap – Direct Growth | 14.29% | 14.28% | 0.01pp |
  | SBI Small Cap Fund – Direct Growth | 14.67% | 14.66% | 0.01pp |
  | Tata Digital India Fund – Direct Growth | 6.45% | 6.45% | exact |

- One caveat worth flagging: `api.mfapi.in`'s `/mf/search` endpoint is flaky —
  intermittent read-timeouts and several legitimate schemes (SBI, Kotak, Canara Robeco,
  Franklin's older-named funds) returned zero results on plausible queries, forcing manual
  query reformulation. The **per-scheme NAV-history endpoint** (`/mf/{code}`), which is what
  the actual `backfill` and `nav_daily` jobs depend on, was 100% reliable across all 19
  fetches. Recommendation: resolve scheme codes once (via AMFI's own scheme-code list, not
  the search endpoint) and cache them in `securities.csv`/`funds.json`; don't depend on
  `/mf/search` at runtime or in scheduled jobs.

**Go/no-go: GO.** Rolling returns ship in v1 as scoped.

---

## SP-1 (R-2): Can top-15 AMCs' monthly disclosures be parsed to ≥95% holdings coverage?

**Method:** Attempted to locate and fetch the actual monthly full-portfolio-disclosure
files (not factsheets) for a sample of major AMCs (HDFC, SBI, ICICI Prudential, Nippon
India, UTI, Kotak, Axis, PPFAS) using plain HTTP requests — deliberately the same class of
tooling a GitHub Actions job would use (no browser, no persistent session).

**Result: the spike surfaced a blocker one step earlier than the architecture doc
anticipated.** The doc scoped the risk as *parsing* heterogeneous formats. In practice,
for roughly half the AMCs sampled, the harder problem is **acquiring the file at all**:

| AMC | What happened |
|---|---|
| HDFC | Statutory-disclosure listing page → **403** (WAF/bot-protection). A *different*, directly-linked file on `files.hdfcfund.com` fetched fine (200) — but direct file URLs aren't discoverable without first loading the (blocked) listing page in a real browser. |
| Nippon India | **403** on two separate paths. |
| UTI | Page is gated behind ShieldSquare/PerimeterX-style CAPTCHA (`captcha.perfdrive.com`) — unfetchable without solving a JS challenge. |
| Kotak | Loads (200) but is a client-side-rendered SPA shell with no content in the raw HTML — download links are constructed by JS after an API call, invisible to `curl`. |
| ICICI Prudential | Redirects (307) between `www.` and `archive.` subdomains; didn't resolve to real content in the time available. |
| SBI | Base domain and portfolio page both return 200, but the actual portfolio page is also client-rendered — no static download links present. |
| PPFAS | Guessed URL 404'd; didn't locate the correct path in the time available. |

Only one real portfolio-adjacent file was successfully downloaded and opened (a weekly
debt-summary workbook from HDFC's file bucket — not the actual monthly equity holdings
file, since that link isn't reachable without the blocked listing page). Even that single
file confirms the format-heterogeneity concern the architecture doc raised: legacy binary
`.xls`, five sheets per workbook, a metadata/title row before the real header, and a
multi-row spanning header — not something a single generic parser handles across AMCs.

I could not verify the ≥45-of-top-50-funds coverage number — the sample never got past
acquisition for most AMCs, so there's no evidence either way on parse-ability itself.

**Why this matters for the architecture doc:** §3's `holdings_monthly` job is described as
"fetch per-AMC → parse (deterministic or LLM-assist) → normalize." The fetch step was
implicitly assumed to be a plain HTTP GET. For a majority of the AMCs sampled, it isn't —
it requires either a headless browser (Playwright, to execute the JS and pass bot checks)
or a human clicking through the site once a month. A headless-browser fetch step run
unattended in GitHub Actions is itself a fragility risk (bot-protection services are
explicitly designed to detect and block exactly that pattern), which compounds the R-4
"pipeline rot" fear rather than relieving it.

**Go/no-go: CONDITIONAL GO, with a scope change.**
X-ray still ships in v1 — the PRD's own fallback tolerance already covers this ("accept
semi-manual monthly review (~2–4 hrs) as explicit operating cost in v1"). But the
recommendation is to make that manual step wider than the architecture doc implies:

- Treat **monthly file acquisition as manual-by-default for v1** (operator visits each
  AMC's disclosure page once a month, downloads the file by hand — a one-person task
  robust to WAFs/CAPTCHAs/SPAs in a way automation is not) rather than "automated fetch,
  manual fallback only for the AMCs that fail." Budget ~30–45 min/month for this alone,
  on top of the parsing-side review time the PRD already budgets.
- Automate everything *after* the file is in hand: parsing (deterministic per-AMC where
  the format is stable, LLM-assist per architecture §4 where it isn't), normalization via
  `securities.csv`, and validation gates — this part is genuinely scriptable and doesn't
  depend on bypassing any AMC's bot protection.
- Revisit fetch automation (headless browser) only if the manual step proves to be a real
  operational burden post-launch — not a Phase-1 dependency.

This changes `holdings_monthly`'s framing from "scheduled job, alert on failure" to
"scheduled *parse* job triggered after a manual monthly file drop," which the graceful-
staleness design already accommodates (holdings staleness banner is driven by
`meta.json.holdings_asof` regardless of how the file arrived).
