import type { FilterOp, FilterRule } from "./filter-engine";

/** Short codes keep shared URLs readable, matching the architecture doc's own
 * example (`?v=1&f=er.lt.0.5,cat.in.midcap`). Bidirectional map. */
const FIELD_ALIAS: Record<string, string> = {
  category: "cat",
  sub_category: "subcat",
  amc: "amc",
  expense_ratio: "er",
  aum: "aum",
  nav: "nav",
  "returns.y1": "ret1",
  "returns.y3": "ret3",
  "returns.y5": "ret5",
  "rolling.y3.avg": "r3avg",
  "rolling.y3.min": "r3min",
  "rolling.y3.pct_above_8": "r3pct8",
  "rolling.y5.avg": "r5avg",
  "rolling.y5.min": "r5min",
  "rolling.y5.pct_above_8": "r5pct8",
};
const ALIAS_TO_FIELD: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_ALIAS).map(([field, alias]) => [alias, field])
);

const OP_ALIAS: Record<FilterOp, string> = { gt: "gt", lt: "lt", between: "bw", in: "in" };
const ALIAS_TO_OP: Record<string, FilterOp> = { gt: "gt", lt: "lt", bw: "between", in: "in" };

export const SCREEN_QUERY_VERSION = 1;
export type Market = "IN" | "US" | "both";

export interface DecodedScreen {
  version: number;
  market: Market;
  rules: FilterRule[];
  invalid: string[]; // human-readable descriptions of segments that were dropped
}

function encodeValue(rule: FilterRule): string {
  if (rule.op === "between") {
    const [lo, hi] = rule.value as [number, number];
    return `${lo}-${hi}`;
  }
  if (rule.op === "in") {
    return (rule.value as string[]).join("|");
  }
  return String(rule.value);
}

function decodeValue(op: FilterOp, raw: string): FilterRule["value"] | null {
  if (op === "between") {
    const m = raw.match(/^(-?[\d.]+)-(-?[\d.]+)$/);
    if (!m) return null;
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    if (Number.isNaN(lo) || Number.isNaN(hi)) return null;
    return [lo, hi];
  }
  if (op === "in") {
    return raw.split("|").filter(Boolean);
  }
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

/** Encodes market + filter rules into a query string (no leading `?`). */
export function encodeScreen(market: Market, rules: FilterRule[]): string {
  const params = new URLSearchParams();
  params.set("v", String(SCREEN_QUERY_VERSION));
  if (market !== "both") params.set("mkt", market);
  if (rules.length > 0) {
    const encoded = rules
      .map((r) => {
        const alias = FIELD_ALIAS[r.field];
        if (!alias) return null;
        return `${alias}.${OP_ALIAS[r.op]}.${encodeValue(r)}`;
      })
      .filter((s): s is string => s !== null)
      .join(",");
    if (encoded) params.set("f", encoded);
  }
  return params.toString();
}

/** Decodes a query string. Unknown version, unknown fields/ops, or malformed
 * values are dropped individually (never throws) — per F-05 edge case:
 * "ignore invalid, apply valid, notify via toast." */
export function decodeScreen(search: string): DecodedScreen {
  const params = new URLSearchParams(search);
  const invalid: string[] = [];

  const versionRaw = params.get("v");
  const version = versionRaw ? Number(versionRaw) : SCREEN_QUERY_VERSION;
  if (version !== SCREEN_QUERY_VERSION) {
    invalid.push(`unsupported screen version "${versionRaw}"`);
  }

  const mktRaw = params.get("mkt");
  let market: Market = "both";
  if (mktRaw === "IN" || mktRaw === "US") {
    market = mktRaw;
  } else if (mktRaw) {
    invalid.push(`unknown market "${mktRaw}"`);
  }

  const rules: FilterRule[] = [];
  const fRaw = params.get("f");
  if (fRaw) {
    for (const segment of fRaw.split(",")) {
      if (!segment) continue;
      const [alias, opAlias, ...rest] = segment.split(".");
      const valueRaw = rest.join(".");
      const field = ALIAS_TO_FIELD[alias];
      const op = ALIAS_TO_OP[opAlias];
      if (!field || !op) {
        invalid.push(`unrecognized filter "${segment}"`);
        continue;
      }
      const value = decodeValue(op, valueRaw);
      if (value === null) {
        invalid.push(`malformed value in filter "${segment}"`);
        continue;
      }
      rules.push({ field, op, value });
    }
  }

  return { version, market, rules, invalid };
}
