import type { Fund } from "./types";

export type FilterOp = "gt" | "lt" | "between" | "in";

export interface FilterRule {
  field: string; // dot-path into Fund, e.g. "returns.y5", "rolling.y5.avg", "category"
  op: FilterOp;
  value: number | string | [number, number] | string[];
}

export const FILTER_FIELDS: { field: string; label: string; type: "number" | "string" }[] = [
  { field: "category", label: "Category", type: "string" },
  { field: "sub_category", label: "Sub-category", type: "string" },
  { field: "amc", label: "AMC", type: "string" },
  { field: "expense_ratio", label: "Expense ratio (%)", type: "number" },
  { field: "aum", label: "AUM", type: "number" },
  { field: "nav", label: "NAV", type: "number" },
  { field: "returns.y1", label: "1Y return (%)", type: "number" },
  { field: "returns.y3", label: "3Y return (%)", type: "number" },
  { field: "returns.y5", label: "5Y return (%)", type: "number" },
  { field: "rolling.y3.avg", label: "3Y rolling avg (%)", type: "number" },
  { field: "rolling.y3.min", label: "3Y rolling min (%)", type: "number" },
  { field: "rolling.y3.pct_above_8", label: "3Y rolling % above 8%", type: "number" },
  { field: "rolling.y5.avg", label: "5Y rolling avg (%)", type: "number" },
  { field: "rolling.y5.min", label: "5Y rolling min (%)", type: "number" },
  { field: "rolling.y5.pct_above_8", label: "5Y rolling % above 8%", type: "number" },
];

/** Dot-path field access. Returns undefined/null for any missing hop, never throws. */
export function getField(fund: Fund, field: string): unknown {
  const parts = field.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = fund;
  for (const p of parts) {
    if (cur === null || cur === undefined) return null;
    cur = cur[p];
  }
  return cur;
}

/** A fund whose field value is null/undefined never matches an active filter
 * on that field (fails closed) — per architecture §5: "funds younger than
 * window ... excluded from that filter rather than treated as 0." Applied
 * generally to any null field, not just rolling-return windows. */
function matchesRule(fund: Fund, rule: FilterRule): boolean {
  const raw = getField(fund, rule.field);
  if (raw === null || raw === undefined) return false;

  switch (rule.op) {
    case "gt": {
      if (typeof raw !== "number" || typeof rule.value !== "number") return false;
      return raw > rule.value;
    }
    case "lt": {
      if (typeof raw !== "number" || typeof rule.value !== "number") return false;
      return raw < rule.value;
    }
    case "between": {
      if (typeof raw !== "number" || !Array.isArray(rule.value) || rule.value.length !== 2) return false;
      const [lo, hi] = rule.value as [number, number];
      return raw >= lo && raw <= hi;
    }
    case "in": {
      if (!Array.isArray(rule.value)) return false;
      const options = (rule.value as string[]).map((v) => v.toLowerCase());
      return typeof raw === "string" && options.includes(raw.toLowerCase());
    }
    default:
      return false;
  }
}

/** AND-composes all rules. Empty rule list returns the full input unchanged
 * (the "no filters -> full universe" screener default). Max 10 active
 * filters is a UI-level constraint (PRD F-01), not enforced here. */
export function applyFilters(funds: Fund[], rules: FilterRule[]): Fund[] {
  if (rules.length === 0) return funds;
  return funds.filter((f) => rules.every((r) => matchesRule(f, r)));
}

/** For the empty-result "which filter removed the most funds" hint (PRD F-01
 * edge case). Returns rules sorted by how many funds *fail* each one in
 * isolation, most-eliminating first. */
export function rankFiltersByElimination(
  funds: Fund[],
  rules: FilterRule[]
): { rule: FilterRule; eliminated: number }[] {
  return rules
    .map((rule) => ({
      rule,
      eliminated: funds.length - funds.filter((f) => matchesRule(f, rule)).length,
    }))
    .sort((a, b) => b.eliminated - a.eliminated);
}
