import type { LucideIcon } from "lucide-react";
import {
  ArrowUpToLine,
  Crosshair,
  FileSpreadsheet,
  FlaskConical,
  Image,
  LineChart,
  MapPin,
  MessageSquare,
  Newspaper,
  Swords,
  Workflow,
} from "lucide-react";

export type BlogGeneratorSectionId =
  | "opt"
  | "bulk-csv"
  | "bulk-prompt"
  | "bulk-blog-import"
  | "bulk-press-release"
  | "entity"
  | "competitor"
  | "flow"
  | "image"
  | "research"
  | "report";

export type BlogGeneratorSectionDef = {
  id: BlogGeneratorSectionId;
  label: string;
  icon: LucideIcon;
};

export const BLOG_GENERATOR_SECTION_DEFS: BlogGeneratorSectionDef[] = [
  { id: "opt", label: "Opt", icon: Crosshair },
  { id: "bulk-csv", label: "CSV", icon: FileSpreadsheet },
  { id: "bulk-prompt", label: "Prompt", icon: MessageSquare },
  { id: "bulk-blog-import", label: "Import", icon: ArrowUpToLine },
  { id: "bulk-press-release", label: "PR", icon: Newspaper },
  { id: "entity", label: "Entity", icon: MapPin },
  { id: "competitor", label: "Competitor", icon: Swords },
  { id: "flow", label: "Flow", icon: Workflow },
  { id: "image", label: "Image", icon: Image },
  { id: "research", label: "Research", icon: FlaskConical },
  { id: "report", label: "Report", icon: LineChart },
];

const SECTION_BY_ID = new Map(BLOG_GENERATOR_SECTION_DEFS.map((def) => [def.id, def]));

export function getBlogGeneratorSectionMeta(id: BlogGeneratorSectionId): BlogGeneratorSectionDef {
  return SECTION_BY_ID.get(id) ?? BLOG_GENERATOR_SECTION_DEFS[1];
}

export const BLOG_GENERATOR_SECTION_STORAGE_KEY = "neo-pulse-blog-generator-section";

/** @deprecated Title band uses active section label via getBlogGeneratorSectionMeta. */
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
      v === "image" ||
      v === "research" ||
      v === "report"
    ) {
      return v;
    }
    if (v === "gsc-reporting") return "report";
    if (v === "research-proposal" || v === "research-citation" || v === "research-backlinking") {
      return "research";
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

type BlogGeneratorSectionListener = (section: BlogGeneratorSectionId) => void;

const sectionListeners = new Set<BlogGeneratorSectionListener>();

export function registerBlogGeneratorSectionListener(
  listener: BlogGeneratorSectionListener | null,
): void {
  if (listener) sectionListeners.add(listener);
}

export function unregisterBlogGeneratorSectionListener(
  listener: BlogGeneratorSectionListener,
): void {
  sectionListeners.delete(listener);
}

export function notifyBlogGeneratorSectionChange(section: BlogGeneratorSectionId): void {
  for (const listener of sectionListeners) {
    listener(section);
  }
}

export function writeStoredBlogGeneratorSection(section: BlogGeneratorSectionId): void {
  try {
    sessionStorage.setItem(BLOG_GENERATOR_SECTION_STORAGE_KEY, section);
  } catch {
    /* ignore */
  }
  notifyBlogGeneratorSectionChange(section);
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
  if (managerTab === "research" && itemValue === "generator") return true;
  if (managerTab === "gsc-reporting" && itemValue === "generator") return true;
  return managerTab === itemValue;
}
