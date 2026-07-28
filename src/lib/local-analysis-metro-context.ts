import type { WordPressSite } from "@/components/integrations/types";
import { parseCityRegionFromLooseLabel } from "@/lib/gmb-dfs-parse";
import {
  getPrimaryCityStateLabel,
  resolvePrimaryLocationLabel,
} from "@/lib/primary-location-from-site";
import { entityLevelShortLabel } from "@/lib/entity-geographic-level";
import type { EntityGeographicLevel } from "@/lib/entity-geographic-level";

export type MergedWikipediaAugmentInput = {
  /** From `wikipediaSearchAugmentFromGridRows` when a grid CSV exists. */
  gridCsvAugment?: string | null;
  /** Focus location field (city, region phrase). */
  suggestFocusLocation?: string | null;
  /** "Use for radius" label from Find location. */
  radiusLocationLabel?: string | null;
  /** e.g. dominant city from CSV place hints combined with focus. */
  primarySiteLabel?: string | null;
};

/** Merge distinct geography tokens for MediaWiki search (grid + focus + site). */
export function mergeWikipediaSearchAugmentParts(input: MergedWikipediaAugmentInput): string | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (s: string | null | undefined) => {
    const t = s?.trim();
    if (!t) return;
    const k = t.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t.trim());
  };

  push(input.gridCsvAugment);
  const focus = input.suggestFocusLocation?.trim();
  if (focus) {
    push(focus);
    const p = parseCityRegionFromLooseLabel(focus);
    if (p.city) push(p.city);
    if (p.region) push(p.region);
    if (p.city && p.region) push(`${p.city}, ${p.region}`);
  }
  const rad = input.radiusLocationLabel?.trim();
  if (rad) {
    push(rad);
    const pr = parseCityRegionFromLooseLabel(rad);
    if (pr.city) push(pr.city);
    if (pr.region) push(pr.region);
  }
  push(input.primarySiteLabel);

  return out.length > 0 ? out.join(" ") : undefined;
}

export type LocalAnalysisClientAudienceInput = {
  businessName?: string | null;
  siteName?: string | null;
  siteUrl?: string | null;
  /** From `suggestFocusKeyword` in Local analysis. */
  focusKeyword?: string | null;
  focusLocation?: string | null;
  entityGeographicLevel?: EntityGeographicLevel;
  entityTypeFocusLabels?: string[];
  /** First lines of GMB JSON or parsed summary — keep short. */
  gmbContextLine?: string | null;
  /** First few post titles/keywords from inventory (optional). */
  inventorySample?: ReadonlyArray<{ title: string; keyword: string }> | null;
  /** When true, keyword theme percentages come from Master Rules — not focusKeyword alone. */
  themeMixGovernedByMasterRules?: boolean;
};

/**
 * Compact markdown for suggest + Generate SAP: who the site serves and vertical context.
 * No invented demographics; preference language only.
 */
export function buildLocalAnalysisClientAudienceMarkdown(input: LocalAnalysisClientAudienceInput): string {
  const lines: string[] = ["--- Client & site context (preference for **which** places to prioritize — not a substitute for Wikipedia or grid) ---"];
  const name = (input.businessName ?? input.siteName)?.trim();
  if (name) lines.push(`- **Business / site name:** ${name}`);
  const url = input.siteUrl?.trim();
  if (url) lines.push(`- **Website:** ${url}`);
  const fk = input.focusKeyword?.trim();
  if (fk) {
    lines.push(
      input.themeMixGovernedByMasterRules
        ? `- **Optional UI focus theme (secondary):** ${fk} — **CLIENT MASTER INSTRUCTIONS** govern keyword theme mix and percentage splits when present; do not assign this theme to 100% of rows.`
        : `- **Focus service / product theme:** ${fk}`,
    );
  }
  const fl = input.focusLocation?.trim();
  if (fl) lines.push(`- **Focus geographic market:** ${fl}`);
  if (input.entityGeographicLevel) {
    lines.push(`- **Entity geographic scope:** ${input.entityGeographicLevel} (${entityLevelShortLabel(input.entityGeographicLevel)})`);
  }
  if (input.entityTypeFocusLabels && input.entityTypeFocusLabels.length > 0) {
    lines.push(`- **Entity type emphasis:** ${input.entityTypeFocusLabels.join(", ")}`);
  }
  const gmb = input.gmbContextLine?.trim();
  if (gmb) lines.push(`- **Google Business / storefront signal:** ${gmb.slice(0, 400)}${gmb.length > 400 ? "…" : ""}`);
  const inv = input.inventorySample?.filter((x) => (x.title ?? "").trim() || (x.keyword ?? "").trim()).slice(0, 12);
  if (inv && inv.length > 0) {
    const bits = inv.map((p) => {
      const t = (p.title ?? "").trim();
      const k = (p.keyword ?? "").trim();
      if (t && k) return `${t} (${k})`;
      return t || k;
    });
    lines.push(`- **Published content signals (sample):** ${bits.join("; ")}`);
  }
  lines.push(
    "- **How to use:** Among **valid** `###` Wikipedia place titles and grid-backed areas, prefer seeds that plausibly match **who** would search for this business and **where** those people live, work, shop, or commute—without inventing census data or incomes.",
  );
  if (lines.length <= 2) return "";
  return `\n\n${lines.join("\n")}\n`;
}

/** Async: primary city/region from WP when available. */
export async function getPrimaryLabelForWikipediaAugment(site: WordPressSite): Promise<string | undefined> {
  const fromAcf = await resolvePrimaryLocationLabel(site).catch(() => null);
  const t = (fromAcf ?? getPrimaryCityStateLabel(site) ?? "").trim();
  return t.length > 0 ? t : undefined;
}
