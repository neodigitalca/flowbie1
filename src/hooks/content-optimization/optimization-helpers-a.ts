import { loadApiKey } from "@/lib/api";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { type WordPressSite } from "@/components/integrations/types";
import type { LinkCheckResult } from "@/lib/wordpress-api/validate-internal-links";
import {
  extractGeographicEntityWithAI,
  generateLocalKeywordForEntityPage,
  selectBestKeywordForEntityPage,
} from "@/lib/content-optimization-helpers";
import type { GeographicSiteContext } from "@/lib/content-optimization/entity";
import { getResearchModel } from "@/lib/optimization-settings-storage";

// ============================================================================
// State Management Helpers
// ============================================================================

const MICRO_LOG_CAP = 100;

export type OptimizationProgressPatch = Partial<{
  step: string;
  progress: number;
  message?: string;
  linkCheckResults?: LinkCheckResult[] | null;
}> &
  Record<string, any>;

/**
 * Merges a progress update for one key, appending to microLog when `step` changes.
 * Preserves linkCheckResults when the patch omits them (same rule as upload flow).
 */
export function mergeOptimizationProgress(
  prev: Record<string, any>,
  key: string,
  incoming: OptimizationProgressPatch,
  options?: { resetMicroLog?: boolean }
): Record<string, any> {
  const prevEntry = prev[key] || {};

  let microLog: { step: string; message?: string }[];

  if (options?.resetMicroLog) {
    microLog =
      incoming.step != null ? [{ step: incoming.step, message: incoming.message }] : [];
  } else {
    microLog = [...(prevEntry.microLog || [])];
    if (incoming.step != null && incoming.step !== prevEntry.step) {
      microLog.push({ step: incoming.step, message: incoming.message });
      while (microLog.length > MICRO_LOG_CAP) microLog.shift();
    }
  }

  const next: Record<string, any> = {
    ...prevEntry,
    ...incoming,
    microLog,
  };

  if (incoming.linkCheckResults == null && prevEntry.linkCheckResults != null) {
    next.linkCheckResults = prevEntry.linkCheckResults;
  }

  if (incoming.harnessSections == null && prevEntry.harnessSections != null) {
    next.harnessSections = prevEntry.harnessSections;
    next.harnessPlannedSectionCount = prevEntry.harnessPlannedSectionCount;
  }

  return { ...prev, [key]: next };
}

/** Apply a progress patch via setState (for nested callbacks from blueprint / keyword research). */
export function patchOptimizationProgress(
  setProgress: (prev: any) => any,
  key: string,
  incoming: Record<string, any>
) {
  setProgress((prev: any) => mergeOptimizationProgress(prev, key, incoming));
}

/** Extra text / content harness lives on site.id; bulk UI also reads `${siteId}-batch`. */
export function mergeHarnessProgressSiteAndBatch(
  prev: Record<string, any>,
  siteId: string,
  incoming: OptimizationProgressPatch,
): Record<string, any> {
  let next = mergeOptimizationProgress(prev, siteId, incoming);
  const batchKey = `${siteId}-batch`;
  if (prev[batchKey] != null) {
    next = mergeOptimizationProgress(next, batchKey, incoming);
  }
  return next;
}

export function updateOptimizationProgress(
  setProgress: (prev: any) => any,
  key: string,
  step: string,
  progress: number,
  message?: string,
  options?: { resetMicroLog?: boolean }
) {
  setProgress((prev: any) =>
    mergeOptimizationProgress(prev, key, { step, progress, message }, options)
  );
}

export function setOptimizingState(
  setIsOptimizing: (prev: any) => any,
  key: string,
  isOptimizing: boolean
) {
  setIsOptimizing((prev: any) => ({ ...prev, [key]: isOptimizing }));
}

export function clearOptimizationState(
  setIsOptimizing: (prev: any) => any,
  setProgress: (prev: any) => any,
  setPending: (prev: any) => any,
  key: string
) {
  setIsOptimizing((prev: any) => {
    const updated = { ...prev };
    delete updated[key];
    return updated;
  });
  setProgress((prev: any) => {
    const updated = { ...prev };
    delete updated[key];
    return updated;
  });
  setPending((prev: any) => {
    const updated = { ...prev };
    delete updated[key];
    return updated;
  });
}

export function clearOptimizationFileManager(
  setFileManagers: (prev: any) => any,
  key: string
) {
  setFileManagers((prev: any) => {
    const updated = { ...prev };
    delete updated[key];
    return updated;
  });
}

