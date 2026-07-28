export type VerticalBenchmarkContentKind = "post" | "entity";

/** Matches GSC export + bulk Curate toolbar filter (Posts / Entity URLs / both). */
export function resolveBenchmarkContentKinds(
  contentTypeFilter: "" | VerticalBenchmarkContentKind,
): VerticalBenchmarkContentKind[] {
  return contentTypeFilter === "" ? ["post", "entity"] : [contentTypeFilter];
}

export function benchmarkContentKindLabel(
  kinds: VerticalBenchmarkContentKind[],
): string {
  if (kinds.length === 1) return kinds[0] === "entity" ? "entity URLs" : "posts";
  return "posts + entity URLs";
}

export type VerticalBenchmarkTaxonomyEntry = {
  id: string;
  label: string;
};

export type ClientTagEntry = {
  siteId: string;
  clientTag: string;
  clientTagLabel: string;
  source?: "custom" | "taxonomy";
};

export type GscTop10CsvRow = {
  site_id: string;
  site_name: string;
  site_url: string;
  client_tag: string;
  content_kind: VerticalBenchmarkContentKind;
  rank: number;
  url: string;
  clicks: number;
  impressions: number;
  position: number;
  gsc_start_date: string;
  gsc_end_date: string;
};

export type VerticalBenchmarkExportSiteResult = {
  siteId: string;
  skipped: boolean;
  reason?: string;
  summary?: { post?: number; entity?: number };
  rowCount?: number;
};

export type VerticalBenchmarkExportGscResult = {
  rows: GscTop10CsvRow[];
  /** GSC ranks 11–30 per site/kind for inventory pivot fallback (not in top-10 curate rows). */
  extendedRows?: GscTop10CsvRow[];
  results: VerticalBenchmarkExportSiteResult[];
  dateRange?: { startDate: string; endDate: string };
};
