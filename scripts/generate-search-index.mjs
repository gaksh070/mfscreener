// Emits a trimmed public/search-index.json from data/funds.json for the
// client-side global fund search (Cmd-K). Kept as a static asset (not an API
// route) to stay static-first -- no function invocation per search keystroke.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const funds = JSON.parse(fs.readFileSync(path.join(root, "data", "funds.json"), "utf-8"));

const index = funds
  .filter((f) => f.status === "active")
  .map((f) => ({ slug: f.slug, name: f.name, amc: f.amc, market: f.market }));

fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "search-index.json"), JSON.stringify(index));
console.log(`Wrote public/search-index.json (${index.length} funds)`);
