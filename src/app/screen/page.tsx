import { Suspense } from "react";
import type { Metadata } from "next";
import { loadFunds } from "@/lib/data";
import { ScreenerClient } from "@/components/screener/screener-client";

export const metadata: Metadata = {
  title: "Screener",
  description: "Build your own custom screen across Indian mutual funds and curated US ETFs.",
};

export default function ScreenPage() {
  const funds = loadFunds().filter((f) => f.status === "active");
  return (
    <Suspense>
      <ScreenerClient funds={funds} />
    </Suspense>
  );
}
