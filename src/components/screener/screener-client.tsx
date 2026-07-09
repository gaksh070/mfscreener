"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, FloppyDisk, Trash } from "@phosphor-icons/react";
import type { Fund } from "@/lib/types";
import { applyFilters, rankFiltersByElimination, type FilterRule } from "@/lib/filter-engine";
import { decodeScreen, encodeScreen, type Market } from "@/lib/url-codec";
import { describeFilter } from "@/lib/describe-filter";
import { listSavedScreens, saveScreen, deleteScreen, type SavedScreen } from "@/lib/local-screens";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { FilterBuilder } from "./filter-builder";
import { ResultsTable } from "./results-table";

const MARKET_OPTIONS: { value: Market; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "IN", label: "India" },
  { value: "US", label: "US" },
];

export function ScreenerClient({ funds }: { funds: Fund[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initial = useMemo(() => decodeScreen(searchParams.toString()), [searchParams]);
  const [market, setMarket] = useState<Market>(initial.market);
  const [rules, setRules] = useState<FilterRule[]>(initial.rules);
  const [notice, setNotice] = useState<string | null>(
    initial.invalid.length > 0 ? `Ignored invalid screen params: ${initial.invalid.join("; ")}` : null
  );
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [saveName, setSaveName] = useState("");
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([]);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    // One-time read of a client-only external store (localStorage) on mount —
    // deliberately not SSR'd, so a post-hydration setState here is correct,
    // not a synchronization anti-pattern the lint rule otherwise guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedScreens(listSavedScreens());
  }, []);

  const syncUrl = useCallback(
    (nextMarket: Market, nextRules: FilterRule[]) => {
      const qs = encodeScreen(nextMarket, nextRules);
      router.replace(`/screen${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router]
  );

  function updateRules(next: FilterRule[]) {
    setRules(next);
    syncUrl(market, next);
  }

  function updateMarket(next: Market) {
    setMarket(next);
    syncUrl(next, rules);
  }

  const marketFiltered = useMemo(() => {
    if (market === "both") return funds;
    return funds.filter((f) => f.market === market);
  }, [funds, market]);

  const results = useMemo(() => applyFilters(marketFiltered, rules), [marketFiltered, rules]);

  const eliminationRanking = useMemo(
    () => (results.length === 0 && rules.length > 0 ? rankFiltersByElimination(marketFiltered, rules) : []),
    [results.length, rules, marketFiltered]
  );

  async function handleCopyLink() {
    const qs = encodeScreen(market, rules);
    const url = `${window.location.origin}/screen${qs ? `?${qs}` : ""}`;
    await navigator.clipboard.writeText(url);
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 1500);
  }

  function handleSave() {
    if (!saveName.trim()) return;
    const qs = encodeScreen(market, rules);
    const res = saveScreen(saveName.trim(), qs);
    if (res.ok) {
      setSavedScreens(listSavedScreens());
      setSaveName("");
      setSaveNotice("Screen saved.");
    } else {
      setSaveNotice(res.reason ?? "Could not save screen.");
    }
    setTimeout(() => setSaveNotice(null), 2500);
  }

  function loadSavedScreen(screen: SavedScreen) {
    const decoded = decodeScreen(screen.query);
    setMarket(decoded.market);
    setRules(decoded.rules);
    syncUrl(decoded.market, decoded.rules);
  }

  function handleDeleteSaved(id: string) {
    deleteScreen(id);
    setSavedScreens(listSavedScreens());
  }

  return (
    <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-4">
        <div className="mfs-card p-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Market</p>
          <div className="flex gap-1">
            {MARKET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateMarket(opt.value)}
                className={`mfs-chip flex-1 px-2 py-1.5 text-[13px] font-medium ${
                  market === opt.value ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-alt)] text-[var(--ink)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <FilterBuilder disabled={rules.length >= 10} onAdd={(rule) => updateRules([...rules, rule])} />
        {rules.length >= 10 && (
          <p className="text-[12px] text-[var(--warn)]">Maximum of 10 active filters.</p>
        )}

        <div className="mfs-card p-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Save this screen
          </p>
          <div className="flex flex-col gap-2">
            <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Screen name" />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={handleSave} className="flex-1">
                <FloppyDisk size={14} />
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCopyLink} className="flex-1">
                {copyState === "copied" ? <Check size={14} /> : <Copy size={14} />}
                {copyState === "copied" ? "Copied" : "Copy link"}
              </Button>
            </div>
            {saveNotice && <p className="text-[12px] text-[var(--ink-soft)]">{saveNotice}</p>}
          </div>
        </div>

        {savedScreens.length > 0 && (
          <div className="mfs-card p-4">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
              Saved screens
            </p>
            <ul className="flex flex-col gap-1">
              {savedScreens.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <button onClick={() => loadSavedScreen(s)} className="truncate text-left hover:text-[var(--accent)]">
                    {s.name}
                  </button>
                  <button onClick={() => handleDeleteSaved(s.id)} aria-label={`Delete ${s.name}`}>
                    <Trash size={13} className="text-[var(--ink-soft)] hover:text-[var(--loss)]" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <section className="flex flex-col gap-3">
        {notice && (
          <div className="mfs-card flex items-center justify-between border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_8%,white)] p-3 text-[13px]">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {rules.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {rules.map((rule, i) => (
              <Chip key={i} onRemove={() => updateRules(rules.filter((_, idx) => idx !== i))}>
                {describeFilter(rule)}
              </Chip>
            ))}
            <button
              onClick={() => updateRules([])}
              className="text-[13px] text-[var(--ink-soft)] underline hover:text-[var(--accent)]"
            >
              Clear all
            </button>
          </div>
        )}

        <p className="tabular text-[13px] text-[var(--ink-soft)]">{results.length} funds match</p>

        {results.length === 0 ? (
          <div className="mfs-card p-6 text-center text-[14px] text-[var(--ink-soft)]">
            <p>No funds match.</p>
            {eliminationRanking.length > 0 && (
              <p className="mt-1">
                Your <strong>{describeFilter(eliminationRanking[0].rule)}</strong> filter removed the most funds (
                {eliminationRanking[0].eliminated}).
              </p>
            )}
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => updateRules([])}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="mfs-card overflow-hidden">
            <ResultsTable funds={results} />
          </div>
        )}
      </section>
    </div>
  );
}
