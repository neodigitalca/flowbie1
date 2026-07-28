import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import {
  buildOpenRouterChatPostBodyJson,
  getCompetitorReportMaxOutputTokens,
} from "@/lib/competitor-research/competitor-report-openrouter-limits";
import {
  bundleGscManualFilesForPrompt,
  extractJsonObjectFromModelText,
  parseAndValidateGscManualAiJson,
  type GscManualAiPayload,
} from "@/lib/gsc-manual-ai-aggregate";
import type { GscReportingOutlineResult, GscReportingSectionKind, GscReportingSectionPlan } from "@/lib/gsc-reporting/gsc-reporting-types";

/** Blog-style Title Case H2s; no calendar ranges in headings (periods stay in tables / CSV). */
const CANONICAL_H2_BY_KIND: Partial<Record<GscReportingSectionKind, string>> = {
  executive_summary: "Executive Summary",
  search_performance_period: "Search Performance Compared Month Over Month",
  key_performance_insights: "Key Performance Insights for the Team",
  sap_local_seo: "SAP & Local SEO Performance",
  content_performance: "Content Performance: Your Growing Digital Footprint",
};

/** Overwrite model-provided h2Title for standard sections so titles stay consistent. Cluster sections keep their titles. */
export function applyCanonicalGscSectionTitles(sections: GscReportingSectionPlan[]): GscReportingSectionPlan[] {
  return sections.map((s) => {
    if (s.kind === "cluster") return s;
    const h2 = CANONICAL_H2_BY_KIND[s.kind];
    return h2 ? { ...s, h2Title: h2 } : s;
  });
}

const OUTLINE_SYSTEM = `You are an SEO analyst. The user provides Google Search Console CSV exports.

You MUST output exactly one JSON object and nothing else - no markdown fences, no commentary.

Schema (strict):
{
  "executiveSummary": string,
  "topOpportunities": [ { "rank": number, "label": string, "why": string, "metrics": string, "evidence": string[] } ],
  "clusters": [],
  "sections": [
    {
      "id": string,
      "h2Title": string,
      "kind": string,
      "ragQuery": string
    }
  ]
}

**clusters** MUST always be the empty JSON array \`[]\`. Do not output thematic clusters here - query clustering is a separate optional raw file in the app, not part of this outline.

Each section "kind" MUST be one of: executive_summary, search_performance_period, key_performance_insights, sap_local_seo, content_performance.

**Do not** output the section kind **growth_metrics**. Site-wide period KPIs (clicks, impressions, CTR, position) belong **only** in **search_performance_period**; a separate growth section repeats the same numbers.

Rules for sections (critical):
- sections defines the **order** of ## headings in the final organic SEO report. Include **in order**. For each kind use **exactly** this **h2Title** string (blog-style **Title Case**). **Do not** put month names, years, or date ranges in **h2Title** - comparison periods belong in table bodies and CSV headers only.
  1) executive_summary - h2Title "Executive Summary"
  2) search_performance_period - h2Title "Search Performance Compared Month Over Month"
  3) key_performance_insights - h2Title "Key Performance Insights for the Team"
  4) sap_local_seo - h2Title "SAP & Local SEO Performance"
  5) content_performance - h2Title "Content Performance: Your Growing Digital Footprint"
- ragQuery: short keyword phrase for retrieving relevant CSV rows (used by the app; not shown to the user).
- **sap_local_seo** \`ragQuery\`: aim at **entity sitemap** URLs (**entity**, **location**, **place**, **GBP**, **local business** page paths), **not** blog or editorial slugs; prefer filenames or rows that mention **entity** / **sitemap** when present.
- **content_performance** \`ragQuery\`: aim at **pages**, **urls**, **landing**, plus **sitemap** list (**post-sitemap**, **page-sitemap**, **product**, **blog**, **location**, **local**, **service-area**) so segment buckets match submitted sitemaps.

Data rules (same as manual GSC summary):
- Numbers in executiveSummary, metrics, evidence must come from the CSV text.
- **Formatting:** Do **not** wrap queries, keywords, page titles, or brands in \`"\` or \`'\` in **executiveSummary**, **topOpportunities** labels, **why**, or **metrics**. Use plain text only (downstream prose uses **bold** for emphasis, not quotes).
- **executiveSummary** must be **factual synthesis** with numbers from the CSV only; keep it **thematic** (segments, demand patterns, branded vs non-brand) so downstream **### Key Insights** can stay **broad**, not a query-by-query inventory. Do **not** output prioritized action lists, "next steps", "priority" framing, or tactical blocks naming query themes as to-do items. Do **not** prescribe implementation checklists; keep interpretation concise. The report section **Executive Summary** will add a separate \`### Key Insights\` bullet list in the final markdown; this JSON field is a compact narrative hint only.
- topOpportunities: at most 12 rows; rank by business impact and merge near-duplicates; evidence lines verbatim from CSV.

Respond with valid JSON only.`;

