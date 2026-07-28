/** Overview / Meta Optimizer grid rows → CSV (UTF-8 BOM for Excel). */

export type OverviewRowLike = {
  url: string;
  title: string;
  metaDescription: string;
  aiTitle: string;
  aiMeta: string;
  focusKeyword?: string;
  faq?: string;
  /** Raw post body HTML from WordPress (when export prefetched content). */
  postContent?: string;
  blogH2List?: string[];
  dateModifier?: string;
  seoResearch?: string;
  briefFileName?: string | null;
  researchFileName?: string | null;
  gscQuickWinsCsvFilename?: string | null;
  semrushJsonFilename?: string | null;
  postId?: number | null;
  postType?: string | null;
  wpStatus?: string;
  wpDateGmt?: string;
  aiSuggestedPath?: string;
};

function csvEscape(value: string): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Last path segment as a slug, e.g. https://site.com/blog/foo-bar-baz/ → foo-bar-baz
 * (matches permalink-style paths like temporary-modular-pre-fab-structures-whitehorse-canada)
 */
export function urlLastPathSegment(url: string): string {
  try {
    const u = new URL(url.trim());
    const segments = u.pathname.split("/").filter(Boolean);
    if (!segments.length) return "";
    const last = segments[segments.length - 1];
    return last.replace(/\.(html?|php)$/i, "");
  } catch {
    return "";
  }
}

const HEADERS = [
  "url",
  "path",
  "title",
  "metaDescription",
  "focusKeyword",
  "aiTitle",
  "aiMeta",
  "faq",
  "blogH2List",
  "postContent",
  "aiSuggestedPath",
  "postId",
  "postType",
  "wpStatus",
  "wpDateGmt",
  "dateModifier",
  "briefFileName",
  "researchFileName",
  "gscQuickWinsCsvFilename",
  "semrushJsonFilename",
  "seoResearchChars",
] as const;

export function buildOverviewRowsCsv(rows: OverviewRowLike[]): string {
  const lines: string[] = [HEADERS.join(",")];
  for (const r of rows) {
    const seoLen =
      typeof r.seoResearch === "string" ? String(r.seoResearch.length) : "";
    const row = [
      csvEscape(r.url),
      csvEscape(urlLastPathSegment(r.url)),
      csvEscape(r.title),
      csvEscape(r.metaDescription),
      csvEscape(r.focusKeyword ?? ""),
      csvEscape(r.aiTitle),
      csvEscape(r.aiMeta),
      csvEscape(r.faq ?? ""),
      csvEscape((r.blogH2List ?? []).join(" | ")),
      csvEscape(r.postContent ?? ""),
      csvEscape(r.aiSuggestedPath ?? ""),
      csvEscape(r.postId != null ? String(r.postId) : ""),
      csvEscape(r.postType ?? ""),
      csvEscape(r.wpStatus ?? ""),
      csvEscape(r.wpDateGmt ?? ""),
      csvEscape(r.dateModifier ?? ""),
      csvEscape(r.briefFileName ?? ""),
      csvEscape(r.researchFileName ?? ""),
      csvEscape(r.gscQuickWinsCsvFilename ?? ""),
      csvEscape(r.semrushJsonFilename ?? ""),
      csvEscape(seoLen),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\r\n");
}

export function buildOverviewRowsCsvForDownload(rows: OverviewRowLike[]): string {
  return `\uFEFF${buildOverviewRowsCsv(rows)}`;
}
