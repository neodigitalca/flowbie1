export const SITEMAP_OPTIMIZER_BULK_CSV_SEED_KEY = "neo-pulse-sitemap-optimizer-bulk-csv-seed";
export const ENTITY_BULK_CSV_AUTO_RUN_KEY = "neo-pulse-entity-bulk-csv-auto-run";

export function writeSitemapOptimizerBulkCsvSeed(csv: string): void {
  try {
    sessionStorage.setItem(SITEMAP_OPTIMIZER_BULK_CSV_SEED_KEY, csv);
  } catch {
    /* ignore quota */
  }
}

/** Entity Approve: CSV seed + auto-run flag for the bulk CSV tab. */
export function writeEntityBulkCsvHandoff(csv: string): void {
  writeSitemapOptimizerBulkCsvSeed(csv);
  try {
    sessionStorage.setItem(ENTITY_BULK_CSV_AUTO_RUN_KEY, "1");
  } catch {
    /* ignore quota */
  }
}

/** Read seed once and remove it so reload does not re-import. */
export function consumeSitemapOptimizerBulkCsvSeed(): string | null {
  try {
    const raw = sessionStorage.getItem(SITEMAP_OPTIMIZER_BULK_CSV_SEED_KEY);
    if (!raw?.trim()) return null;
    sessionStorage.removeItem(SITEMAP_OPTIMIZER_BULK_CSV_SEED_KEY);
    return raw;
  } catch {
    return null;
  }
}

/** Read entity auto-run flag once. */
export function consumeEntityBulkCsvAutoRun(): boolean {
  try {
    const raw = sessionStorage.getItem(ENTITY_BULK_CSV_AUTO_RUN_KEY);
    sessionStorage.removeItem(ENTITY_BULK_CSV_AUTO_RUN_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}
