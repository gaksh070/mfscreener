import Link from "next/link";
import { FundSearch } from "./fund-search";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-[var(--line)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1320px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="grid grid-cols-3 grid-rows-3 gap-[1px]" aria-hidden>
            {[0.2, 0.4, 0.6, 0.4, 0.6, 0.8, 0.6, 0.8, 1].map((o, i) => (
              <span key={i} className="h-[3px] w-[3px] bg-[var(--accent)]" style={{ opacity: o }} />
            ))}
          </span>
          <span className="text-[var(--accent)]">MF</span>
          <span className="text-[var(--ink)]">Screener</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[var(--ink)]">
          <Link href="/screen" className="hover:text-[var(--accent)]">
            Screener
          </Link>
          <Link href="/methodology" className="hover:text-[var(--accent)]">
            Methodology
          </Link>
          <FundSearch />
        </nav>
      </div>
    </header>
  );
}
