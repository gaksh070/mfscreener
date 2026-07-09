import fs from "node:fs";
import path from "node:path";
import type { Fund } from "./types";

let cache: Fund[] | null = null;

/** Reads the committed data/funds.json artifact. Server-only (fs), per the
 * static-first architecture — never fetched at runtime, always baked into
 * the SSG build. */
export function loadFunds(): Fund[] {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "data", "funds.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  cache = JSON.parse(raw) as Fund[];
  return cache;
}

export function loadMeta(): Record<string, unknown> {
  const filePath = path.join(process.cwd(), "data", "meta.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

export function findFundBySlug(slug: string): Fund | undefined {
  return loadFunds().find((f) => f.slug === slug);
}

export type NavPoint = [string, number]; // [iso date, nav]

export function loadNavHistory(schemeCode: string): NavPoint[] {
  const filePath = path.join(process.cwd(), "data", "nav", `${schemeCode}.json`);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as NavPoint[];
}
