export type ContentOptimizerSectionId = "content" | "multi-site";

export const CONTENT_OPTIMIZER_SECTION_STORAGE_KEY = "flowbie-content-optimizer-section";

export function readStoredContentOptimizerSection(): ContentOptimizerSectionId {
  try {
    const v = sessionStorage.getItem(CONTENT_OPTIMIZER_SECTION_STORAGE_KEY);
    if (v === "fleet") return "content";
    if (v === "meta") return "content";
    if (v === "elementor") return "content";
    if (v === "content" || v === "multi-site") return v;
  } catch {
    /* ignore */
  }
  return "content";
}

export function writeStoredContentOptimizerSection(section: ContentOptimizerSectionId): void {
  try {
    sessionStorage.setItem(CONTENT_OPTIMIZER_SECTION_STORAGE_KEY, section);
  } catch {
    /* ignore */
  }
}
