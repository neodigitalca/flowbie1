/** Radix Select value for "type or paste a sitemap URL" (not a real URL). */
export const OVERVIEW_MANUAL_SITEMAP_VALUE = "__overview_manual_sitemap__";

/** Min/max for FAQ pair clamping in parsers. */
export const BULK_AI_FAQ_SEED_MIN = 1;
export const BULK_AI_FAQ_SEED_MAX = 20;

/** Fixed FAQ pair count when a page has no FAQs (AI FAQs, AI All Meta, sitemap placeholders). */
export const OVERVIEW_BULK_AI_FAQ_SEED_COUNT = 4;

/** Keys for per-button bulk progress in Meta Optimizer */
export type MetaBulkActionKey =
  | "loadSitemap"
  | "inventoryHydrate"
  | "scrape"
  | "dates"
  | "entityKw"
  | "contentKw"
  | "aiTitle"
  | "aiAllMeta"
  | "aiMeta"
  | "aiUrl"
  | "aiFaq"
  | "aiHeaders"
  | "aiLinks"
  | "aiOverview"
  | "aiInContentImage"
  | "contentCleanup"
  | "research"
  | "optimizeAll"
  | "wpUpload";

export type PipelineStepStatus = "waiting" | "running" | "done" | "error" | "skipped";

export type MetaPipelineStepUi = {
  id: string;
  label: string;
  status: PipelineStepStatus;
};

export type BulkProgressSlice = {
  total: number;
  completed: number;
  /** Short inline phase label under the bulk header (all actions). */
  statusMessage?: string;
  /** AI All Meta bulk: active page index (0-based). */
  currentRow?: number;
  totalRows?: number;
  activeRowLabel?: string;
  /** AI All Meta bulk: checklist for the active page only. */
  pipelineSteps?: MetaPipelineStepUi[];
};

/** Default inline status copy per bulk action key. */
export const BULK_INLINE_STATUS: Partial<Record<MetaBulkActionKey, string>> = {
  loadSitemap: "Loading sitemap",
  inventoryHydrate: "Applying WordPress inventory",
  scrape: "Scraping titles and meta",
  dates: "Updating dates",
  entityKw: "Entity keywords",
  contentKw: "AI keywords",
  aiTitle: "AI titles",
  aiAllMeta: "Processing pages",
  aiMeta: "AI meta",
  aiUrl: "AI URL paths",
  aiFaq: "AI FAQs",
  aiHeaders: "Headers",
  aiLinks: "Links",
  aiOverview: "Overview",
  aiInContentImage: "In Content Image",
  contentCleanup: "Clean Up",
  research: "Researching",
  optimizeAll: "Optimizing page content",
  wpUpload: "Uploading to WordPress",
};

export const AI_ALL_META_PHASE_STATUS = {
  batch: "Processing pages",
  research: "Researching",
  title: "AI title",
  meta: "AI meta",
  faq: "AI FAQs",
} as const;

export const META_BULK_MICRO_ORDER: MetaBulkActionKey[] = [
  "loadSitemap",
  "inventoryHydrate",
  "scrape",
  "dates",
  "entityKw",
  "contentKw",
  "aiTitle",
  "aiAllMeta",
  "aiMeta",
  "aiUrl",
  "aiFaq",
  "aiHeaders",
  "aiLinks",
  "aiOverview",
  "aiInContentImage",
  "contentCleanup",
  "research",
  "optimizeAll",
  "wpUpload",
];

export const META_BULK_MICRO_LABELS: Record<MetaBulkActionKey, string> = {
  loadSitemap: "Loading sitemap",
  inventoryHydrate: "Applying WordPress inventory",
  scrape: "Scraping live titles & meta",
  dates: "Updating dates",
  entityKw: "Entity keywords",
  contentKw: "AI keywords (content)",
  aiTitle: "AI titles",
  aiAllMeta: "AI All Meta",
  aiMeta: "AI meta",
  aiUrl: "AI URL paths",
  aiFaq: "AI FAQs",
  aiHeaders: "Headers (H2)",
  aiLinks: "Links (internal)",
  aiOverview: "Overview (prepend)",
  aiInContentImage: "In Content Image",
  contentCleanup: "Clean Up",
  research: "Research (SERP & data)",
  optimizeAll: "Full-page batch optimize",
  wpUpload: "Upload to WordPress",
};
