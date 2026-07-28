import { extractFirstBalancedJsonValue } from "@/lib/competitor-research/competitor-report-json-parse";
import { z } from "zod";

export type ParsedEntitySapBrief = {
  clusterId: string;
  recommendedPrimaryKeyword: string;
  sapEntity: string;
  recommendedTitle: string;
  sapModifier: string;
  recommendedMeta: string;
  combinedOutline: string[];
  whatToKeepFromEach: Array<{ url: string; title: string; bullets: string[] }>;
  redirectOrCanonicalNote: string;
  priority: "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";
  rationale: string;
};

const confidenceSchema = z.enum(["high", "medium", "low"]);

const keepSchema = z
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

function readString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function unwrapEntitySapBriefRoot(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  for (const key of ["sapRow", "row", "brief", "result", "data", "output"]) {
    const nested = o[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return { ...o, ...(nested as Record<string, unknown>) };
    }
  }
  if (Array.isArray(o.sapRows) && o.sapRows[0] && typeof o.sapRows[0] === "object") {
    return { ...o, ...(o.sapRows[0] as Record<string, unknown>) };
  }
  return o;
}

function outlineFromRaw(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/\n+/)
      .map((s) => s.replace(/^#+\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeEntitySapBriefObject(
  raw: Record<string, unknown>,
  clusterId: string,
): ParsedEntitySapBrief {
  const priorityRaw = readString(raw, "priority");
  const confidenceRaw = readString(raw, "confidence");
  const priority = confidenceSchema.safeParse(priorityRaw).success
    ? (priorityRaw as ParsedEntitySapBrief["priority"])
    : "medium";
  const confidence = confidenceSchema.safeParse(confidenceRaw).success
    ? (confidenceRaw as ParsedEntitySapBrief["confidence"])
    : "medium";

  let whatToKeep: ParsedEntitySapBrief["whatToKeepFromEach"] = [];
  const keepRaw = raw.whatToKeepFromEach ?? raw.what_to_keep_from_each ?? raw.membersToKeep;
  if (Array.isArray(keepRaw)) {
    whatToKeep = keepRaw
      .map((item) => {
        try {
          return keepSchema.parse(item);
        } catch {
          return null;
        }
      })
      .filter((k): k is NonNullable<typeof k> => k != null && Boolean(k.url || k.title));
  }

  return {
    clusterId: readString(raw, "clusterId", "cluster_id") || clusterId,
    recommendedPrimaryKeyword: readString(
      raw,
      "recommendedPrimaryKeyword",
      "recommended_primary_keyword",
      "primaryKeyword",
      "primary_keyword",
      "keyword",
      "focusKeyword",
      "focus_keyword",
    ),
    sapEntity: readString(raw, "sapEntity", "sap_entity", "entity", "location", "serviceArea", "service_area"),
    recommendedTitle: readString(raw, "recommendedTitle", "recommended_title", "title", "pageTitle", "page_title"),
    sapModifier: readString(raw, "sapModifier", "sap_modifier", "modifier", "promptModifier", "prompt_modifier"),
    recommendedMeta: readString(
      raw,
      "recommendedMeta",
      "recommended_meta",
      "meta",
      "metaDescription",
      "meta_description",
    ),
    combinedOutline: outlineFromRaw(raw.combinedOutline ?? raw.combined_outline ?? raw.outline ?? raw.h2Sections),
    whatToKeepFromEach: whatToKeep,
    redirectOrCanonicalNote: readString(
      raw,
      "redirectOrCanonicalNote",
      "redirect_or_canonical_note",
      "redirectNote",
    ),
    priority,
    confidence,
    rationale: readString(raw, "rationale", "reason", "notes"),
  };
}

export function entitySapBriefHasRequiredFields(brief: ParsedEntitySapBrief): boolean {
  return Boolean(
    brief.recommendedPrimaryKeyword.trim() &&
      brief.sapEntity.trim() &&
      brief.recommendedTitle.trim(),
  );
}

export function parseEntitySapBriefJson(content: string, clusterId: string): ParsedEntitySapBrief | null {
  const sub = extractFirstBalancedJsonValue(content);
  if (!sub) return null;
  try {
    const raw = JSON.parse(sub) as unknown;
    const root = unwrapEntitySapBriefRoot(raw);
    return normalizeEntitySapBriefObject(root, clusterId);
  } catch {
    return null;
  }
}
