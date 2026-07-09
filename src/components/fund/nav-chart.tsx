"use client";

import { useMemo, useState } from "react";
import type { NavPoint } from "@/lib/data";
import { formatDate } from "@/lib/format";

const RANGES = [
  { key: "1y", label: "1Y", days: 365 },
  { key: "3y", label: "3Y", days: 365 * 3 },
  { key: "5y", label: "5Y", days: 365 * 5 },
  { key: "max", label: "Max", days: Infinity },
] as const;

const WIDTH = 640;
const HEIGHT = 160;
const PADDING = 8;

export function NavChart({ history, currency }: { history: NavPoint[]; currency: "INR" | "USD" }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("3y");

  const sliced = useMemo(() => {
    if (history.length === 0) return [];
    const days = RANGES.find((r) => r.key === range)?.days ?? Infinity;
    if (days === Infinity) return history;
    const cutoff = new Date(history[history.length - 1][0]);
    cutoff.setDate(cutoff.getDate() - days);
    return history.filter(([d]) => new Date(d) >= cutoff);
  }, [history, range]);

  if (sliced.length < 2) {
    return <p className="text-[13px] text-[var(--ink-soft)]">Not enough history for this range.</p>;
  }

  const values = sliced.map(([, v]) => v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = sliced.map(([, v], i) => {
    const x = PADDING + (i / (sliced.length - 1)) * (WIDTH - PADDING * 2);
    const y = HEIGHT - PADDING - ((v - min) / span) * (HEIGHT - PADDING * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const symbol = currency === "INR" ? "₹" : "$";

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="NAV history chart">
        <polyline points={points.join(" ")} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
      </svg>
      <div className="mt-1 flex justify-between text-[12px] text-[var(--ink-soft)]">
        <span className="tabular">
          {symbol}
          {min.toFixed(2)}
        </span>
        <span className="tabular">
          {symbol}
          {max.toFixed(2)}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`mfs-chip px-2.5 py-1 text-[12px] font-medium ${
              range === r.key ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-alt)] text-[var(--ink)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
        {formatDate(sliced[0][0])} – {formatDate(sliced[sliced.length - 1][0])}
      </p>
    </div>
  );
}
