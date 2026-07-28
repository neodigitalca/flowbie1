import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";

export type PrefilledBulkRowFields = {
  keyword?: string;
  title?: string;
  entity?: string;
  wikipedia_url?: string;
  wikipedia_title?: string;
  meta_description?: string;
  target_slug?: string;
  publish_date_gmt?: string;
  featuredImage?: string;
  modifier?: string;
};

function line(label: string, value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  return `${label}: ${v}`;
}

/** Fixed checklist/blueprint block: use CSV values verbatim; omit empty fields. */
export function formatPrefilledBulkRowContract(row: PrefilledBulkRowFields): string {
  const lines = [
    line("keyword", row.keyword),
    line("title", row.title),
    line("entity", row.entity),
    line("wikipedia_url", row.wikipedia_url),
    line("wikipedia_title", row.wikipedia_title),
    line("meta_description", row.meta_description),
    line("target_slug", row.target_slug),
    line("publish_date_gmt", row.publish_date_gmt),
    line("featuredImage", row.featuredImage),
    line("modifier", row.modifier),
  ].filter((x): x is string => Boolean(x));

  if (lines.length === 0) return "";

  return `
=== PREFILLED BULK ROW (USE VERBATIM) ===
${lines.join("\n")}

Rules:
- Treat every field above as already finalized for this row.
- Do NOT invent alternate title, meta description, Wikipedia URL/title, or slug.
- Checklist and blueprint must align with these values; copy title/meta/wiki/slug exactly when referenced.
=== END PREFILLED BULK ROW ===
`;
}

export function formatPrefilledBulkRowContractFromCsvRow(row: CSVRow): string {
  return formatPrefilledBulkRowContract({
    keyword: row.keyword,
    title: row.title,
    entity: row.entity,
    wikipedia_url: row.wikipedia_url,
    wikipedia_title: row.wikipedia_title,
    meta_description: row.meta_description,
    target_slug: row.target_slug,
    publish_date_gmt: row.publish_date_gmt,
    featuredImage: row.featuredImage,
    modifier: row.modifier,
  });
}

export function hasCsvFilledTitle(row: Pick<CSVRow, "title">): boolean {
  return Boolean(row.title?.trim());
}

export function hasCsvFilledMeta(row: Pick<CSVRow, "meta_description">): boolean {
  return Boolean(row.meta_description?.trim());
}

export function hasCsvFilledWikipediaUrl(row: Pick<CSVRow, "wikipedia_url">): boolean {
  return Boolean(row.wikipedia_url?.trim());
}

export function hasCsvFilledTargetSlug(row: Pick<CSVRow, "target_slug">): boolean {
  return Boolean(row.target_slug?.trim());
}
