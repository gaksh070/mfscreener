import type { Metadata } from "next";
import { TopNav } from "@/components/nav";
import { SiteFooter } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MF Screener — mutual fund screener for Indian DIY investors",
    template: "%s · MF Screener",
  },
  description:
    "Screen Indian mutual funds and curated US ETFs on your own criteria — rolling returns, expense ratio, AUM. Official data, no distribution agenda.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <TopNav />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
