export type ContentCalendarRowStatus = "idle" | "generating" | "ready" | "error";

export type ContentResearchSectionStatus = "waiting" | "running" | "done" | "error";

export type ContentResearchSection = {
  id: string;
  title: string;
  status: ContentResearchSectionStatus;
  markdown?: string;
};

export type ContentCalendarRow = {
  id: string;
  status: ContentCalendarRowStatus;
  events?: string;
  keyword?: string;
  dayOfWeek?: string;
  date?: string;
  fbInstagramContent?: string;
  linkedinContent?: string;
  landingPageUrl?: string;
  imageUrl?: string;
  promptModifier?: string;
  researchSections?: ContentResearchSection[];
  errorMessage?: string;
  createdAt?: string;
};

export type SocialLandingPageSource = "posts" | "pages" | "random";

export const DEFAULT_SOCIAL_LANDING_PAGE_SOURCE: SocialLandingPageSource = "random";

export function normalizeSocialLandingPageSource(value: unknown): SocialLandingPageSource {
  if (value === "posts" || value === "pages" || value === "random") return value;
  return DEFAULT_SOCIAL_LANDING_PAGE_SOURCE;
}

export type ContentCreatorGenerateConfig = {
  postCount: number;
  landingPageSource: SocialLandingPageSource;
};

export const CONTENT_POST_COUNT_MIN = 1;
export const CONTENT_POST_COUNT_MAX = 100;
export const CONTENT_DEFAULT_POST_COUNT = 1;

export function clampContentPostCount(n: number): number {
  return Math.min(CONTENT_POST_COUNT_MAX, Math.max(CONTENT_POST_COUNT_MIN, Math.round(n)));
}

export function cellString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function hasCell(value: unknown): boolean {
  return cellString(value).length > 0;
}

function importCellString(value: unknown): string {
  return cellString(value);
}

export function normalizeContentCalendarRow(
  row: ContentCalendarRow & { blogTitle?: unknown },
): ContentCalendarRow {
  const { blogTitle: _legacyBlogTitle, ...rest } = row;
  const events = importCellString(row.events);
  const keyword = importCellString(row.keyword);
  const dayOfWeek = importCellString(row.dayOfWeek);
  const date = importCellString(row.date);
  const fbInstagramContent = importCellString(row.fbInstagramContent);
  const linkedinContent = importCellString(row.linkedinContent);
  const landingPageUrl = importCellString(row.landingPageUrl);
  const imageUrl = importCellString(row.imageUrl);
  const promptModifier = importCellString(row.promptModifier);
  const errorMessage = importCellString(row.errorMessage);

  return {
    ...rest,
    events: events || undefined,
    keyword: keyword || undefined,
    dayOfWeek: dayOfWeek || undefined,
    date: date || undefined,
    fbInstagramContent: fbInstagramContent || undefined,
    linkedinContent: linkedinContent || undefined,
    landingPageUrl: landingPageUrl || undefined,
    imageUrl: imageUrl || undefined,
    promptModifier: promptModifier || undefined,
    errorMessage: errorMessage || undefined,
  };
}

export function createContentCalendarRowId(): string {
  return `content-creator-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createIdleContentCalendarRow(): ContentCalendarRow {
  return {
    id: createContentCalendarRowId(),
    status: "idle",
  };
}

export function contentRowHasGenerateInput(row: ContentCalendarRow): boolean {
  return hasCell(row.keyword) || hasCell(row.landingPageUrl);
}

export function contentRowIsGenerated(row: ContentCalendarRow): boolean {
  return (
    row.status === "ready" ||
    hasCell(row.fbInstagramContent) ||
    hasCell(row.linkedinContent)
  );
}

export function contentRowDisplayLabel(row: ContentCalendarRow, index: number): string {
  const keyword = cellString(row.keyword);
  if (keyword.length > 0) return keyword;
  return `Post ${index + 1}`;
}
