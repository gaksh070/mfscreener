import Link from "next/link";
import { loadMeta } from "@/lib/data";
import { FreshnessStamp } from "./freshness-stamp";

export function SiteFooter() {
  const meta = loadMeta() as { nav_asof?: string; holdings_asof?: string };
  return (
    <footer className="border-t border-[var(--line)] py-8">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-6 text-[13px] text-[var(--ink-soft)]">
        <p>Educational purposes only — not investment advice.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/methodology" className="hover:text-[var(--accent)]">
            Methodology
          </Link>
          <Link href="/methodology#data-sources" className="hover:text-[var(--accent)]">
            Data sources
          </Link>
          <span>·</span>
          <FreshnessStamp navAsOf={meta.nav_asof} holdingsAsOf={meta.holdings_asof} />
        </div>
        <p>
          From the maker of{" "}
          <a
            href="https://fixurnetworth.com"
            className="hover:text-[var(--accent)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            fixurnetworth.com
          </a>
        </p>
      </div>
    </footer>
  );
}
