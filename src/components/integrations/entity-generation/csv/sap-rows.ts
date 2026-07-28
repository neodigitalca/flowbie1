import type { CSVRow } from "@/lib/bulk-auto-generate";
import { stripPipeBrandSuffixFromTitle } from "@/lib/sap-title-pipe-brand";
import { replaceTemplateVariables } from "./csvGenerator";

export interface SapBulkRowOptions {
  titleFormat: string;
  keyword: string;
  modifier: string;
  /** WordPress site name - strips trailing " | Site Name" from titles if present. */
  siteName?: string;
}

/**
 * Build bulk CSV rows for SAP / service-area posts from origin names.
 * Uses `modifier` (not optionalModifier) to match `parseCSV` / bulk-auto-generate-template.csv.
 */
export function buildSapBulkRows(entities: string[], options: SapBulkRowOptions): CSVRow[] {
  const kw = options.keyword.trim();
  const placeholderKeyword = "service area";

  return entities.map((entity) => {
    let title = options.titleFormat.trim()
      ? replaceTemplateVariables(options.titleFormat, entity, kw || placeholderKeyword)
      : entity;
    title = stripPipeBrandSuffixFromTitle(title, options.siteName);

    return {
      keyword: kw || placeholderKeyword,
      entity,
      title,
      modifier: options.modifier.trim() || undefined,
      /** SAP generator always uses Google Maps snapshot images; never AI-generated featured images. */
      featuredImage: "google-maps",
    };
  });
}
