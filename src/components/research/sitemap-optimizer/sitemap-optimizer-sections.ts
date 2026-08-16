import type { SitemapOptimizerWorkspaceMode } from "@/lib/sitemap-optimizer/types";

export const SITEMAP_OPTIMIZER_SECTION_STORAGE_KEY = "neo-pulse-sitemap-optimizer-section";

export function readStoredSitemapOptimizerSection(): SitemapOptimizerWorkspaceMode {
  try {
    const v = sessionStorage.getItem(SITEMAP_OPTIMIZER_SECTION_STORAGE_KEY);
    if (v === "plan" || v === "legacy_redirects" || v === "url_optimizer") return v;
  } catch {
    /* ignore */
  }
  return "plan";
}

export function writeStoredSitemapOptimizerSection(section: SitemapOptimizerWorkspaceMode): void {
  try {
    sessionStorage.setItem(SITEMAP_OPTIMIZER_SECTION_STORAGE_KEY, section);
  } catch {
    /* ignore */
  }
}