const VALID_KINDS = new Set<GscReportingSectionKind>([
  "executive_summary",
  "search_performance_period",
  "key_performance_insights",
  "sap_local_seo",
  "content_performance",
  "cluster",
]);

function normalizeSectionKind(raw: string): GscReportingSectionKind | null {
  const k = raw.trim();
  if (k === "executive") return "executive_summary";
  if (VALID_KINDS.has(k as GscReportingSectionKind)) return k as GscReportingSectionKind;
  return null;
}

export function defaultSectionsFromPayload(p: GscManualAiPayload): GscReportingSectionPlan[] {
  void p;
  return applyCanonicalGscSectionTitles([
    {
      id: "executive_summary",
      h2Title: "",
      kind: "executive_summary",
      ragQuery: "executive summary clicks impressions ctr position trends branded",
    },
    {
      id: "search_performance_period",
      h2Title: "",
      kind: "search_performance_period",
      ragQuery: "search performance impressions clicks period comparison month",
    },
    {
      id: "key_performance_insights",
      h2Title: "",
      kind: "key_performance_insights",
      ragQuery: "insights strategy themes clicks impressions queries",
    },
    {
      id: "sap_local_seo",
      h2Title: "",
      kind: "sap_local_seo",
      ragQuery: "entity sitemap xml location place local business page url impressions clicks position comparison",
    },
    {
      id: "content_performance",
      h2Title: "",
      kind: "content_performance",
      ragQuery: "pages urls sitemap post blog product location local service-area landing impressions clicks position",
    },
  ]);
}

/** Cluster sections are not generated in the main report; clusters live in a separate raw file. */
function stripClusterSections(sections: GscReportingSectionPlan[]): GscReportingSectionPlan[] {
  return sections.filter((s) => s.kind !== "cluster");
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function parseSections(raw: unknown): GscReportingSectionPlan[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: GscReportingSectionPlan[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    if (!isNonEmptyString(r.id) || !isNonEmptyString(r.h2Title) || !isNonEmptyString(r.ragQuery)) return null;
    const kindRaw = typeof r.kind === "string" ? r.kind : "";
    const kind = normalizeSectionKind(kindRaw);
    if (!kind) continue;
    let clusterIndex: number | undefined;
    if (r.clusterIndex != null) {
      const n = typeof r.clusterIndex === "number" ? r.clusterIndex : Number(r.clusterIndex);
      if (!Number.isFinite(n) || n < 0) return null;
      clusterIndex = n;
    }
    out.push({
      id: String(r.id).trim(),
      h2Title: String(r.h2Title).trim(),
      kind,
      ragQuery: String(r.ragQuery).trim(),
      clusterIndex,
    });
  }
  return out.length > 0 ? out : null;
}

export function parseGscReportingOutlineJson(raw: string): GscReportingOutlineResult {
  const base = parseAndValidateGscManualAiJson(raw);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJsonObjectFromModelText(raw)) as Record<string, unknown>;
  } catch {
    return { ...base, clusters: [], sections: defaultSectionsFromPayload(base) };
  }
  const parsedSections = parseSections(parsed.sections);
  let sections: GscReportingSectionPlan[];
  if (parsedSections && parsedSections.length > 0) {
    const noClusters = stripClusterSections(parsedSections);
    sections = noClusters.length > 0 ? noClusters : defaultSectionsFromPayload(base);
  } else {
    sections = defaultSectionsFromPayload(base);
  }
  sections = applyCanonicalGscSectionTitles(sections);
  return {
    ...base,
    clusters: [],
    sections,
  };
}

export async function runGscReportingOutline(args: {
  apiKey: string;
  model: string;
  siteName: string;
  siteUrl: string;
  files: { name: string; content: string }[];
  signal?: AbortSignal;
}): Promise<{
  outline: GscReportingOutlineResult;
  truncatedInput: boolean;
  filenames: string[];
  outlineRequestBodyJson: string;
}> {
  const { text, truncated, filenames } = bundleGscManualFilesForPrompt(args.files);
  const userMessage = `Site: ${args.siteName} (${args.siteUrl})

Below are the CSV file contents. Analyze and produce the JSON object as specified.

${text}`;

  const maxTokens = Math.min(24_000, getCompetitorReportMaxOutputTokens(args.model));
  const outlineRequestBodyJson = buildOpenRouterChatPostBodyJson({
    model: args.model,
    maxTokensRequested: maxTokens,
    system: OUTLINE_SYSTEM,
    userMessage,
  });

  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: OUTLINE_SYSTEM,
    user: userMessage,
    maxTokens,
    signal: args.signal,
  });

  const outline = parseGscReportingOutlineJson(content);
  return { outline, truncatedInput: truncated, filenames, outlineRequestBodyJson };
}
