# Decisions Log

Every judgment call not explicitly settled by the PRD / architecture doc / design doc /
build brief, in the order made. Newest at the bottom.

---

### 2026-07-09 — Project root location
Docs (`fund-screener-prd-v1.md`, `mfscreener-architecture.md`, etc.) reference `./docs`
as the doc folder and describe the app's own root as `mfscreener/`. In this workspace the
docs already live at `MF_Screener/Prd and Docs/` (one level up from the app). Rather than
duplicating the docs into the new project folder, the app root was created at
`MF_Screener/mfscreener/` and `Prd and Docs/` is treated as the `./docs` reference in all
prompts. Not duplicating avoids two copies of the spec drifting apart.

### 2026-07-09 — SP-2 test fund selection
Architecture doc §6 specifies "20 diverse funds" for the backfill spike without naming
them. Selected 19 (one AMC's exact fund name search failed and wasn't worth further time —
see spike report) spanning 17 AMCs and 7 categories (large/mid/small/flexi/value/sectoral/
index cap) to maximize diversity within the 2-evening timebox. Canonical Direct-Growth
plans only, per PRD's locked universe rule.

### 2026-07-09 — SP-2 factsheet cross-check source
Architecture doc's acceptance gate says "cross-check 20 random funds' 5Y CAGR against AMC
factsheets ±0.2pp." AMC factsheets are PDFs scattered across 15+ individual AMC websites,
not practically fetchable/parseable within the spike's timebox. Substituted Value
Research's live fund pages (same-date NAV + trailing-return figures) as the independent
reference for 4 of the 19 funds. This is a **one-time spike QA action**, not a pipeline
data source — it doesn't conflict with the PRD's "official sources only" rule, which
governs what data feeds the shipped product, not how a spike is validated. Flagging this
explicitly since it's an interpretation, not a literal reading of the acceptance gate.

### 2026-07-09 — SP-1 scope change: manual-by-default monthly file acquisition
See `pipeline/spikes/SPIKE_REPORT.md` for full detail. Architecture doc's
`holdings_monthly` job assumes automated fetch (deterministic-or-LLM-assist) is the
default and manual review is the fallback for AMCs that don't parse cleanly. Spike
evidence (WAF blocks, CAPTCHA gates, JS-rendered SPAs on HDFC/Nippon India/UTI/Kotak/SBI)
shows the harder problem is often acquiring the file at all, not parsing it — and that
problem doesn't yield to a smarter parser. **Decision: for v1, treat monthly file
acquisition as a manual step by default** (operator downloads each AMC's file by hand
once a month), and automate everything downstream of that (parsing, normalization,
validation). Revisit fetch automation (headless browser) only if manual acquisition
proves to be a real post-launch burden. This is a scope narrowing of "the pipeline IS the
product," not a scope cut of any PRD feature — X-ray still ships in v1, per PRD's own
stated fallback tolerance for R-2.

### 2026-07-09 — `api.mfapi.in` scheme-code resolution
The `/mf/search` endpoint proved unreliable (timeouts, false zero-results on legitimate
schemes) during SP-2. Decision: the `backfill` and `nav_daily` jobs must resolve scheme
codes once from AMFI's own scheme list (already the canonical source per architecture
§2.1) and cache them in `funds.json`/`securities.csv`, never call `/mf/search` from a
scheduled job. Only the per-scheme NAV-history endpoint (`/mf/{code}`) is load-bearing at
runtime, and it was 100% reliable in the spike.

### 2026-07-09 — Canonical India universe = all Open-Ended Direct-Growth schemes, not equity-only
PRD F-01 says the canonical universe is "Direct-Growth plan (~1,500 schemes)" without
saying whether that's equity-only or all AMFI categories. Live AMFI NAVAll.txt was
parsed and counted both ways: Open-Ended Direct-Growth across every AMFI category
(equity/debt/hybrid/index/ETF/FoF) = 1,744 rows (1,705 after excluding segregated
side-pocket schemes, see below); equity/hybrid/index only = 1,103. The former is far
closer to the PRD's stated "~1,500" figure. **Decision: include all Open-Ended
Direct-Growth schemes**, tagged with their real AMFI category/sub_category (parsed
directly from the NAVAll.txt section headers) so the screener's own category filter
does the narrowing a user wants (e.g. "Category = Equity"), matching the screener.in
model of covering everything and letting the user filter, rather than the product
pre-deciding what's "relevant."

