import { metaAdPlacementLabel } from "@/lib/social/social-creator-field-limits";
import {
  resolveMetaRowFocusKeyword,
  resolveMetaRowLandingPageUrl,
  type SocialCreatorRow,
} from "@/lib/social/social-creator-types";

const CSV_HEADERS = [
  "Keyword",
  "FB/Instagram Content",
  "Link/Landing page",
  "Format",
  "Prompt Modifier",
] as const;

function csvCell(value: string): string {
  const text = value ?? "";
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function resolveMetaRowFormat(row: SocialCreatorRow): string {
  const placement = row.creative?.aspectRatio ?? row.config?.placement ?? "feed_1x1";
  return metaAdPlacementLabel(placement);
}

export function buildSocialCreatorExportCsv(rows: SocialCreatorRow[]): string {
  const exportRows = rows.filter((row) => Boolean(row.fbInstagramContent?.length));
  if (!exportRows.length) {
    throw new Error("No generated posts to export.");
  }

  const lines: string[] = [CSV_HEADERS.map(csvCell).join(",")];

  for (const row of exportRows) {
    lines.push(
      [
        resolveMetaRowFocusKeyword(row),
        row.fbInstagramContent ?? "",
        resolveMetaRowLandingPageUrl(row),
        resolveMetaRowFormat(row),
        row.imagePromptModifier ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

export function socialCreatorExportFilename(siteLabel: string): string {
  const slug = siteLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return `social-creator-${slug || "export"}-${stamp}.csv`;
}

export function triggerSocialCreatorCsvDownload(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

/** @deprecated Use socialCreatorExportFilename */
export const metaAdsExportFilename = socialCreatorExportFilename;

/** @deprecated Use triggerSocialCreatorCsvDownload */
export const triggerMetaAdsCsvDownload = triggerSocialCreatorCsvDownload;
