/** Phase 2 gate: "10 predefined test screens return verified results," run
 * against the real committed data/funds.json — not a fixture. */
import { describe, expect, it } from "vitest";
import { loadFunds } from "./data";
import { applyFilters, type FilterRule } from "./filter-engine";

const funds = loadFunds().filter((f) => f.status === "active");

function run(rules: FilterRule[]) {
  return applyFilters(funds, rules);
}

describe("10 predefined test screens against live data/funds.json", () => {
  it("1. no filters returns the full active universe", () => {
    expect(run([])).toHaveLength(funds.length);
    expect(funds.length).toBeGreaterThan(1000); // sanity: real universe, not a stub
  });

  it("2. category = Equity Scheme returns only that category", () => {
    const results = run([{ field: "category", op: "in", value: ["Equity Scheme"] }]);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((f) => f.category === "Equity Scheme")).toBe(true);
  });

  it("3. sub_category = Mid Cap Fund AND 5Y return > 15% satisfies both conditions", () => {
    const results = run([
      { field: "sub_category", op: "in", value: ["Mid Cap Fund"] },
      { field: "returns.y5", op: "gt", value: 15 },
    ]);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((f) => f.sub_category === "Mid Cap Fund" && (f.returns.y5 ?? -Infinity) > 15)).toBe(true);
  });

  it("4. 5Y return > 20% returns a strict subset, all matching", () => {
    const results = run([{ field: "returns.y5", op: "gt", value: 20 }]);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThan(funds.length);
    expect(results.every((f) => (f.returns.y5 ?? -Infinity) > 20)).toBe(true);
  });

  it("5. market = US via pre-filtering returns only US ETFs", () => {
    const usFunds = funds.filter((f) => f.market === "US");
    const results = applyFilters(usFunds, [{ field: "sub_category", op: "in", value: ["US Large Cap"] }]);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((f) => f.market === "US")).toBe(true);
  });

  it("6. AUM filter on India funds returns 0 results (documents the known AUM data gap, doesn't crash)", () => {
    const results = run([{ field: "aum", op: "between", value: [1000, 20000] }]);
    expect(results).toHaveLength(0);
  });

  it("7. expense_ratio filter returns 0 results (documents the known ER data gap, doesn't crash)", () => {
    const results = run([{ field: "expense_ratio", op: "lt", value: 0.5 }]);
    expect(results).toHaveLength(0);
  });

  it("8. rolling 5Y min > 8% returns only funds meeting that bar, nulls excluded not coerced", () => {
    const results = run([{ field: "rolling.y5.min", op: "gt", value: 8 }]);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((f) => (f.rolling.y5?.min ?? -Infinity) > 8)).toBe(true);
    // every result must actually have a non-null y5 rolling stat
    expect(results.every((f) => f.rolling.y5 !== null)).toBe(true);
  });

  it("9. AMC = HDFC Mutual Fund returns only that AMC's funds", () => {
    const results = run([{ field: "amc", op: "in", value: ["HDFC Mutual Fund"] }]);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((f) => f.amc === "HDFC Mutual Fund")).toBe(true);
  });

  it("10. combined AND: category=Equity Scheme + rolling 3Y avg > 12% narrows correctly", () => {
    const broader = run([{ field: "category", op: "in", value: ["Equity Scheme"] }]);
    const narrower = run([
      { field: "category", op: "in", value: ["Equity Scheme"] },
      { field: "rolling.y3.avg", op: "gt", value: 12 },
    ]);
    expect(narrower.length).toBeGreaterThan(0);
    expect(narrower.length).toBeLessThan(broader.length);
    expect(narrower.every((f) => f.category === "Equity Scheme" && (f.rolling.y3?.avg ?? -Infinity) > 12)).toBe(
      true
    );
  });
});
