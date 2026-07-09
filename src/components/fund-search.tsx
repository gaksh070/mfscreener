"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface IndexEntry {
  slug: string;
  name: string;
  amc: string | null;
  market: "IN" | "US";
}

export function FundSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<IndexEntry[] | null>(null);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (open && !index) {
      fetch("/search-index.json")
        .then((r) => r.json())
        .then(setIndex)
        .catch(() => setIndex([]));
    }
  }, [open, index]);

  const results = useMemo(() => {
    if (!index || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return index.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 20);
  }, [index, query]);

  function goTo(slug: string) {
    setOpen(false);
    setQuery("");
    router.push(`/fund/${slug}`);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="flex h-9 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white px-3 text-[13px] text-[var(--ink-soft)] hover:bg-[var(--bg-alt)]"
          aria-label="Search funds"
        >
          <MagnifyingGlass size={14} />
          <span className="hidden sm:inline">Search funds</span>
          <kbd className="hidden rounded bg-[var(--bg-alt)] px-1.5 py-0.5 text-[11px] sm:inline">⌘K</kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20" />
        <Dialog.Content className="fixed left-1/2 top-24 z-50 w-[90vw] max-w-[480px] -translate-x-1/2 rounded-[12px] border border-[var(--line)] bg-white shadow-lg">
          <Dialog.Title className="sr-only">Search funds</Dialog.Title>
          <div className="border-b border-[var(--line)] p-3">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by fund name…"
              className="w-full text-[14px] outline-none"
            />
          </div>
          <ul className="max-h-[360px] overflow-y-auto p-1">
            {results.map((f) => (
              <li key={f.slug}>
                <button
                  onClick={() => goTo(f.slug)}
                  className="flex w-full flex-col items-start rounded-[8px] px-3 py-2 text-left text-[13px] hover:bg-[var(--accent-soft)]"
                >
                  <span>{f.name}</span>
                  <span className="text-[12px] text-[var(--ink-soft)]">{f.amc}</span>
                </button>
              </li>
            ))}
            {query.trim().length >= 2 && results.length === 0 && (
              <li className="px-3 py-4 text-center text-[13px] text-[var(--ink-soft)]">No funds found.</li>
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
