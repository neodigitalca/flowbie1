import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import type {
  SemrushCompetitorRow,
  TieredCompetitorItem,
  TieredCompetitorsResult,
} from "@/lib/competitor-research/types";

function isDirectTierGroup(g: { tier: string; label: string }): boolean {
  if ((g.tier || "").toLowerCase() === "high") return true;
  const label = (g.label || "").toLowerCase();
  return label.includes("direct") && !label.includes("indirect");
}

/**
 * After LLM tiering, move every domain imported from a Local Dominator grid CSV into the
 * **high / Direct competitors** group. The grid is explicit same-market intent; the default table
 * filter shows “direct” only, so leaving grid rows in medium/low hid them.
 */
export function mergeGridCompetitorsAsDirectTier(
  tiered: TieredCompetitorsResult,
  gridDomainKeys: string[],
  rows: SemrushCompetitorRow[],
  options?: {
    /** Per-item rationale for domains forced into the direct tier (default: grid CSV copy). */
    itemRationale?: string;
    /** Appended to the tiering summary when domains are reclassified (default: Grid CSV note). */
    summaryNote?: string;
  },
): TieredCompetitorsResult {
  const keys = new Set(
    gridDomainKeys.map((k) => normalizeCompetitorDomainKey(k)).filter(Boolean),
  );
  if (keys.size === 0) return tiered;

  const rowByKey = new Map(
    rows.map((r) => [normalizeCompetitorDomainKey(r.domain), r] as const),
  );

  const stripped = tiered.tiers
    .map((g) => ({
      ...g,
      competitors: g.competitors.filter((c) => !keys.has(normalizeCompetitorDomainKey(c.domain))),
    }))
    .filter((g) => g.competitors.length > 0);

  const itemRationale =
    options?.itemRationale ?? "From your Local Dominator grid CSV (same local market).";
  const gridItems: TieredCompetitorItem[] = [];
  for (const k of keys) {
    const row = rowByKey.get(k);
    if (!row) continue;
    gridItems.push({
      domain: row.domain,
      score: 95,
      rationale: itemRationale,
    });
  }
  gridItems.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const directIdx = stripped.findIndex((g) => g.tier === "high" && isDirectTierGroup(g));

  if (directIdx >= 0) {
    const g = stripped[directIdx];
    const existingKeys = new Set(g.competitors.map((c) => normalizeCompetitorDomainKey(c.domain)));
    const mergedComp = [
      ...gridItems.filter((gi) => !existingKeys.has(normalizeCompetitorDomainKey(gi.domain))),
      ...g.competitors,
    ];
    mergedComp.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    stripped[directIdx] = { ...g, competitors: mergedComp };
  } else {
    stripped.unshift({
      tier: "high",
      label: "Direct competitors",
      competitors: gridItems,
    });
  }

  const suffix =
    gridItems.length > 0
      ? options?.summaryNote != null && options.summaryNote.trim() !== ""
        ? ` ${options.summaryNote.trim()}`
        : ` Grid CSV: ${gridItems.length} local-market competitor(s) classified as direct.`
      : "";

  return {
    ...tiered,
    tiers: stripped,
    summary: `${tiered.summary.trim()}${suffix}`.trim(),
  };
}
