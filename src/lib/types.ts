export interface RollingStats {
  avg: number;
  min: number;
  pct_above_8: number;
}

export interface Fund {
  id: string;
  market: "IN" | "US";
  scheme_code: string;
  name: string;
  slug: string;
  amc: string | null;
  category: string | null;
  sub_category: string | null;
  benchmark: string | null;
  inception: string | null;
  expense_ratio: number | null;
  aum: number | null;
  nav: number | null;
  nav_date: string | null;
  currency: "INR" | "USD";
  returns: { y1: number | null; y3: number | null; y5: number | null };
  rolling: { y3: RollingStats | null; y5: RollingStats | null };
  exit_load: string | null;
  holdings_tier: "full" | "thin";
  holdings_asof: string | null;
  status: "active" | "closed";
}
