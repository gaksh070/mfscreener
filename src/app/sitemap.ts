import type { MetadataRoute } from "next";
import { loadFunds } from "@/lib/data";

const BASE_URL = "https://mfscreener.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const funds = loadFunds();
  const fundEntries = funds.map((f) => ({
    url: `${BASE_URL}/fund/${f.slug}`,
    lastModified: f.nav_date ?? undefined,
  }));

  return [
    { url: BASE_URL },
    { url: `${BASE_URL}/screen` },
    { url: `${BASE_URL}/methodology` },
    ...fundEntries,
  ];
}
