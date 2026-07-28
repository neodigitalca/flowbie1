import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  buildSeoRedirectCsv,
  fullDestinationUrl,
  normalizedPageUrlForCompare,
  redirectSourceFromPageUrl,
} from "@/lib/seo-redirect-csv";

export type OverviewRedirectRow = {
  source: string;
  destination: string;
};

/** Redirect row for one Overview grid row (pending or post-slug-change). */
export function buildOverviewRedirectRow(row: OverviewRow): OverviewRedirectRow | null {
  const redirectSource = row.slugRedirectSourceUrl?.trim();
  const liveUrl = row.url?.trim();
  const suggested = row.aiSuggestedPath?.trim();

  if (redirectSource && liveUrl) {
    const source = redirectSourceFromPageUrl(redirectSource);
    const destNorm = normalizedPageUrlForCompare(liveUrl);
    const sourceNorm = normalizedPageUrlForCompare(redirectSource);
    if (source && destNorm && sourceNorm && destNorm !== sourceNorm) {
      return { source, destination: liveUrl };
    }
  }

  if (!liveUrl || !suggested) return null;

  const source = redirectSourceFromPageUrl(liveUrl);
  const destination = fullDestinationUrl(liveUrl, suggested);
  if (!source || !destination) return null;

  const cur = normalizedPageUrlForCompare(liveUrl);
  const destNorm = normalizedPageUrlForCompare(destination);
  if (cur && destNorm && cur !== destNorm) {
    return { source, destination };
  }

  return null;
}

export function downloadOverviewRedirectCsv(
  rows: OverviewRedirectRow[],
  filename: string,
): void {
  const csv = buildSeoRedirectCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function overviewRedirectCsvFilename(row: OverviewRow): string {
  const slug =
    row.url
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/[^a-z0-9-]+/gi, "-")
      .replace(/^-|-$/g, "") || "redirect";
  return `seo-redirect-${slug}.csv`;
}
