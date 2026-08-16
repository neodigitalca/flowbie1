/** Column order for `public/bulk-auto-generate-template.csv` / parseCSV bulk import. */
export const BULK_AUTO_GENERATE_TEMPLATE_FILENAME = "bulk-auto-generate-template.csv";

/** Static template in `public/`; must respect Vite `base` (e.g. `/neo-pulse/` on neodigital.ca). */
export const BULK_AUTO_GENERATE_TEMPLATE_HREF = `${import.meta.env.BASE_URL}${BULK_AUTO_GENERATE_TEMPLATE_FILENAME}`;

export const BULK_AUTO_GENERATE_TEMPLATE_COLUMNS = [
  "keyword",
  "entity",
  "title",
  "modifier",
  "featuredImage",
  "publish_date_gmt",
  "sitemap_type",
  "meta_description",
  "target_slug",
  "wikipedia_url",
  "wikipedia_title",
] as const;

export type BulkAutoGenerateTemplateColumn =
  (typeof BULK_AUTO_GENERATE_TEMPLATE_COLUMNS)[number];
