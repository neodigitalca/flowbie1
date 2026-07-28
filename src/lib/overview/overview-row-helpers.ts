import { parseFaqEntries, serializeFaqEntriesPlain } from "@/lib/faq-entries";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  BULK_AI_FAQ_SEED_MAX,
  BULK_AI_FAQ_SEED_MIN,
} from "@/components/overview/overview-tab-constants";

export function createEmptyOverviewRow(url = ""): OverviewRow {
  return {
    url,
    title: "",
    metaDescription: "",
    aiTitle: "",
    aiMeta: "",
    aiSuggestedPath: "",
    status: "idle",
    focusKeyword: "",
    faq: "",
    dateModifier: "",
    seoResearch: "",
  };
}

export function clampBulkAiFaqSeed(n: number): number {
  return Math.min(BULK_AI_FAQ_SEED_MAX, Math.max(BULK_AI_FAQ_SEED_MIN, Math.round(n)));
}

export function bulkAiFaqSeedStorageKey(siteId: string): string {
  return `overview.bulkAiFaqSeedCount.${siteId}`;
}

/** Apply N empty Q/A placeholder rows for pages with no real FAQ content yet (or only blank slots). */
export function applyFaqPlaceholderCountToRows(prev: OverviewRow[], count: number): OverviewRow[] {
  return prev.map((r) => {
    const entries = parseFaqEntries(r.faq);
    const allBlank =
      entries.length > 0 &&
      entries.every((e) => !String(e.question).trim() && !String(e.answer).trim());
    if (entries.length !== 0 && !allBlank) {
      return r;
    }
    const placeholders = Array.from({ length: count }, () => ({
      question: "",
      answer: "",
    }));
    return { ...r, faq: serializeFaqEntriesPlain(placeholders) };
  });
}

/** Strip HTML for focus-keyword AI (WordPress post body). */
export function stripHtmlForKeywordContext(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
