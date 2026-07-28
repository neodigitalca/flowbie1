import { buildRankMathRedirectCsv } from "@/lib/rank-math-redirect-csv";
import type { RedirectMatcherResultRow } from "@/lib/redirect-matcher/types";

function csvQuote(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`;
}

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

export function buildRedirectMatcherRankMathCsv(rows: readonly RedirectMatcherResultRow[]): string {
  const redirectRows = rows.map((row) => ({
    source: normalizeExportUrl(row.legacyUrl),
    destination: normalizeExportUrl(row.matchedBlogUrl),
  }));

  return buildRankMathRedirectCsv(redirectRows);
}

export function buildRedirectMatcherWideCsv(rows: readonly RedirectMatcherResultRow[]): string {
  const header =
    "upload_row,legacy_url,matched_blog_url,rank_math_source,rank_math_destination,rationale,legacy_keyword,blog_keyword";
  const lines = [header];

  for (const row of rows) {
    const source = normalizeExportUrl(row.legacyUrl);
    const destination = normalizeExportUrl(row.matchedBlogUrl);
    lines.push(
      [
        String(row.uploadRow),
        csvQuote(source),
        csvQuote(destination),
        csvQuote(source),
        csvQuote(destination),
        csvQuote(row.rationale),
        csvQuote(row.focusKeyword),
        csvQuote(row.matchedBlogKeyword),
      ].join(","),
    );
  }

  return lines.join("\n");
}

export function redirectMatcherExportFilename(siteName: string, kind: "rankmath" | "wide"): string {
  const slug = siteName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "site";
  const date = new Date().toISOString().slice(0, 10);
  if (kind === "wide") {
    return `redirect-matcher-wide-${slug}-${date}.csv`;
  }
  return `redirect-matcher-${slug}-${date}.csv`;
}
