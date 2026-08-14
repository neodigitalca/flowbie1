import { metaAdPlacementLabel } from "@/lib/ppc/meta-ads-field-limits";
import {
  resolveMetaRowAdName,
  resolveMetaRowContextSource,
  resolveMetaRowContextUrl,
  resolveMetaRowFocusKeyword,
  resolveMetaRowLandingPageUrl,
  type MetaAdRow,
} from "@/lib/ppc/meta-ads-types";

const CSV_HEADERS = [
  "Ad name",
  "Keyword",
  "Context source",
  "Context URL",
  "Landing page",
  "Primary text",
  "Headline",
  "Description",
  "CTA",
  "Final URL",
  "Format",
] as const;

function csvCell(value: string): string {
  const text = value ?? "";
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function resolveMetaRowFormat(row: MetaAdRow): string {
  const placement = row.creative?.aspectRatio ?? row.config?.placement ?? "feed_1x1";
  return metaAdPlacementLabel(placement);
}

export function buildMetaAdsExportCsv(rows: MetaAdRow[]): string {
  const exportRows = rows.filter((row) => row.copy);
  if (!exportRows.length) {
    throw new Error("No generated ads to export.");
  }

  const lines: string[] = [CSV_HEADERS.map(csvCell).join(",")];

  for (const row of exportRows) {
    const copy = row.copy!;
    lines.push(
      [
        resolveMetaRowAdName(row),
        resolveMetaRowFocusKeyword(row),
        resolveMetaRowContextSource(row),
        resolveMetaRowContextUrl(row),
        resolveMetaRowLandingPageUrl(row),
        copy.primaryText,
        copy.headline,
        copy.description,
        copy.cta,
        copy.finalUrl,
        resolveMetaRowFormat(row),
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

export function metaAdsExportFilename(siteLabel: string): string {
  const slug = siteLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return `meta-ads-${slug || "export"}-${stamp}.csv`;
}

export function triggerMetaAdsCsvDownload(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}
