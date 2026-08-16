export type ResearchSectionId =
  | "research-proposal"
  | "research-citation"
  | "research-backlinking";

export const RESEARCH_SECTION_STORAGE_KEY = "neo-pulse-research-section";

const ALL_RESEARCH_SECTIONS = new Set<string>([
  "research-proposal",
  "research-citation",
  "research-backlinking",
]);

/** Former Research side tabs removed from nav; route stored URLs to Proposal. */
const REMOVED_RESEARCH_SECTIONS = new Set([
  "research-competitor",
  "research-local",
]);

/** Former Research side tab; now top-level SEO menu (`sitemap-optimizer`). */
export const LEGACY_SITEMAP_RESEARCH_SECTION_ID = "research-sitemap-optimizer";

export function readStoredResearchSection(): ResearchSectionId {
  try {
    const v = sessionStorage.getItem(RESEARCH_SECTION_STORAGE_KEY);
    if (v === LEGACY_SITEMAP_RESEARCH_SECTION_ID) return "research-proposal";
    if (v && REMOVED_RESEARCH_SECTIONS.has(v)) return "research-proposal";
    if (v && ALL_RESEARCH_SECTIONS.has(v)) return v as ResearchSectionId;
  } catch {
    /* ignore */
  }
  return "research-proposal";
}

export function writeStoredResearchSection(section: ResearchSectionId): void {
  try {
    sessionStorage.setItem(RESEARCH_SECTION_STORAGE_KEY, section);
  } catch {
    /* ignore */
  }
}

export function isLegacyResearchManagerTab(tab: string): boolean {
  return ALL_RESEARCH_SECTIONS.has(tab) || REMOVED_RESEARCH_SECTIONS.has(tab);
}

export function normalizeLegacyResearchSection(tab: string): ResearchSectionId {
  if (tab && ALL_RESEARCH_SECTIONS.has(tab)) return tab as ResearchSectionId;
  return "research-proposal";
}
