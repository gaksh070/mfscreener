import { describe, expect, it } from "vitest";
import { decodeScreen, encodeScreen } from "./url-codec";
import type { FilterRule } from "./filter-engine";

describe("encodeScreen / decodeScreen round-trip", () => {
  it("round-trips gt/lt/between/in rules and market", () => {
    const rules: FilterRule[] = [
      { field: "expense_ratio", op: "lt", value: 0.5 },
      { field: "returns.y5", op: "gt", value: 15 },
      { field: "aum", op: "between", value: [1000, 20000] },
      { field: "sub_category", op: "in", value: ["Mid Cap Fund", "Small Cap Fund"] },
    ];
    const qs = encodeScreen("IN", rules);
    const decoded = decodeScreen(qs);
    expect(decoded.market).toBe("IN");
    expect(decoded.invalid).toEqual([]);
    expect(decoded.rules).toEqual(rules);
  });

  it("defaults to market=both when omitted", () => {
    const qs = encodeScreen("both", []);
    expect(decodeScreen(qs).market).toBe("both");
  });

  it("drops unknown fields/ops without throwing, and reports them", () => {
    const decoded = decodeScreen("v=1&f=bogusfield.gt.5,er.zz.5,er.lt.0.5");
    expect(decoded.rules).toEqual([{ field: "expense_ratio", op: "lt", value: 0.5 }]);
    expect(decoded.invalid).toHaveLength(2);
  });

  it("drops malformed values without throwing", () => {
    const decoded = decodeScreen("v=1&f=er.lt.notanumber,aum.bw.1000-abc");
    expect(decoded.rules).toEqual([]);
    expect(decoded.invalid).toHaveLength(2);
  });

  it("flags an unsupported version but still parses valid filters", () => {
    const decoded = decodeScreen("v=99&f=er.lt.0.5");
    expect(decoded.invalid.some((s) => s.includes("version"))).toBe(true);
    expect(decoded.rules).toEqual([{ field: "expense_ratio", op: "lt", value: 0.5 }]);
  });

  it("produces a readable, versioned query string", () => {
    const qs = encodeScreen("IN", [{ field: "category", op: "in", value: ["Equity Scheme"] }]);
    expect(qs).toContain("v=1");
    expect(qs).toContain("mkt=IN");
  });
});
