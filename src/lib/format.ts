export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "–";
  return `${value.toFixed(digits)}%`;
}

export function formatCrore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return `₹${value.toLocaleString("en-IN")} Cr`;
}

export function formatNav(value: number | null | undefined, currency: "INR" | "USD"): string {
  if (value === null || value === undefined) return "–";
  const symbol = currency === "INR" ? "₹" : "$";
  return `${symbol}${value.toFixed(2)}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
