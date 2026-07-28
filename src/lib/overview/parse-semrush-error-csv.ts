import Papa from "papaparse";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import { overviewRowInBulkScope } from "@/lib/overview/overview-bulk-row-scope";

export { overviewBulkRowIndices, overviewRowInBulkScope } from "@/lib/overview/overview-bulk-row-scope";

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseSemrushErrorCsv(text: string): Set<string> {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  const header =
    parsed.meta.fields?.find((h) => normalizeHeaderKey(h) === "page url") ??
    parsed.meta.fields?.[0] ??
    "";
  const keys = new Set<string>();
  for (const row of parsed.data) {
    const cell = String(row[header] ?? "").trim();
    if (cell) keys.add(normalizePageUrlKey(cell));
  }
  return keys;
}

export function semrushIssueLabelFromFilename(name: string): string {
  return name.toLowerCase().includes("title") ? "title" : "meta";
}

export function overviewRowIndexMatchesSemrushFilter(
  url: string,
  keys: Set<string> | null,
): boolean {
  if (!keys) return true;
  return overviewRowInBulkScope(url, keys);
}
