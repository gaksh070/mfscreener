function businessDaysStale(navDate: string | null): number {
  if (!navDate) return Infinity;
  const then = new Date(navDate);
  const now = new Date();
  const ms = now.getTime() - then.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function StaleBanner({ navDate }: { navDate: string | null }) {
  const daysStale = businessDaysStale(navDate);
  if (daysStale <= 2) return null;
  const severe = daysStale > 5;
  return (
    <div
      className={`mfs-card border-l-4 p-3 text-[13px] ${
        severe ? "border-l-[var(--loss)] bg-[color-mix(in_srgb,var(--loss)_6%,white)]" : "border-l-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_8%,white)]"
      }`}
    >
      NAV data is {daysStale} days old and may be stale.
    </div>
  );
}

export function ClosedSchemeBanner() {
  return (
    <div className="mfs-card border-l-4 border-l-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_8%,white)] p-3 text-[13px]">
      This scheme has been merged, wound up, or closed. Data shown reflects the last available NAV.
    </div>
  );
}