### 2026-07-09 — Segregated ("side-pocket") schemes excluded from the universe
Real AMFI data surfaced 41 "segregated portfolio" scheme codes (side-pockets carved out
after an underlying bond default, e.g. Franklin India's 2020 credit-fund segregation).
These pass the Direct-Growth name filter but are not investable funds a screener user
would pick, and several report NAV 0.0000 permanently, which would otherwise trip the
NAV>0 validation gate on every run. Excluded by name-matching "segregated"/"seg.
portfolio" in `pipeline/jobs/common.py`'s exclusion list. Logged because this wasn't
anticipated in the architecture doc and is exactly the kind of real-world data mess the
build brief asks to surface rather than silently work around — recorded here instead of
silently, but the fix itself (exclude, don't fail) is mechanical enough not to need a
user decision.

### 2026-07-09 — Closed/wound-up schemes: soft-flag, don't fail the job
One live scheme (Tata Quant Fund - Direct Plan - Growth, code 147864) reports NAV
0.0000 with a stale date (2025-04-01, >1 year old) — a wound-up/merged fund per PRD F-02,
not a data anomaly. Decision: `nav_daily` treats NAV<=0 as "closed" (retain prior
last-good NAV, mark `status: "closed"`) only when the row's date is >10 days stale;
NAV<=0 on a fresh date still hard-fails the job as a genuine data-integrity problem. A
single closed fund must never be able to take down the entire daily pipeline run.

### 2026-07-09 — ETF price source substitution: Yahoo Finance chart API, not SEC/issuer
Architecture doc names "SEC/issuer price data" as the etf_daily source. In practice: SEC
EDGAR doesn't publish daily price series (only periodic filings), and Stooq (a common
free alternative) now sits behind a JS proof-of-work challenge that blocks simple HTTP
fetches — the same class of acquisition blocker SP-1 found for AMC holdings pages, just
on the ETF side. **Decision: use Yahoo Finance's public, unauthenticated chart endpoint**
(`query1.finance.yahoo.com/v8/finance/chart/{ticker}`), which redistributes real
exchange closing prices and worked cleanly for all 77 curated tickers in testing. This is
undocumented/unofficial and could change or block without notice — flagging this
explicitly as an accepted risk rather than a silent substitution, since "official sources
only" is a locked PRD business rule and this is a deviation from the architecture doc's
literal wording. Worth a conscious go/no-go from SG before this ships to production,
not just an implementation detail.

### 2026-07-09 — GitHub Actions: explicit `contents: write` permission required
First live `workflow_dispatch` run of `nav-daily.yml` failed at the push step:
"remote: Write access to repository not granted... 403." This repo's default
`GITHUB_TOKEN` permissions are read-only (current GitHub default for repos created
via the API/`gh`). Fixed by adding an explicit `permissions: contents: write` block to
each workflow — least-privilege and workflow-scoped, rather than changing the repo's
global Settings → Actions → Workflow permissions. Confirmed working on a second live run.

### 2026-07-09 — funds.json concurrent-write race (accepted, documented)
Testing both workflows via near-simultaneous manual `workflow_dispatch` runs surfaced a
real race: `nav_daily` and `etf_daily` each read the whole `funds.json`, rebuild it
(preserving the other market's records as they were at read-time), and write it back.
Two overlapping runs cause a git push race (fixed with a fetch/rebase/retry loop in each
workflow), but a *genuine* content collision on `funds.json` — both jobs changing the
same file in the same window — would still fail, and can't cleanly auto-merge because
`write_json_atomic` emits it minified (one line, so git can't line-diff a merge).
**Decision: accept this for v1.** The schedules are 5 hours apart (nav-daily 17:45 UTC,
etf-daily 22:30 UTC) specifically so this can't occur in normal scheduled operation —
it only appeared here because both were manually dispatched at once for testing. If
manual re-runs or additional jobs make this a real recurring problem post-launch, the
correct fix is splitting `funds.json` into `funds_in.json` + `funds_us.json` (or per-
market keys) so the two jobs never touch the same file — noted here rather than built
now, since it isn't a problem the documented schedule actually has.

### 2026-07-09 — Curated US ETF list (77 tickers)
PRD A4 scopes the ETF universe as "~75 curated ETFs," without naming them. Compiled a
77-ticker list (`pipeline/etf_universe.json`) spanning US broad-market, sector, factor,
international/regional (incl. India-focused: INDA, FLIN, INDY, EPI), bond, commodity,
dividend/income, and a couple of crypto-adjacent ETFs (BITO, IBIT) — chosen for breadth
across categories and high liquidity/name recognition, not backed by AUM-ranking data
(no free bulk ETF-AUM source was checked). Worth a sanity pass from SG before launch;
easy to add/remove tickers later since the list is just data, not code.

### 2026-07-09 — NAV history discontinuities: sanitize in backfill, isolate in nav_daily
Building the Phase 2 home page surfaced a bogus "67% 5Y return" on an Overnight Fund —
impossible for a cash-equivalent instrument. Root cause: `api.mfapi.in`'s historical
series contains face-value/denomination-change artifacts — clean ~10x or ~100x single-
day jumps (e.g. ₹116.47 → ₹1,164.89) with no real event behind them. A full scan found
**26 of 1,688 backfilled schemes** affected. Fix: `sanitize_nav_series()` in
`pipeline/jobs/common.py` splits a fund's history at any >50% single-day move and keeps
only the **most recent** segment (not the longest — the stored history's tail must match
today's live NAV scale, since `nav_daily` appends onto it daily; a longer-but-stale-scale
segment would silently break every future day-over-day check, which is exactly what
happened on the first attempt: the fix initially preferred the longest segment, which
broke `nav_daily` for a scheme whose most-recent segment was short. Corrected to always
prefer recency over length). All detected jumps are logged in `meta.json` under
`backfill.discontinuity_scheme_codes`, never silently dropped.
A second, distinct case surfaced the same day: scheme 118565 (Franklin India Short Term
Income Plan) has an AMFI-reported NAV date frozen at 02-May-2025 — over a year stale,
with a nonzero NAV — which the original "closed" detection (NAV≤0 AND stale) missed
entirely. Generalized: `nav_daily` now also treats **any scheme stale >60 days**
(regardless of NAV sign) as closed, carrying forward its last-good record.
A third case (scheme 120304, UTI Liquid Fund) hit a genuine same-scale rebase between
backfill's last mfapi.in datapoint and today's live AMFI value (~10x), which crashed the
*entire* `nav_daily` run under the original design — one anomalous scheme aborted the
whole job. Fixed: `nav_daily` now catches a per-scheme validation failure, flags it in
`meta.json.jobs.nav_daily.anomalies` with the reason, carries that fund's last-good
record forward unchanged, and continues processing every other scheme. A single bad
scheme must never take down the daily run for the other ~1,700 — this was already the
stated design intent for the "closed" case; it just hadn't been extended to the general
anomaly case until real data exposed the gap.
Also fixed in the same pass: `fetch_amfi_nav_all()` was decoding AMFI's UTF-8 file as
ISO-8859-1 (requests' guessed fallback, since AMFI doesn't declare a charset), mangling
apostrophes in scheme names ("Childrenâ€™s Fund" instead of "Children's Fund"). Now
decodes `r.content` as UTF-8 explicitly.

### 2026-07-09 — Build pinned to `next build --webpack`, not Turbopack (production bug)
After the first deploy, every single fund page 404'd — both on Vercel and locally via
`next start`. Root cause: `params` on `app/fund/[slug]/page.tsx` was typed and destructured
as a plain object (`{ params: { slug: string } }`), but this Next.js version requires
`params` to be a `Promise` (async params). Destructuring a Promise synchronously gives
`undefined` for `slug` at runtime, so every fund page's `getFund(undefined)` returned
nothing and hit `notFound()`. **The default `next build` (Turbopack) compiled this with
zero errors or warnings.** Only `next build --webpack` caught it, correctly, as a type
error ("Type '{ slug: string }' is missing... Promise"). Fixed the page to `await params`
per the async-params convention, and changed `package.json`'s `build` script to
`next build --webpack` explicitly so this class of bug can't silently ship again. This is
a real Turbopack production-build gap as of Next.js 16.2.10, not a one-off mistake worth
shrugging off — revisit pinning to webpack if a later Next.js version fixes it, but don't
drop the pin without re-verifying dynamic routes specifically.