export function clearOptimization(
  setIsOptimizing: (prev: any) => any,
  setProgress: (prev: any) => any,
  setPending: (prev: any) => any,
  siteId: string
) {
  setIsOptimizing((prev: any) => {
    const updated = { ...prev };
    delete updated[siteId];
    return updated;
  });
  setProgress((prev: any) => {
    const updated = { ...prev };
    delete updated[siteId];
    return updated;
  });
  setPending((prev: any) => {
    const updated = { ...prev };
    delete updated[siteId];
    return updated;
  });

  try {
    const { clearSiteCache } = require("@/lib/wordpress-site-cache");
    const { clearValidationCache } = require("@/lib/cached-link-validation");
    const { clearRelevanceCache } = require("@/lib/content-generation/ai-link-relevance-filter");
    clearSiteCache(siteId);
    clearValidationCache(siteId);
    clearRelevanceCache(siteId);
    console.log(`[Optimize Content] Cleared site cache for ${siteId} (manual clear)`);
  } catch (cacheError) {
    console.warn("[Optimize Content] Error clearing cache:", cacheError);
  }
}

// ============================================================================
// Entity Extraction Helpers
// ============================================================================

function buildSiteContext(site?: WordPressSite | null): GeographicSiteContext | undefined {
  if (!site) return undefined;
  const locsSource = site.locations || site.napInfo?.locations || [];
  const locations =
    Array.isArray(locsSource) && locsSource.length > 0
      ? locsSource
          .map((l) => ({
            city: l.city,
            state: l.state,
          }))
          .filter((l) => !!(l.city || l.state))
      : undefined;

  return {
    siteUrl: site.siteUrl,
    siteName: site.name,
    locations,
    napAddress: site.napInfo?.address,
  };
}

export async function extractEntityFromTitle(
  title: string,
  apiKey: string,
  site?: WordPressSite | null
): Promise<string | "N/A"> {
  if (!title || !title.trim()) return "N/A";
  try {
    const origin = await extractGeographicEntityWithAI({ title }, apiKey, buildSiteContext(site));
    return origin && origin.trim() ? origin.trim() : "N/A";
  } catch (error) {
    console.warn("[Entity Extraction] Error extracting from title:", error);
    return "N/A";
  }
}

export async function extractEntityFromUrl(
  url: string,
  title?: string,
  site?: WordPressSite | null
): Promise<string | "N/A"> {
  if (!url) return "N/A";
  try {
    const origin = await extractGeographicEntityWithAI({ url, title }, undefined, buildSiteContext(site));
    return origin && origin.trim() ? origin.trim() : "N/A";
  } catch (error) {
    console.warn("[Entity Extraction] Error extracting from URL:", error);
    return "N/A";
  }
}

export async function determineEntity(
  hasEntityOverride: boolean | undefined,
  title: string,
  url: string,
  apiKey: string,
  site?: WordPressSite | null
): Promise<{ entity: string | "N/A"; cleanedTitle: string }> {
  let extractedEntity: string | "N/A" = "N/A";
  const finalTitle = title;

  if (hasEntityOverride === false) {
    return { entity: "N/A", cleanedTitle: finalTitle };
  }

  try {
    const origin = await extractGeographicEntityWithAI({ title, url }, apiKey, buildSiteContext(site));
    extractedEntity = origin && origin.trim() ? origin.trim() : "N/A";
  } catch (error) {
    console.warn("[Entity Extraction] Error during extraction:", error);
    extractedEntity = "N/A";
  }

  return { entity: extractedEntity, cleanedTitle: finalTitle };
}

// ============================================================================
// GSC Data Helpers
// ============================================================================

export function validateGSCData(gscResult: any): {
  hasValidData: boolean;
  primaryKeyword: string | null;
  isNoQueriesError: boolean;
} {
  const isNoQueriesError =
    gscResult.error &&
    typeof gscResult.error === "string" &&
    gscResult.error.toLowerCase().includes("no valid search queries found");

  let hasValidGSCData = false;
  let primaryKeywordFromGSC: string | null = null;

  if (gscResult.success && gscResult.topKeyword) {
    if (
      gscResult.topKeyword.query !== "Page-level aggregate" &&
      gscResult.topKeyword.query &&
      gscResult.topKeyword.query.trim().length > 0
    ) {
      if (gscResult.queries && Array.isArray(gscResult.queries) && gscResult.queries.length > 0) {
        const keywordExists = gscResult.queries.some((q: any) => q.query === gscResult.topKeyword.query);
        if (keywordExists) {
          hasValidGSCData = true;
          primaryKeywordFromGSC = gscResult.topKeyword.query.trim();
        }
      }
    }
  }

  if (isNoQueriesError) {
    hasValidGSCData = false;
  }

  return {
    hasValidData: hasValidGSCData,
    primaryKeyword: primaryKeywordFromGSC,
    isNoQueriesError,
  };
}

