import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { pathSlugToFocusHint } from "@/lib/overview/focus-keyword-path-hint";
import { normalizeFocusKeywordPhrase } from "@/lib/seo-redirect-csv";
import type { SeoContentBriefV1 } from "@/lib/overview-seo-content-brief";

export type EnsureOverviewFocusKeywordDeps = {
  sitemapSource: OverviewSitemapSource;
  deriveEntityKeyword: (
    url: string,
    pageTitle?: string,
    pageMeta?: string,
    options?: { skipLoadingState?: boolean },
  ) => Promise<string | null>;
  deriveFocusKeywordFromPageContext: (
    url: string,
    pageTitle?: string,
    pageMeta?: string,
    faq?: string,
    pageContentPlainText?: string,
    options?: { skipLoadingState?: boolean; seoResearchBrief?: string },
  ) => Promise<string | null>;
  resolveBodyPlainText?: () => Promise<string | undefined>;
};

export type EnsureOverviewFocusKeywordResult = {
  keyword: string;
  patch?: Partial<OverviewRow>;
  wasDerived: boolean;
};

export function parseBriefFocusKeyword(seoResearch: string | undefined): string | null {
  const raw = (seoResearch ?? "").trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<SeoContentBriefV1> & Record<string, unknown>;
    const candidates = [
      typeof j.focusKeyword === "string" ? j.focusKeyword.trim() : "",
      typeof j.primary_keyword === "string" ? j.primary_keyword.trim() : "",
      typeof j.primaryKeyword === "string" ? j.primaryKeyword.trim() : "",
      typeof j.focus_keyword === "string" ? j.focus_keyword.trim() : "",
    ];
    const kw = candidates.find((c) => c.length > 0);
    return kw || null;
  } catch {
    return null;
  }
}

export function needsOverviewResearchRefresh(row: OverviewRow, keyword: string): boolean {
  const brief = (row.seoResearch ?? "").trim();
  if (!brief) return true;
  const briefKw = parseBriefFocusKeyword(brief);
  if (!briefKw) return true;
  const normalizedRow = normalizeFocusKeywordPhrase(keyword).toLowerCase();
  const normalizedBrief = normalizeFocusKeywordPhrase(briefKw).toLowerCase();
  return normalizedRow !== normalizedBrief;
}

export async function ensureOverviewFocusKeyword(
  row: OverviewRow,
  deps: EnsureOverviewFocusKeywordDeps,
): Promise<EnsureOverviewFocusKeywordResult> {
  const existing = (row.focusKeyword ?? "").trim();
  if (existing) {
    return { keyword: existing, wasDerived: false };
  }

  const {
    sitemapSource,
    deriveEntityKeyword,
    deriveFocusKeywordFromPageContext,
    resolveBodyPlainText,
  } = deps;

  let derived: string | null = null;

  if (sitemapSource === "sap") {
    derived = await deriveEntityKeyword(row.url, row.title, row.metaDescription, {
      skipLoadingState: true,
    });
  } else {
    const body = resolveBodyPlainText ? await resolveBodyPlainText() : undefined;
    derived = await deriveFocusKeywordFromPageContext(
      row.url,
      row.title,
      row.metaDescription,
      row.faq,
      body,
      { skipLoadingState: true, seoResearchBrief: row.seoResearch ?? "" },
    );
  }

  if (!derived?.trim()) {
    const hint = pathSlugToFocusHint(row.url);
    derived = hint ? normalizeFocusKeywordPhrase(hint) : "";
  } else {
    derived = normalizeFocusKeywordPhrase(derived);
  }

  if (!derived) {
    return { keyword: "", wasDerived: false };
  }

  return {
    keyword: derived,
    patch: { focusKeyword: derived },
    wasDerived: true,
  };
}
