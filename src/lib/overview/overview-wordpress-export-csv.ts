import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import {
  buildOverviewBulkSeoItem,
  overviewBindingForRow,
  restCollectionEndpointForSubtype,
} from "@/lib/overview/overview-bulk-seo-payload";

function csvEscape(value: string): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const HEADERS = [
  "post_id",
  "url",
  "post_type_endpoint",
  "post_title",
  "post_excerpt",
  "focus_keyword",
  "keyword_focus",
  "faq",
  "date_modifier",
  "seo_date_modifier",
  "seo_research",
] as const;

/** Rows that have a WordPress post binding (required for bulk SEO CSV lines). */
export function filterOverviewRowsWithPostBinding(
  rows: OverviewRow[],
  bindingByUrl: Record<string, OverviewBinding | undefined>,
): OverviewRow[] {
  return rows.filter((r) => overviewBindingForRow(r, bindingByUrl)?.postId);
}

/**
 * UTF-8 BOM + CRLF for Excel. Columns match NEO Pulse Overview → WordPress (SEO meta + ACF) for CSV import workflows.
 */
export function buildOverviewWordPressExportCsv(
  rows: OverviewRow[],
  bindingByUrl: Record<string, OverviewBinding | undefined>,
): string {
  const lines: string[] = [HEADERS.join(",")];

  for (const row of rows) {
    const b = overviewBindingForRow(row, bindingByUrl);
    if (!b?.postId) continue;

    const built = buildOverviewBulkSeoItem(row, b);
    const ep = restCollectionEndpointForSubtype(b.subtype);

    const acf = built?.acf ?? {};

    const out = [
      csvEscape(String(b.postId)),
      csvEscape(row.url),
      csvEscape(ep),
      csvEscape(typeof built?.postTitle === "string" ? built.postTitle : ""),
      csvEscape(typeof built?.postExcerpt === "string" ? built.postExcerpt : ""),
      csvEscape(typeof acf.keyword_focus === "string" ? acf.keyword_focus : ""),
      csvEscape(typeof acf.keyword_focus === "string" ? acf.keyword_focus : ""),
      csvEscape(typeof acf.faq === "string" ? acf.faq : ""),
      csvEscape(typeof acf.date_modifier === "string" ? acf.date_modifier : ""),
      csvEscape(typeof acf.seo_date_modifier === "string" ? acf.seo_date_modifier : ""),
      csvEscape(typeof acf.seo_research === "string" ? acf.seo_research : ""),
    ];
    lines.push(out.join(","));
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

export type OverviewWordPressUploadFailureRow = {
  postId: number | null;
  url: string;
  error: string;
  mergeError?: string;
};

const FAILURE_HEADERS = ["post_id", "url", "error", "merge_error"] as const;

/** One row per failed bulk WordPress SEO upload (download after bulk upload). */
export function buildOverviewWordPressUploadFailuresCsv(
  failures: OverviewWordPressUploadFailureRow[],
): string {
  const lines: string[] = [FAILURE_HEADERS.join(",")];
  for (const f of failures) {
    lines.push(
      [
        csvEscape(f.postId != null ? String(f.postId) : ""),
        csvEscape(f.url),
        csvEscape(f.error),
        csvEscape(f.mergeError ?? ""),
      ].join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

/** Harness section markdown for BulkHarnessSectionsPanel CSV download. */
export function overviewCsvHarnessMarkdown(csv: string): string {
  const body = csv.replace(/^\uFEFF/, "");
  return `\`\`\`csv\n${body}\n\`\`\``;
}

/** Blob URL for an `<a download>` link; caller must {@link URL.revokeObjectURL} when done. */
export function createOverviewCsvObjectUrl(csv: string): string {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  return URL.createObjectURL(blob);
}

export function triggerOverviewCsvDownload(csv: string, filename: string): void {
  const url = createOverviewCsvObjectUrl(csv);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
