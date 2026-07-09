import { formatDate } from "@/lib/format";

export function FreshnessStamp({ navAsOf, holdingsAsOf }: { navAsOf?: string | null; holdingsAsOf?: string | null }) {
  return (
    <p className="tabular text-[12px] text-[var(--ink-soft)]">
      NAV as of {formatDate(navAsOf)}
      {holdingsAsOf ? ` · holdings as of ${formatDate(holdingsAsOf)}` : ""}
    </p>
  );
}
