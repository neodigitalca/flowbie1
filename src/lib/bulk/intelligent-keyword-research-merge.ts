/**
 * Reconciles DataForSEO + Semrush + entity context; picks one Semrush-approved external URL.
 */
import type { CSVRow } from '@/lib/bulk/bulk-csv-parser';
import type { KeywordData } from '@/lib/keyword-types';
import type { SemrushBulkEnrichmentResult, SemrushKeywordOverviewPayload } from '@/lib/wordpress-api/semrush';
import { loadApiKey } from '@/lib/api';
import { getResearchModel } from '@/lib/optimization-settings-storage';
import { openRouterWebAppHeaders } from "@/lib/openrouter-attribution";

const OR = 'https://openrouter.ai/api/v1/chat/completions';

export type IntelligentKeywordResearchMergeResult = {
  primaryIntent: string;
  semrushIntentAlignment?: string;
  recommendedExternalUrl: string | null;
  rationale?: string;
};

function trimOverview(overview: SemrushKeywordOverviewPayload | null | undefined): string {
  if (!overview) return '';
  try {
    return JSON.stringify(overview).slice(0, 8000);
  } catch {
    return '';
  }
}

function pickFallbackIntent(
  dfsIntent: KeywordData['intent'] | undefined,
  _overview: SemrushKeywordOverviewPayload | null | undefined
): string {
  return dfsIntent || 'informational';
}

function validateRecommendedUrl(
  url: string | null | undefined,
  candidates: string[]
): string | null {
  const t = (url || '').trim();
  if (!t) return null;
  const set = new Set(candidates.map((c) => c.trim()));
  return set.has(t) ? t : null;
}

function parseMergeJson(content: string): IntelligentKeywordResearchMergeResult | null {
  const t = content.trim();
  try {
    const o = JSON.parse(t) as unknown;
    if (!o || typeof o !== 'object') return null;
    const r = o as Record<string, unknown>;
    const primaryIntent = typeof r.primaryIntent === 'string' ? r.primaryIntent : '';
    const recommendedExternalUrl =
      r.recommendedExternalUrl === null
        ? null
        : typeof r.recommendedExternalUrl === 'string'
          ? r.recommendedExternalUrl
          : null;
    if (!primaryIntent) return null;
    return {
      primaryIntent,
      semrushIntentAlignment:
        typeof r.semrushIntentAlignment === 'string' ? r.semrushIntentAlignment : undefined,
      recommendedExternalUrl,
      rationale: typeof r.rationale === 'string' ? r.rationale : undefined,
    };
  } catch {
    /* fall through */
  }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    const o = JSON.parse(t.slice(a, b + 1)) as unknown;
    if (!o || typeof o !== 'object') return null;
    const r = o as Record<string, unknown>;
    const primaryIntent = typeof r.primaryIntent === 'string' ? r.primaryIntent : '';
    const recommendedExternalUrl =
      r.recommendedExternalUrl === null
        ? null
        : typeof r.recommendedExternalUrl === 'string'
          ? r.recommendedExternalUrl
          : null;
    if (!primaryIntent) return null;
    return {
      primaryIntent,
      semrushIntentAlignment:
        typeof r.semrushIntentAlignment === 'string' ? r.semrushIntentAlignment : undefined,
      recommendedExternalUrl,
      rationale: typeof r.rationale === 'string' ? r.rationale : undefined,
    };
  } catch {
    return null;
  }
}

export type IntelligentKeywordResearchMergeOptions = {
  apiKey?: string;
  model?: string;
};

/**
 * Uses OpenRouter to align intent and pick one URL from Semrush-filtered candidates for this entity/page.
 */
export async function runIntelligentKeywordResearchMerge(
  row: CSVRow,
  keywordData: KeywordData,
  semrush: SemrushBulkEnrichmentResult,
  options?: IntelligentKeywordResearchMergeOptions
): Promise<{
  merge: IntelligentKeywordResearchMergeResult;
  primaryExternalCitationUrl: string | null;
}> {
  const candidates = (semrush.externalSemrushUrls ?? []).slice(0, 12);
  const overview = semrush.keywordOverview ?? null;
  const apiKey = options?.apiKey?.trim() || loadApiKey();
  const model = options?.model?.trim() || getResearchModel();

  const fallbackUrl = candidates.length > 0 ? candidates[0]! : null;
  const dfsIntent = keywordData.intent;

  if (!apiKey) {
    return {
      merge: {
        primaryIntent: pickFallbackIntent(dfsIntent, overview),
        recommendedExternalUrl: fallbackUrl,
        rationale: 'OpenRouter key missing; DFS intent + first Semrush URL.',
      },
      primaryExternalCitationUrl: fallbackUrl,
    };
  }

  const userPayload = {
    entity: row.entity?.trim() || null,
    title: row.title?.trim() || null,
    keyword: row.keyword?.trim() || '',
    keyword_focus: row.keyword_focus?.trim() || null,
    dfsIntent,
    dfsKeyword: keywordData.keyword,
    dfsVolume: keywordData.searchVolume,
    semrushKeywordOverviewExcerpt: trimOverview(overview),
    candidateExternalUrls: candidates,
  };

  const system = `You merge local SEO keyword research for a single page. Return ONLY valid JSON:
{"primaryIntent":"string","semrushIntentAlignment":"string","recommendedExternalUrl":string|null,"rationale":"string"}

Rules:
- primaryIntent: one of informational, commercial, transactional, navigational - best fit for this page given entity, title, keyword, and DataForSEO intent.
- recommendedExternalUrl MUST be exactly one string from candidateExternalUrls OR null if none suit the page. Never invent URLs.
- semrushIntentAlignment: brief note on how Semrush/overview data relates (or "n/a" if thin).
Keep rationale under 400 characters.`;

  const res = await fetch(OR, {
    method: 'POST',
    headers: openRouterWebAppHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userPayload, null, 2) },
      ],
    }),
  });

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  const content = data?.choices?.[0]?.message?.content ?? '';
  const parsed = parseMergeJson(content);
  if (!parsed) {
    return {
      merge: {
        primaryIntent: pickFallbackIntent(dfsIntent, overview),
        recommendedExternalUrl: fallbackUrl,
        rationale: data?.error?.message || 'Model parse failed; fallback.',
      },
      primaryExternalCitationUrl: fallbackUrl,
    };
  }

  const validated = validateRecommendedUrl(parsed.recommendedExternalUrl, candidates);
  const primaryExternalCitationUrl = validated ?? fallbackUrl;

  return {
    merge: {
      ...parsed,
      recommendedExternalUrl: primaryExternalCitationUrl,
    },
    primaryExternalCitationUrl,
  };
}
