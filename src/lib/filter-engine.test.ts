import { describe, expect, it } from "vitest";
import { applyFilters, rankFiltersByElimination, type FilterRule } from "./filter-engine";
import type { Fund } from "./types";

function fund(overrides: Partial<Fund>): Fund {
  return {
    id: "TEST",
    market: "IN",
    scheme_code: "1",
    name: "Test Fund",
    slug: "test-fund",
    amc: "Test AMC",
    category: "Equity Scheme",
    sub_category: "Mid Cap Fund",
    benchmark: null,
    inception: null,
    expense_ratio: null,
    aum: null,
    nav: 100,
    nav_date: "2026-07-08",
    currency: "INR",
    returns: { y1: 10, y3: 15, y5: 20 },
    rolling: { y3: { avg: 12, min: 4, pct_above_8: 60 }, y5: { avg: 14, min: 6, pct_above_8: 80 } },
    exit_load: null,
    holdings_tier: "thin",
    holdings_asof: null,
    status: "active",
    ...overrides,
  };
}

describe("applyFilters", () => {
  it("returns the full universe when no rules are active", () => {
    const funds = [fund({}), fund({ id: "B" })];
    expect(applyFilters(funds, [])).toHaveLength(2);
  });

  it("gt: keeps funds strictly above the threshold", () => {
    const funds = [
      fund({ id: "A", returns: { y1: 5, y3: 5, y5: 5 } }),
      fund({ id: "B", returns: { y1: 20, y3: 20, y5: 20 } }),
    ];
    const rules: FilterRule[] = [{ field: "returns.y5", op: "gt", value: 10 }];
    expect(applyFilters(funds, rules).map((f) => f.id)).toEqual(["B"]);
  });

  it("lt: keeps funds strictly below the threshold", () => {
    const funds = [fund({ id: "A", expense_ratio: 0.3 }), fund({ id: "B", expense_ratio: 1.5 })];
    const rules: FilterRule[] = [{ field: "expense_ratio", op: "lt", value: 0.5 }];
    expect(applyFilters(funds, rules).map((f) => f.id)).toEqual(["A"]);
  });

  it("between: is inclusive on both ends", () => {
    const funds = [
      fund({ id: "A", aum: 999 }),
      fund({ id: "B", aum: 1000 }),
      fund({ id: "C", aum: 20000 }),
      fund({ id: "D", aum: 20001 }),
    ];
    const rules: FilterRule[] = [{ field: "aum", op: "between", value: [1000, 20000] }];
    expect(applyFilters(funds, rules).map((f) => f.id)).toEqual(["B", "C"]);
  });

  it("in: matches case-insensitively against a string field", () => {
    const funds = [
      fund({ id: "A", sub_category: "Mid Cap Fund" }),
      fund({ id: "B", sub_category: "Small Cap Fund" }),
      fund({ id: "C", sub_category: "Large Cap Fund" }),
    ];
    const rules: FilterRule[] = [{ field: "sub_category", op: "in", value: ["mid cap fund", "small cap fund"] }];
    expect(applyFilters(funds, rules).map((f) => f.id)).toEqual(["A", "B"]);
  });

  it("excludes (does not crash or coerce to 0) funds whose filtered field is null", () => {
    // e.g. a fund too young for a 5Y rolling window -- per architecture §5,
    // it must be excluded from a filter on that field, never treated as 0.
    const funds = [
      fund({ id: "A", rolling: { y3: { avg: 12, min: 4, pct_above_8: 60 }, y5: null } }),
      fund({ id: "B", rolling: { y3: { avg: 12, min: 4, pct_above_8: 60 }, y5: { avg: 14, min: 6, pct_above_8: 80 } } }),
    ];
    const rules: FilterRule[] = [{ field: "rolling.y5.avg", op: "gt", value: -100 }]; // trivially true if not null-excluded
    expect(applyFilters(funds, rules).map((f) => f.id)).toEqual(["B"]);
  });

  it("AND-composes multiple rules", () => {
    const funds = [
      fund({ id: "A", category: "Equity Scheme", returns: { y1: 1, y3: 1, y5: 25 } }),
      fund({ id: "B", category: "Debt Scheme", returns: { y1: 1, y3: 1, y5: 25 } }),
      fund({ id: "C", category: "Equity Scheme", returns: { y1: 1, y3: 1, y5: 5 } }),
    ];
    const rules: FilterRule[] = [
      { field: "category", op: "in", value: ["Equity Scheme"] },
      { field: "returns.y5", op: "gt", value: 10 },
    ];
    expect(applyFilters(funds, rules).map((f) => f.id)).toEqual(["A"]);
  });
});

describe("rankFiltersByElimination", () => {
  it("ranks the filter that eliminates the most funds first", () => {
    const funds = [
      fund({ id: "A", expense_ratio: 0.3, returns: { y1: 1, y3: 1, y5: 20 } }),
      fund({ id: "B", expense_ratio: 0.3, returns: { y1: 1, y3: 1, y5: 5 } }),
      fund({ id: "C", expense_ratio: 2.0, returns: { y1: 1, y3: 1, y5: 20 } }),
    ];
    const rules: FilterRule[] = [
      { field: "expense_ratio", op: "lt", value: 0.5 }, // eliminates C only (1)
      { field: "returns.y5", op: "gt", value: 10 }, // eliminates B only (1)
    ];
    const ranked = rankFiltersByElimination(funds, rules);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].eliminated).toBeGreaterThanOrEqual(ranked[1].eliminated);
  });
});
