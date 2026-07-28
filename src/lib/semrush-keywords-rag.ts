import type { SemrushBulkEnrichmentResult } from '@/lib/wordpress-api/semrush';

const MAX_SEMRUSH_KEYWORDS_RAG_CHARS = 8000;

/**
 * Compact JSON string for content prompts: Semrush url_organic + phrase_related keywords (RAG).
 * Truncated to avoid token overflow; mirrors GSC context caps.
 */
export function buildSemrushKeywordsRagJson(semrush: SemrushBulkEnrichmentResult | undefined | null): string {
  if (!semrush) return '';
  const payload = {
    skipped: semrush.skipped,
    reason: semrush.reason,
    urlOrganicKeywords: semrush.urlOrganicKeywords ?? [],
    phraseRelatedKeywords: semrush.phraseRelatedKeywords ?? [],
    errors: semrush.errors,
  };
  let s = JSON.stringify(payload);
  if (s.length > MAX_SEMRUSH_KEYWORDS_RAG_CHARS) {
    s =
      s.slice(0, MAX_SEMRUSH_KEYWORDS_RAG_CHARS) +
      '\n[Truncated for token limit. Use for intent and phrasing only.]';
  }
  return s;
}

const MAX_SEMRUSH_ANCHOR_PHRASES = 150;

/**
 * Deduped Semrush keyword phrases for exact-match external anchor text (url_organic + phrase_related order preserved).
 */
export function buildSemrushAnchorPhraseList(semrush: SemrushBulkEnrichmentResult | undefined | null): string[] {
  if (!semrush) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of [semrush.urlOrganicKeywords ?? [], semrush.phraseRelatedKeywords ?? []]) {
    for (const raw of list) {
      const t = typeof raw === 'string' ? raw.trim() : '';
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= MAX_SEMRUSH_ANCHOR_PHRASES) return out;
    }
  }
  return out;
}
