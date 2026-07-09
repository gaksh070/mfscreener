# MF Screener

Static-first mutual fund screener + portfolio X-ray for Indian DIY investors.
Full spec lives in `../Prd and Docs/` (PRD, architecture, design direction v1/v2,
build brief). `DECISIONS.md` at this root logs every judgment call made where
the docs didn't cover a case.

## Status

- **Phase 0 (spikes):** done — see `pipeline/spikes/SPIKE_REPORT.md`.
- **Phase 1 (pipeline & data):** pipeline jobs built and running against live
  data (1,705 canonical India schemes, 1,688 fully backfilled; 77 curated US
  ETFs). GitHub Actions workflows live at
  [github.com/gaksh070/mfscreener/actions](https://github.com/gaksh070/mfscreener/actions).
  The "5 consecutive scheduled runs" gate needs 5 real business days to elapse
  — it hasn't yet.
- **Phase 2+ (app, X-ray):** not started.

## Pipeline

```
pipeline/
├── jobs/
│   ├── common.py       # AMFI parsing, JSON I/O, return/rolling-return math
│   ├── validate.py      # validation gates (coverage, NAV sanity, day-over-day)
│   ├── nav_daily.py     # daily: AMFI NAVAll.txt -> funds.json + nav/*.json
│   ├── backfill.py       # one-time/manual: full history via api.mfapi.in
│   └── etf_daily.py      # daily: 77 curated US ETFs via Yahoo Finance chart API
├── etf_universe.json     # curated ETF list (data, not code — edit freely)
├── mappings/securities.csv  # ISIN normalization table, seeded Phase 3
├── spikes/                # Phase 0 spike scripts + report
└── validate_artifacts.py  # schema check: python -m pipeline.validate_artifacts
```

Run any job locally: `python -m pipeline.jobs.nav_daily` (from this directory,
with `pipeline/requirements.txt` installed).

## Known gaps (see DECISIONS.md for full detail)

- **Expense ratio, benchmark, inception date, exit load** are not sourced yet —
  AMFI's NAV file doesn't carry them, and AMFI's TER API
  (`amfiindia.com/ter-of-mf-schemes`) needs further reverse-engineering to
  automate. Currently null in `funds.json`.
- **Holdings acquisition (X-ray data)** is planned as a manual-monthly step for
  v1, not fully automated — see the SP-1 spike finding.
- **ETF prices** come from Yahoo Finance's unauthenticated chart API, not
  "SEC/issuer data" as the architecture doc names — flagged as a conscious
  substitution pending SG sign-off.
