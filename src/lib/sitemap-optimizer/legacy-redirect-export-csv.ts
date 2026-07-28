import { buildRankMathRedirectCsv } from "@/lib/rank-math-redirect-csv";
import type { LegacyRedirectMatchRow } from "@/lib/sitemap-optimizer/types";

function normalizeExportUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    let path = u.pathname.replace(/\/+/g, "/");
    if (!path.endsWith("/")) path += "/";
    return `${u.origin}${path}`;
  } catch {
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  }
}

export function buildLegacyRedirectRankMathCsv(rows: readonly LegacyRedirectMatchRow[]): string {
  const redirectRows = rows.map((row) => ({
    source: normalizeExportUrl(row.legacyUrl),
    destination: normalizeExportUrl(row.destinationUrl),
  }));
  return buildRankMathRedirectCsv(redirectRows);
}

export function legacyRedirectExportFilename(siteName: string): string {
  const slug =
    siteName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "site";
  const date = new Date().toISOString().slice(0, 10);
  return `legacy-redirects-${slug}-${date}.csv`;
}
