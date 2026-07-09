import type { Metadata } from "next";
import { loadMeta } from "@/lib/data";
import { FreshnessStamp } from "@/components/freshness-stamp";

export const metadata: Metadata = {
  title: "Methodology",
  description: "Data sources, calculation methodology, and known limitations behind MF Screener.",
};

export default function MethodologyPage() {
  const meta = loadMeta() as { nav_asof?: string; holdings_asof?: string };
  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <h1 className="text-[28px] font-bold">Methodology</h1>
      <FreshnessStamp navAsOf={meta.nav_asof} holdingsAsOf={meta.holdings_asof} />

      <section className="mt-6">
        <h2 className="text-[18px] font-semibold">Educational purposes only</h2>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          Nothing on this site is investment advice or a recommendation to buy or sell any fund. MF Screener has
          no distribution relationship with any AMC and earns nothing from where you invest.
        </p>
      </section>

      <section id="data-sources" className="mt-6">
        <h2 className="text-[18px] font-semibold">Data sources</h2>
        <ul className="mt-2 list-disc pl-5 text-[14px] text-[var(--ink-soft)]">
          <li>NAV: AMFI&apos;s official daily NAV file (NAVAll.txt), refreshed on business days.</li>
          <li>
            Historical NAV (for rolling returns): a free historical-NAV API, backfilled once and validated against
            independently reported returns within ±0.2 percentage points.
          </li>
          <li>US ETF prices: daily exchange closing prices for a curated list of ~75 ETFs.</li>
          <li>Holdings, sector, and market-cap data: not yet available (planned).</li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-[18px] font-semibold">Canonical universe</h2>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          Indian mutual funds: Direct-Growth plans only, across all open-ended AMFI categories. Regular-plan and
          IDCW/dividend variants are excluded, as are segregated (side-pocket) schemes. US ETFs: a curated list, not
          the full US ETF universe.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-[18px] font-semibold">Returns &amp; rolling returns</h2>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          Trailing 1Y/3Y/5Y returns are CAGR computed from the closest available NAV to each anniversary date.
          Rolling 3Y/5Y returns are computed by stepping through the fund&apos;s full NAV history and computing the
          CAGR of every available window of that length, then reporting the average, minimum, and the percentage
          of windows that returned more than 8% annualized. Funds younger than a window are excluded from that
          statistic — shown as &ldquo;–&rdquo;, never treated as 0%.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-[18px] font-semibold">Known gaps</h2>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          Expense ratio, benchmark, inception date, and exit load are not yet sourced and show as &ldquo;–&rdquo;.
          AUM is not yet sourced for Indian funds. These are tracked as open work, not silently estimated.
        </p>
      </section>
    </div>
  );
}
