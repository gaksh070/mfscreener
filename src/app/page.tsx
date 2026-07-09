import Link from "next/link";
import { loadFunds } from "@/lib/data";
import { Button } from "@/components/ui/button";

const SAMPLE_SCREENS = [
  { label: "Low-cost midcaps", qs: "v=1&f=subcat.in.Mid Cap Fund,er.lt.0.75" },
  { label: "5Y rolling floor > 10%", qs: "v=1&f=r5min.gt.10" },
  { label: "Small AUM, high 5Y return", qs: "v=1&f=ret5.gt.15" },
];

export default function HomePage() {
  const funds = loadFunds();
  const inCount = funds.filter((f) => f.market === "IN" && f.status === "active").length;
  const usCount = funds.filter((f) => f.market === "US").length;
  const sample = [...funds]
    .filter((f) => f.status === "active" && f.returns.y5 !== null)
    .sort((a, b) => (b.returns.y5 ?? 0) - (a.returns.y5 ?? 0))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight">
            Screen every Indian mutual fund on YOUR criteria. Not ours.
          </h1>
          <p className="tabular mt-3 text-[15px] text-[var(--ink-soft)]">
            {inCount.toLocaleString("en-IN")} funds · {usCount} US ETFs · official data · no distribution agenda
          </p>
          <div className="mt-5 flex gap-3">
            <Button asChild>
              <Link href="/screen">Open screener</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/methodology">Methodology</Link>
            </Button>
          </div>

          <div className="mt-8">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
              Try a screen
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_SCREENS.map((s) => (
                <Link
                  key={s.label}
                  href={`/screen?${s.qs}`}
                  className="mfs-chip bg-[var(--accent-soft)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent)] hover:opacity-80"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mfs-card p-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Top 5 funds by 5Y return
          </p>
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-[12px] text-[var(--ink-soft)]">
                <th className="pb-1 text-left font-normal">Fund</th>
                <th className="pb-1 text-right font-normal">5Y</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((f) => (
                <tr key={f.id} className="border-t border-[var(--line)]">
                  <td className="py-1.5">
                    <Link href={`/fund/${f.slug}`} className="hover:text-[var(--accent)]">
                      {f.name.length > 42 ? `${f.name.slice(0, 42)}…` : f.name}
                    </Link>
                  </td>
                  <td className="tabular py-1.5 text-right text-[var(--gain)]">{f.returns.y5?.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