/**
 * Extract keyword from title ONLY using AI (for SEM tasks when no GSC data).
 * Analyzes the title to determine the primary search intent keyword.
 */
export async function extractKeywordFromTitleOnly(
  title: string,
  url: string,
  siteId: string
): Promise<string> {
  if (!title || !title.trim()) {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split("/").filter((s) => s.length > 0);
      const slug = pathSegments[pathSegments.length - 1] || "content";
      return slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    } catch {
      return "content optimization";
    }
  }

  try {
    const openRouterApiKey = loadApiKey();
    if (openRouterApiKey && openRouterApiKey.trim().length > 0) {
      const researchModel = getResearchModel(siteId);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            typeof window !== "undefined" ? window.location.origin : "https://agent-blueprint-builder.com",
          "X-Title": "Agent Blueprint Builder",
        },
        body: JSON.stringify({
          model: researchModel,
          messages: [
            {
              role: "user",
              content: `Analyze this page title and extract the primary search keyword that users would use to find this content:

Page Title: "${title.replace(/<[^>]+>/g, "").trim()}"
Page URL: "${url}"

Extract the main keyword phrase (2-5 words) that best represents what this page is about. Focus on the core topic, not generic terms.
- NEVER use a competitor name or competitor-focused keyword; never optimize for competitors.
- NEVER use Bali Blinds (any casing) or DIY remove/detach topics for Bali blinds.
- this for example is not a good keyword "heritage lane dental edmonton".
- Prefer product-, service-, or topic-based keywords when they fit; not restricted to only those.

Return ONLY the keyword phrase, nothing else. No quotes, no explanation.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 30,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiKeyword = data.choices?.[0]?.message?.content?.trim() || "";
        if (aiKeyword && aiKeyword.length > 2) {
          const cleaned = aiKeyword.replace(/^["']|["']$/g, "").trim().substring(0, 80);
          if (cleaned.length >= 3) {
            return cleaned;
          }
        }
      }
    }
  } catch (error) {
    console.warn("[Keyword Extraction] Failed to extract keyword from title via AI, falling back:", error);
  }

  const cleanTitle = title.replace(/<[^>]+>/g, "").trim();
  if (cleanTitle.length > 0) {
    const words = cleanTitle.split(/\s+/).slice(0, 6);
    return words.join(" ").substring(0, 80);
  }

  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split("/").filter((s) => s.length > 0);
    const slug = pathSegments[pathSegments.length - 1] || "content";
    return slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  } catch {
    return "content optimization";
  }
}

export async function extractKeywordFromContent(
  title: string,
  content: string,
  url: string,
  isEntityPage: boolean,
  siteName: string,
  siteId: string
): Promise<string> {
  let extractedKeyword = "";

  if (isEntityPage && title) {
    try {
      const openRouterApiKey = loadApiKey();
      if (openRouterApiKey && openRouterApiKey.trim().length > 0) {
        const researchModel = getResearchModel(siteId);
        extractedKeyword = await generateLocalKeywordForEntityPage(
          title,
          url,
          siteName,
          openRouterApiKey,
          researchModel
        );
        if (extractedKeyword && extractedKeyword.trim().length > 0) {
          return extractedKeyword.trim();
        }
      }
    } catch (error) {
      console.warn("[Keyword Extraction] Failed to generate AI keyword, falling back:", error);
    }
  }

  if (!extractedKeyword || extractedKeyword.length < 3) {
    if (title && title.trim().length > 0) {
      extractedKeyword = title.trim().replace(/<[^>]+>/g, "").substring(0, 100);
    } else if (content && content.trim().length > 0) {
      const h2Match = content.match(/<h2[^>]*>(.*?)<\/h2>/i);
      if (h2Match && h2Match[1]) {
        extractedKeyword = h2Match[1].replace(/<[^>]+>/g, "").trim().substring(0, 100);
      } else {
        const textContent = content.replace(/<[^>]+>/g, " ").trim();
        extractedKeyword = textContent.split(/[.!?]/)[0].trim().substring(0, 100);
      }
    }

    if (!extractedKeyword || extractedKeyword.length < 3) {
      try {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split("/").filter((s) => s.length > 0);
        const slug = pathSegments[pathSegments.length - 1] || "content";
        extractedKeyword = slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
      } catch {
        extractedKeyword = "content optimization";
      }
    }
  }

  return extractedKeyword;
}

export function extractHeadingsFromContent(content: string): string[] {
  if (!content || typeof content !== "string") return [];
  const headings: string[] = [];
  const htmlRe = /<h[123][^>]*>(.*?)<\/h[123]>/gi;
  let m: RegExpExecArray | null;
  while ((m = htmlRe.exec(content)) !== null) {
    const text = (m[1] || "").replace(/<[^>]+>/g, "").trim();
    if (text) headings.push(text);
  }
  if (headings.length === 0) {
    const mdRe = /^#{1,3}\s+(.+)$/gm;
    while ((m = mdRe.exec(content)) !== null) {
      const text = (m[1] || "").trim();
      if (text) headings.push(text);
    }
  }
  return headings;
}

export async function inferPrimaryKeywordFromTitleAndMeta(
  title: string,
  metaDescription: string | undefined,
  excerpt: string | undefined,
  url: string,
  siteId: string,
  acfKeywordFocus?: string,
  promptModifier?: string,
  pageHeadings?: string[]
): Promise<string> {
  const cleanTitle = (title || "").replace(/<[^>]+>/g, "").trim();
  const meta = (metaDescription || excerpt || "").trim().substring(0, 300);
  const hint = (acfKeywordFocus || "").trim().substring(0, 100);
  const modifier = (promptModifier || "").trim().substring(0, 500);
  const headings =
    pageHeadings && pageHeadings.length > 0
      ? pageHeadings.slice(0, 15).map((h) => h.trim()).filter(Boolean)
      : [];

  try {
    const openRouterApiKey = loadApiKey();
    if (!openRouterApiKey?.trim()) return "";

    const researchModel = getResearchModel(siteId);
    const parts: string[] = [];
    if (modifier) parts.push(`PROMPT MODIFIER (context only; do not copy location from it): "${modifier}"`);
    parts.push(`Page Title: "${cleanTitle || "(none)"}"`, `Page URL: "${url}"`);
    if (headings.length > 0)
      parts.push(`Page headings (use these for context): ${headings.map((h) => `"${h}"`).join(", ")}`);
    if (meta) parts.push(`Meta description / excerpt: "${meta}"`);
    if (hint) parts.push(`Existing keyword focus hint (ignore if it is a company/brand name): "${hint}"`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          typeof window !== "undefined" ? window.location.origin : "https://agent-blueprint-builder.com",
        "X-Title": "Agent Blueprint Builder",
      },
      body: JSON.stringify({
        model: researchModel,
        messages: [
          {
            role: "user",
            content: `Derive the primary SEO keyword for this page. Use the page headings and title to determine what the page is about.

${parts.join("\n")}

RULES:
- Use page headings and title to understand what the page is about (any topic: service, info, legal, terms, privacy, how-to, etc.). Headings define context.
- Return a 2-5 word keyword phrase that describes the main topic or subject of the page (e.g. "terms and conditions", "privacy policy", "service areas", "new patient form", "cellular shades").
- NEVER return a company name, brand name, or business name as the keyword.
- this for example is not a good keyword "heritage lane dental edmonton".
- NEVER use Bali Blinds (any casing) or DIY remove/detach topics for Bali blinds.

- NEVER return a city, region, or location as the keyword.
- For pages: NEVER use a competitor name or competitor-focused keyword; never optimize for competitors. Prefer product-, service-, or topic-based keywords when they fit the page, but you are not restricted to only product/service - use whatever best describes the page topic.
- If a PROMPT MODIFIER is provided, use it only for topic context; strip any location from the modifier and do not include location in your keyword.
- When in doubt, prefer the main heading or clear subject of the page.

Return ONLY the keyword phrase, nothing else. No quotes, no explanation.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 30,
      }),
    });

    if (!response.ok) return "";

    const data = await response.json();
    const aiKeyword = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!aiKeyword || aiKeyword.length < 2) return "";

    const cleaned = aiKeyword.replace(/^["']|["']$/g, "").trim().substring(0, 80);
    return cleaned.length >= 3 ? cleaned : "";
  } catch (error) {
    console.warn("[Keyword Inference] Failed to infer keyword from title/meta via AI:", error);
    return "";
  }
}

export function isNoQueriesError(error: any): boolean {
  if (!error) return false;
  const errorMessage = error instanceof Error ? error.message : String(error);
  return errorMessage.toLowerCase().includes("no valid search queries found");
}
