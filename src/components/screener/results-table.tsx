"use client";

import Link from "next/link";
import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import type { Fund } from "@/lib/types";
import { formatCrore, formatNav, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "name" | "returns.y1" | "returns.y3" | "returns.y5" | "expense_ratio" | "aum";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Fund", align: "left" },
  { key: "returns.y1", label: "1Y", align: "right" },
  { key: "returns.y3", label: "3Y", align: "right" },
  { key: "returns.y5", label: "5Y", align: "right" },
  { key: "expense_ratio", label: "ER", align: "right" },
  { key: "aum", label: "AUM", align: "right" },
];

function getSortValue(fund: Fund, key: SortKey): number | string {
  if (key === "name") return fund.name;
  if (key === "expense_ratio") return fund.expense_ratio ?? -Infinity;
  if (key === "aum") return fund.aum ?? -Infinity;
  const [, period] = key.split(".") as [string, "y1" | "y3" | "y5"];
  return fund.returns[period] ?? -Infinity;
}

export function ResultsTable({ funds }: { funds: Fund[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("returns.y5");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...funds].sort((a, b) => {
    const av = getSortValue(a, sortKey);
    const bv = getSortValue(b, sortKey);
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="data-density overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-14 z-10 bg-[var(--bg-alt)]">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={cn(
                  "cursor-pointer whitespace-nowrap border-b border-[var(--line)] px-3 py-2 text-[12px] font-medium text-[var(--ink-soft)]",
                  col.align === "right" ? "text-right" : "text-left"
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key &&
                    (sortDir === "asc" ? (
                      <CaretUp size={11} weight="bold" />
                    ) : (
                      <CaretDown size={11} weight="bold" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((fund) => (
            <tr key={fund.id} className="border-b border-[var(--line)] hover:bg-[var(--bg-alt)]">
              <td className="px-3 py-2">
                <Link href={`/fund/${fund.slug}`} className="text-[var(--ink)] hover:text-[var(--accent)]">
                  {fund.name}
                </Link>
                <p className="text-[12px] text-[var(--ink-soft)]">
                  {fund.sub_category ?? fund.category ?? "—"}
                </p>
              </td>
              <td className={cn("tabular px-3 py-2 text-right", returnColor(fund.returns.y1))}>
                {formatPercent(fund.returns.y1)}
              </td>
              <td className={cn("tabular px-3 py-2 text-right", returnColor(fund.returns.y3))}>
                {formatPercent(fund.returns.y3)}
              </td>
              <td className={cn("tabular px-3 py-2 text-right", returnColor(fund.returns.y5))}>
                {formatPercent(fund.returns.y5)}
              </td>
              <td className="tabular px-3 py-2 text-right">{formatPercent(fund.expense_ratio, 2)}</td>
              <td className="tabular px-3 py-2 text-right">
                {fund.market === "IN" ? formatCrore(fund.aum) : formatNav(fund.aum, "USD")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function returnColor(value: number | null): string {
  if (value === null) return "";
  return value >= 0 ? "text-[var(--gain)]" : "text-[var(--loss)]";
}
