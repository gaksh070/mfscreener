import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { loadFunds, loadNavHistory } from "@/lib/data";
import { formatCrore, formatDate, formatNav, formatPercent } from "@/lib/format";
import { NavChart } from "@/components/fund/nav-chart";
import { ClosedSchemeBanner, StaleBanner } from "@/components/fund/stale-banner";
import { FreshnessStamp } from "@/components/freshness-stamp";
import { Button } from "@/components/ui/button";

export function generateStaticParams() {
  return loadFunds().map((f) => ({ slug: f.slug }));
}

function getFund(slug: string) {
  return loadFunds().find((f) => f.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const fund = getFund(slug);
  if (!fund) return {};
  return {
    title: fund.name,
    description: `${fund.name} — NAV, trailing returns, rolling returns, expense ratio and facts. ${
      fund.category ?? ""
    } ${fund.sub_category ?? ""}`.trim(),
  };
}

export default async function FundPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fund = getFund(slug);
  if (!fund) notFound();

  const history = loadNavHistory(fund.scheme_code);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    name: fund.name,
    category: fund.sub_category ?? fund.category ?? undefined,
    provider: { "@type": "Organization", name: fund.amc ?? undefined },
  };

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold leading-tight">{fund.name}</h1>
          <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
            {[fund.sub_category ?? fund.category, fund.amc].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/screen">Back to screener</Link>
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[14px]">
        <span className="tabular font-medium">{formatNav(fund.nav, fund.currency)}</span>
        <span className="tabular text-[var(--ink-soft)]">AUM {fund.market === "IN" ? formatCrore(fund.aum) : formatNav(fund.aum, "USD")}</span>
      </div>
      <div className="mt-1">
        <FreshnessStamp navAsOf={fund.nav_date} holdingsAsOf={fund.holdings_asof} />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {fund.status === "closed" && <ClosedSchemeBanner />}
        {fund.status === "active" && <StaleBanner navDate={fund.nav_date} />}
      </div>

      <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="mfs-card p-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            NAV history
          </p>
          <NavChart history={history} currency={fund.currency} />
        </div>

        <div className="mfs-card p-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Trailing returns
          </p>
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-[12px] text-[var(--ink-soft)]">
                <th className="pb-1 text-left font-normal">Period</th>
                <th className="pb-1 text-right font-normal">Return (CAGR)</th>
              </tr>
            </thead>
            <tbody>
              {(["y1", "y3", "y5"] as const).map((p) => (
                <tr key={p} className="border-t border-[var(--line)]">
                  <td className="py-1.5">{p.replace("y", "")}Y</td>
                  <td className={`tabular py-1.5 text-right ${returnColor(fund.returns[p])}`}>
                    {formatPercent(fund.returns[p])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Rolling returns
          </p>
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-[12px] text-[var(--ink-soft)]">
                <th className="pb-1 text-left font-normal">Window</th>
                <th className="pb-1 text-right font-normal">Avg</th>
                <th className="pb-1 text-right font-normal">Min</th>
                <th className="pb-1 text-right font-normal">% &gt; 8%</th>
              </tr>
            </thead>
            <tbody>
              {(["y3", "y5"] as const).map((p) => {
                const r = fund.rolling[p];
                return (
                  <tr key={p} className="border-t border-[var(--line)]">
                    <td className="py-1.5">{p.replace("y", "")}Y</td>
                    <td className="tabular py-1.5 text-right">{r ? formatPercent(r.avg) : "–"}</td>
                    <td className="tabular py-1.5 text-right">{r ? formatPercent(r.min) : "–"}</td>
                    <td className="tabular py-1.5 text-right">{r ? formatPercent(r.pct_above_8, 0) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 mfs-card p-4">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Facts</p>
        <dl className="grid grid-cols-2 gap-y-2 text-[14px] sm:grid-cols-3">
          <Fact label="Expense ratio" value={formatPercent(fund.expense_ratio, 2)} />
          <Fact label="Exit load" value={fund.exit_load ?? "–"} />
          <Fact label="Inception" value={formatDate(fund.inception)} />
          <Fact label="Benchmark" value={fund.benchmark ?? "–"} />
          <Fact label="ISIN / ID" value={fund.id} />
          <Fact label="Status" value={fund.status === "active" ? "Active" : "Closed"} />
        </dl>
      </section>

      <section className="mt-6 mfs-card p-4 text-[13px] text-[var(--ink-soft)]">
        {fund.holdings_tier === "full" ? (
          <p>Holdings breakdown coming soon.</p>
        ) : (
          <p>
            Holdings, sector allocation, and market-cap split are tracked for the most-held funds and curated ETFs
            — see the <Link href="/methodology" className="underline hover:text-[var(--accent)]">methodology page</Link>.
            This fund&apos;s NAV history, returns, and rolling returns above are complete and independently sourced
            regardless of holdings-tracking status.
          </p>
        )}
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--ink-soft)]">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function returnColor(value: number | null): string {
  if (value === null) return "";
  return value >= 0 ? "text-[var(--gain)]" : "text-[var(--loss)]";
}
