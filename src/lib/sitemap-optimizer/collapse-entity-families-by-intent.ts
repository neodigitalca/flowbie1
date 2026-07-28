import type {
  EntityRedirectFamily,
  EntityRedirectPlan,
} from "@/lib/sitemap-optimizer/entity-redirect-plan-parse";
import {
  isPlaceholderKeyword,
  isPlaceholderSapEntity,
} from "@/lib/sitemap-optimizer/entity-strategy-placeholders";

/** Normalize keyword + entity for duplicate new-content detection. */
export function entityContentIntentKey(keyword: string, entity: string): string {
  const kw = keyword.toLowerCase().replace(/\s+/g, " ").trim();
  const ent = entity.toLowerCase().replace(/\s+/g, " ").trim();
  if (!kw || !ent) return "";
  return `${kw}||${ent}`;
}

function familyIntentKey(family: EntityRedirectFamily): string {
  const kw = family.recommendedPrimaryKeyword?.trim() ?? "";
  const ent = family.sapEntity?.trim() ?? "";
  if (isPlaceholderKeyword(kw) || isPlaceholderSapEntity(ent)) return "";
  return entityContentIntentKey(kw, ent);
}

function mergeWhatToKeep(
  a: EntityRedirectFamily["whatToKeepFromEach"],
  b: EntityRedirectFamily["whatToKeepFromEach"],
): EntityRedirectFamily["whatToKeepFromEach"] {
  const byUrl = new Map<string, NonNullable<EntityRedirectFamily["whatToKeepFromEach"]>[number]>();
  for (const keep of [...(a ?? []), ...(b ?? [])]) {
    const key = keep.url.trim().toLowerCase();
    if (key && !byUrl.has(key)) byUrl.set(key, keep);
  }
  return [...byUrl.values()];
}

function mergeOutline(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of [...(a ?? []), ...(b ?? [])]) {
    const t = line.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.length ? out : undefined;
}

function mergeModifier(a: string | undefined, b: string | undefined): string | undefined {
  const parts = [a?.trim(), b?.trim()].filter(Boolean) as string[];
  if (!parts.length) return undefined;
  if (parts.length === 1) return parts[0];
  const combined = parts.join(" ");
  return combined.slice(0, 800);
}

function pickLead(a: EntityRedirectFamily, b: EntityRedirectFamily): EntityRedirectFamily {
  if (a.sourcePostIds.length !== b.sourcePostIds.length) {
    return a.sourcePostIds.length >= b.sourcePostIds.length ? a : b;
  }
  return a.familyId.localeCompare(b.familyId) <= 0 ? a : b;
}

function mergeFamilies(a: EntityRedirectFamily, b: EntityRedirectFamily): EntityRedirectFamily {
  const lead = pickLead(a, b);
  const other = lead === a ? b : a;
  const sourceIds = new Set<string>([...lead.sourcePostIds, ...other.sourcePostIds]);
  if (!sourceIds.has(other.destinationPostId)) {
    sourceIds.add(other.destinationPostId);
  }
  return {
    ...lead,
    sourcePostIds: [...sourceIds],
    whatToKeepFromEach: mergeWhatToKeep(lead.whatToKeepFromEach, other.whatToKeepFromEach),
    combinedOutline: mergeOutline(lead.combinedOutline, other.combinedOutline),
    sapModifier: mergeModifier(lead.sapModifier, other.sapModifier),
    rationale:
      lead.rationale.trim() ||
      other.rationale.trim() ||
      "Collapsed duplicate keyword+entity replacement into one destination.",
  };
}

/**
 * One replacement family per unique keyword + sapEntity.
 * Street-level compress families that Transform generalized to the same city keyword
 * must not ship as duplicate new content.
 */
export function collapseEntityFamiliesByIntent(
  plan: EntityRedirectPlan,
): EntityRedirectPlan {
  const order: string[] = [];
  const byIntent = new Map<string, EntityRedirectFamily>();
  const passthrough: EntityRedirectFamily[] = [];

  for (const family of plan.families) {
    const key = familyIntentKey(family);
    if (!key) {
      passthrough.push(family);
      continue;
    }
    const existing = byIntent.get(key);
    if (!existing) {
      byIntent.set(key, family);
      order.push(key);
      continue;
    }
    byIntent.set(key, mergeFamilies(existing, family));
  }

  return {
    families: [...order.map((k) => byIntent.get(k)!), ...passthrough],
  };
}
