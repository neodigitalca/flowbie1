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

export function readStoredResearchSection(): ResearchSectionId {
  try {
    const v = sessionStorage.getItem(RESEARCH_SECTION_STORAGE_KEY);
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
