import { z } from "zod";
import { extractFirstBalancedJsonValue } from "@/lib/competitor-research/competitor-report-json-parse";
import { normalizeGridTopicTag } from "@/lib/sitemap-optimizer/grid-tag-key";

const mappingEntrySchema = z
  .object({
    fromTag: z.string().optional(),
    toTag: z.string().optional(),
    tagLabel: z.string().optional(),
  })
  .transform((m) => ({
    fromTag: normalizeGridTopicTag(m.fromTag ?? ""),
    toTag: normalizeGridTopicTag(m.toTag ?? ""),
    tagLabel: (m.tagLabel ?? "").trim(),
  }));

const collapseBatchSchema = z
  .object({
    mappings: z.array(mappingEntrySchema).optional(),
  })
  .transform((o) => o.mappings ?? []);

export type GridTagCollapseMapping = z.infer<typeof mappingEntrySchema>;

export function parseGridTagCollapseJson(content: string): GridTagCollapseMapping[] {
  const sub = extractFirstBalancedJsonValue(content);
  if (!sub) return [];
  try {
    const raw = JSON.parse(sub) as unknown;
    return collapseBatchSchema.parse(raw).filter((m) => m.fromTag && m.toTag);
  } catch {
    return [];
  }
}
