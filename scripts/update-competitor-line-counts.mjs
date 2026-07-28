/**
 * Refreshes src/lib/competitor-research/competitor-module-line-counts.ts from wc-style line counts.
 * Run from repo root: node scripts/update-competitor-line-counts.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const FILES = [
  "server/semrush/semrush-organic-competitors.js",
  "server/semrush/semrush-table-parse.js",
  "server/semrush/semrush-competitor-enrichment.js",
  "server/semrush/constants.js",
  "server/semrush-routes.js",
  "src/lib/competitor-research/types.ts",
  "src/lib/competitor-research/competitor-domain-key.ts",
  "src/lib/competitor-research/semrush-domain-overview-url.ts",
  "src/lib/competitor-research/competitor-semrush-client.ts",
  "src/lib/competitor-research/competitor-selection-filter.ts",
  "src/lib/competitor-research/competitor-gsc-queries.ts",
  "src/lib/competitor-research/competitor-keyword-sort.ts",
  "src/lib/competitor-research/competitor-keyword-site-relevance.ts",
  "src/lib/competitor-research/competitor-bulk-content-csv.ts",
  "src/lib/competitor-research/competitor-report-keyword-extract.ts",
  "src/lib/competitor-research/filter-competitors-by-gsc-relevance.ts",
  "src/lib/competitor-research/filter-main-competitor-rows.ts",
  "src/lib/competitor-research/competitor-tier-agent.ts",
  "src/lib/competitor-research/local-dominator-grid-parse.ts",
  "src/lib/competitor-research/competitor-grid-dfs-client.ts",
  "src/lib/competitor-research/competitor-grid-tier-merge.ts",
  "src/lib/competitor-research/competitor-report-openrouter-limits.ts",
  "src/lib/competitor-research/competitor-report-openrouter-payload-round.ts",
  "src/lib/competitor-research/competitor-report-wire-openrouter-keys.ts",
  "src/lib/competitor-research/competitor-report-openrouter.ts",
  "src/lib/competitor-research/competitor-report-json-parse.ts",
  "src/lib/competitor-research/competitor-report-system-prompt.ts",
  "src/lib/competitor-research/competitor-report-wire.ts",
  "src/lib/competitor-research/competitor-top-rows.ts",
  "src/lib/competitor-research/competitor-report-agent.ts",
  "src/lib/competitor-research/competitor-report-markdown-sanitize.ts",
  "src/lib/competitor-research/competitor-report-ekr-markdown.ts",
  "src/lib/competitor-research/competitor-report-appendix.ts",
  "src/lib/competitor-research/competitor-module-line-counts.ts",
  "src/components/research/competitor/CompetitorResearchTab.tsx",
  "src/components/research/competitor/CompetitorSiteGrid.tsx",
  "scripts/update-competitor-line-counts.mjs",
];

function lineCount(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

const rows = [];
for (const rel of FILES) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.warn("missing:", rel);
    rows.push({ path: rel, lines: 0 });
    continue;
  }
  rows.push({ path: rel.replace(/\\/g, "/"), lines: lineCount(abs) });
}

const outPath = path.join(root, "src/lib/competitor-research/competitor-module-line-counts.ts");
const body = `import type { CompetitorModuleLineCount } from "@/lib/competitor-research/types";

/**
 * Line counts per script - run \`node scripts/update-competitor-line-counts.mjs\` after edits.
 * Used in generated report appendix (must stay aligned with repo files).
 */
export const COMPETITOR_MODULE_LINE_COUNTS: CompetitorModuleLineCount[] = [
${rows.map((r) => `  { path: ${JSON.stringify(r.path)}, lines: ${r.lines} },`).join("\n")}
];
`;

fs.writeFileSync(outPath, body, "utf8");
console.log("Updated", outPath);
for (const r of rows) {
  console.log(`  ${r.lines}\t${r.path}`);
}
