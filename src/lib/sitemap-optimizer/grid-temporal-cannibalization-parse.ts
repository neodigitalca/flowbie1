import { z } from "zod";
import { extractFirstBalancedJsonValue } from "@/lib/competitor-research/competitor-report-json-parse";

const temporalGroupSchema = z
  .object({
    groupId: z.string().optional(),
    label: z.string().optional(),
    memberPostIds: z.array(z.union([z.string(), z.number()])).optional(),
    pillarSlugStem: z.string().optional(),
    sectionHeaders: z.array(z.string()).optional(),
    rationale: z.string().optional(),
  })
  .transform((g) => ({
    groupId: (g.groupId ?? "").trim(),
    label: (g.label ?? "").trim(),
    memberPostIds: (g.memberPostIds ?? []).map((id) => String(id).trim()).filter(Boolean),
    pillarSlugStem: (g.pillarSlugStem ?? "").trim().toLowerCase(),
    sectionHeaders: (g.sectionHeaders ?? []).map((h) => h.trim()).filter(Boolean),
    rationale: (g.rationale ?? "").trim(),
  }));

const temporalBatchSchema = z
  .object({
    temporalGroups: z.array(temporalGroupSchema).optional(),
    groups: z.array(temporalGroupSchema).optional(),
  })
  .transform((o) => o.temporalGroups ?? o.groups ?? []);

export type GridTemporalGroupAssignment = z.infer<typeof temporalGroupSchema>;

/** Returns [] when the model response has no parseable JSON (caller continues without temporal merge). */
export function parseGridTemporalCannibalizationJson(content: string): GridTemporalGroupAssignment[] {
  const sub = extractFirstBalancedJsonValue(content?.trim() ?? "");
  if (!sub) return [];
  try {
    const raw = JSON.parse(sub) as unknown;
    return temporalBatchSchema.parse(raw);
  } catch {
    return [];
  }
}
