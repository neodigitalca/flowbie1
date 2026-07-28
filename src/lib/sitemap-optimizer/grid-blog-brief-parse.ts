import { z } from "zod";
import { extractFirstBalancedJsonValue } from "@/lib/competitor-research/competitor-report-json-parse";
import type { SitemapOptimizerMergeRecommendation } from "@/lib/sitemap-optimizer/types";

const confidenceSchema = z.enum(["high", "medium", "low"]);

const mergeKeepSchema = z
  .object({
    url: z.string().optional(),
    title: z.string().optional(),
    bullets: z.array(z.string()).optional(),
    keep: z.array(z.string()).optional(),
  })
  .transform((k) => ({
    url: (k.url ?? "").trim(),
    title: (k.title ?? "").trim(),
    bullets: (k.bullets ?? k.keep ?? []).map((b) => String(b).trim()).filter(Boolean),
  }));

const mergeBriefEntrySchema = z
  .object({
    clusterId: z.string().optional(),
    recommendedTitle: z.string().optional(),
    recommendedPrimaryKeyword: z.string().optional(),
    recommendedMeta: z.string().optional(),
    combinedOutline: z.union([z.array(z.string()), z.string()]).optional(),
    whatToKeepFromEach: z.array(mergeKeepSchema).optional(),
    redirectOrCanonicalNote: z.string().optional(),
    priority: confidenceSchema.optional(),
    confidence: confidenceSchema.optional(),
    rationale: z.string().optional(),
    lockedDestinationUrl: z.string().optional(),
  })
  .transform((m) => {
    const outlineRaw = m.combinedOutline;
    const combinedOutline = Array.isArray(outlineRaw)
      ? outlineRaw.map((s) => String(s).trim()).filter(Boolean)
      : typeof outlineRaw === "string"
        ? outlineRaw
            .split(/\n+/)
            .map((s) => s.replace(/^#+\s*/, "").trim())
            .filter(Boolean)
        : [];
    return {
      clusterId: (m.clusterId ?? "").trim(),
      recommendedTitle: (m.recommendedTitle ?? "").trim(),
      recommendedPrimaryKeyword: (m.recommendedPrimaryKeyword ?? "").trim(),
      recommendedMeta: (m.recommendedMeta ?? "").trim(),
      combinedOutline,
      whatToKeepFromEach: m.whatToKeepFromEach ?? [],
      redirectOrCanonicalNote: (m.redirectOrCanonicalNote ?? "").trim(),
      priority: m.priority ?? ("medium" as const),
      confidence: m.confidence ?? ("medium" as const),
      rationale: (m.rationale ?? "").trim(),
      lockedDestinationUrl: (m.lockedDestinationUrl ?? "").trim() || undefined,
    };
  });

const briefBatchSchema = z
  .object({
    briefs: z.array(mergeBriefEntrySchema).optional(),
    merges: z.array(mergeBriefEntrySchema).optional(),
  })
  .transform((o) => o.briefs ?? o.merges ?? []);

export function parseGridBlogBriefBatchJson(content: string): SitemapOptimizerMergeRecommendation[] {
  const sub = extractFirstBalancedJsonValue(content);
  if (!sub) return [];
  try {
    const raw = JSON.parse(sub) as unknown;
    return briefBatchSchema.parse(raw);
  } catch {
    return [];
  }
}
