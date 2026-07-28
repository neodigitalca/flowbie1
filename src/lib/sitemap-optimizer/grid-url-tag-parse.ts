import { z } from "zod";
import { extractFirstBalancedJsonValue } from "@/lib/competitor-research/competitor-report-json-parse";
import {
  normalizeGridGeoTag,
  normalizeGridTopicTag,
} from "@/lib/sitemap-optimizer/grid-tag-key";
import type { GridUrlIntent } from "@/lib/sitemap-optimizer/types";

const intentSchema = z.enum(["informational", "commercial", "transactional", "local", "mixed"]);

const tagEntrySchema = z
  .object({
    postId: z.union([z.string(), z.number()]).optional(),
    topicTag: z.string().optional(),
    geoTag: z.string().optional(),
    intent: z.union([intentSchema, z.string()]).optional(),
    tagLabel: z.string().optional(),
  })
  .transform((t) => ({
    postId: String(t.postId ?? "").trim(),
    topicTag: normalizeGridTopicTag(t.topicTag ?? ""),
    geoTag: normalizeGridGeoTag(t.geoTag),
    intent: (intentSchema.safeParse(t.intent).success
      ? intentSchema.parse(t.intent)
      : "mixed") as GridUrlIntent,
    tagLabel: (t.tagLabel ?? "").trim() || "Untagged",
  }));

const tagBatchSchema = z
  .object({
    tags: z.array(tagEntrySchema).optional(),
    rows: z.array(tagEntrySchema).optional(),
  })
  .transform((o) => o.tags ?? o.rows ?? []);

export type GridUrlTagAssignment = z.infer<typeof tagEntrySchema>;

export function parseGridUrlTagBatchJson(content: string): GridUrlTagAssignment[] {
  const sub = extractFirstBalancedJsonValue(content);
  if (!sub) return [];
  try {
    const raw = JSON.parse(sub) as unknown;
    return tagBatchSchema.parse(raw);
  } catch {
    return [];
  }
}
