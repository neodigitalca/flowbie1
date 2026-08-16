import Papa from "papaparse";

export const META_KEYWORD_TEMPLATE_CSV =
  "Keyword,FB/Instagram Content,Link/Landing page,Prompt Modifier\nwindow coverings Edmonton,,https://example.com/blog/post,Optional visual note\n";

export const META_KEYWORD_TEMPLATE_FILENAME = "meta-keywords-template.csv";

export type MetaKeywordImportRow = {
  focusKeyword: string;
  contextSource?: "neo-pulse_app" | "custom";
  contextUrl?: string;
  landingPageUrl?: string;
  imagePromptModifier?: string;
  fbInstagramContent?: string;
};

const KEYWORD_HEADER_ALIASES = [
  "keyword",
  "keywords",
  "focuskeyword",
  "focus_keyword",
  "keywordfocus",
  "keyword_focus",
];

const LANDING_PAGE_HEADER_ALIASES = [
  "linklandingpage",
  "link",
  "landingpage",
  "landing_page",
  "url",
];

const CONTEXT_URL_HEADER_ALIASES = [
  "contexturl",
  "context_url",
  "seourl",
  "seo_url",
  "blogurl",
  "blog_url",
];

const PROMPT_MODIFIER_HEADER_ALIASES = ["promptmodifier", "prompt_modifier"];

const FB_INSTAGRAM_CONTENT_HEADER_ALIASES = [
  "fbinstagramcontent",
  "fb_instagram_content",
  "fblinkedincontent",
  "fb_linkedin_content",
  "socialcontent",
  "content",
];

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_/-]+/g, "");
}

function pickStringFromRow(row: Record<string, unknown>, aliases: string[]): string {
  for (const [key, value] of Object.entries(row)) {
    const norm = normalizeHeaderKey(key);
    if (!aliases.includes(norm)) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeLandingPageUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return undefined;
}

export function buildCalendarImagePromptModifier(options: {
  focusKeyword?: string;
  landingPageUrl?: string;
  socialCopy?: string;
}): string | undefined {
  const parts: string[] = [];
  if (options.focusKeyword?.trim()) {
    parts.push(`Topic: ${options.focusKeyword.trim()}`);
  }
  if (options.landingPageUrl?.trim()) {
    parts.push(`Blog context URL: ${options.landingPageUrl.trim()}`);
  }
  if (options.socialCopy?.trim()) {
    parts.push(`Social angle: ${options.socialCopy.trim()}`);
  }
  if (!parts.length) return undefined;
  return parts.join(". ");
}

function recordToImportRow(
  record: Record<string, unknown>,
  options: { hasCalendarColumns: boolean; hasPromptModifierColumn: boolean },
): MetaKeywordImportRow | null {
  const focusKeyword = pickStringFromRow(record, KEYWORD_HEADER_ALIASES);
  if (!focusKeyword) return null;

  const landingRaw = pickStringFromRow(record, LANDING_PAGE_HEADER_ALIASES);
  const landingPageUrl = landingRaw ? normalizeLandingPageUrl(landingRaw) : undefined;
  const contextRaw = pickStringFromRow(record, CONTEXT_URL_HEADER_ALIASES);
  const contextUrl = contextRaw ? normalizeLandingPageUrl(contextRaw) : undefined;
  const fbInstagramContent =
    pickStringFromRow(record, FB_INSTAGRAM_CONTENT_HEADER_ALIASES) || undefined;
  const promptModifierRaw = pickStringFromRow(record, PROMPT_MODIFIER_HEADER_ALIASES) || undefined;

  const resolvedContextUrl = contextUrl ?? landingPageUrl;

  let imagePromptModifier: string | undefined;
  if (promptModifierRaw) {
    imagePromptModifier = promptModifierRaw;
  } else if (options.hasCalendarColumns && !options.hasPromptModifierColumn) {
    imagePromptModifier = buildCalendarImagePromptModifier({
      focusKeyword,
      landingPageUrl: resolvedContextUrl,
    });
  }

  return {
    focusKeyword,
    contextSource: resolvedContextUrl ? "custom" : undefined,
    contextUrl: resolvedContextUrl,
    landingPageUrl,
    imagePromptModifier,
    fbInstagramContent,
  };
}

function csvHasCalendarColumns(headers: string[]): boolean {
  const normalized = headers.map(normalizeHeaderKey);
  return (
    normalized.some((key) => LANDING_PAGE_HEADER_ALIASES.includes(key)) ||
    normalized.some((key) => CONTEXT_URL_HEADER_ALIASES.includes(key)) ||
    normalized.some((key) => FB_INSTAGRAM_CONTENT_HEADER_ALIASES.includes(key)) ||
    normalized.some((key) => PROMPT_MODIFIER_HEADER_ALIASES.includes(key))
  );
}

function csvHasPromptModifierColumn(headers: string[]): boolean {
  const normalized = headers.map(normalizeHeaderKey);
  return normalized.some((key) => PROMPT_MODIFIER_HEADER_ALIASES.includes(key));
}

export function parseMetaKeywordTemplateCsv(csvText: string): MetaKeywordImportRow[] {
  if (!csvText.trim()) return [];

  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = parsed.meta.fields ?? [];
  const hasCalendarColumns = csvHasCalendarColumns(headers);
  const hasPromptModifierColumn = csvHasPromptModifierColumn(headers);

  const rows: MetaKeywordImportRow[] = [];
  for (const record of parsed.data) {
    if (!record || typeof record !== "object") continue;
    const row = recordToImportRow(record, { hasCalendarColumns, hasPromptModifierColumn });
    if (row) rows.push(row);
  }

  return rows;
}
