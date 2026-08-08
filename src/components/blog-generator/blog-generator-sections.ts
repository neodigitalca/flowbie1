export type BlogGeneratorSectionId =
  | "opt"
  | "bulk-csv"
  | "bulk-prompt"
  | "bulk-blog-import"
  | "bulk-press-release"
  | "entity"
  | "competitor"
  | "flow"
  | "image";

export const BLOG_GENERATOR_SECTION_STORAGE_KEY = "flowbie-blog-generator-section";

export const GENERATOR_WORKSPACE_TITLE = "Generator";

export function readStoredBlogGeneratorSection(): BlogGeneratorSectionId {
  try {
    const v = sessionStorage.getItem(BLOG_GENERATOR_SECTION_STORAGE_KEY);
    if (
      v === "opt" ||
      v === "bulk-csv" ||
      v === "bulk-prompt" ||
      v === "bulk-blog-import" ||
      v === "bulk-press-release" ||
      v === "entity" ||
      v === "competitor" ||
      v === "flow" ||
      v === "image"
    ) {
      return v;
    }
    /** Legacy Content Optimizer tab → Opt pill. */
    if (v === "content-optimizer") return "opt";
    /** Legacy Free Flow tab → Flow pill. */
    if (v === "free-flow") return "flow";
    if (v === "press-release") return "bulk-press-release";
    /** Legacy: Keyword research tab removed - land on CSV upload. */
    if (v === "keyword-research") return "bulk-csv";
    /** Legacy single bulk tab → default to CSV upload. */
    if (v === "bulk") return "bulk-csv";
    /** Removed Auto generate tab → CSV upload. */
    if (v === "auto") return "bulk-csv";
    /** Legacy SAP generator tab → Entity section. */
    if (v === "sap-generator" || v === "sap") return "entity";
  } catch {
    /* ignore */
  }
  return "bulk-csv";
}

export function writeStoredBlogGeneratorSection(section: BlogGeneratorSectionId): void {
  try {
    sessionStorage.setItem(BLOG_GENERATOR_SECTION_STORAGE_KEY, section);
  } catch {
    /* ignore */
  }
}

/**
 * Mega menu: Generator is one menu row; inner modes use header pills only.
 */
export function isNavItemSelected(managerTab: string, itemValue: string): boolean {
  if (managerTab === "generator" && itemValue === "generator") return true;
  /** Legacy Content Optimizer tab → Generator mega menu. */
  if (managerTab === "content-optimizer" && itemValue === "generator") return true;
  /** Legacy tab ids */
  if (managerTab === "blog-generator" && itemValue === "generator") return true;
  if (managerTab === "sap-generator" && itemValue === "generator") return true;
  return managerTab === itemValue;
}
