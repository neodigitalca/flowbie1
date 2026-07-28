import {
  entityLocationSlugFromRow,
  entityMetroAnchorFromRow,
  entityProductThemeFromRow,
} from "@/lib/sitemap-optimizer/entity-compression-buckets";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

export function entityKeywordFromMembers(members: readonly SitemapOptimizerPostRow[]): string {
  const metro = entityMetroAnchorFromRow(members[0] ?? ({} as SitemapOptimizerPostRow));
  const theme = entityProductThemeFromRow(members[0] ?? ({} as SitemapOptimizerPostRow));
  const themeLabel = theme === "general" ? "window treatments" : theme;
  if (metro === "general") return themeLabel;
  return `${themeLabel} ${metro}`;
}

export const ENTITY_MERGE_AGENT_PREAMBLE = `You are a senior local SEO strategist consolidating overlapping **service-area / location landing pages**.

Your job: plan one definitive **local landing page per city or town** that replaces thin or cannibalizing location URLs in that city. This is NOT a blog article.

Rules:
- Preserve local search intent: blinds, shades, drapery, installation, etc.
- Use **one city per page**; do not merge multiple suburbs into a single metro umbrella page.
- Destination URL must stay under the site's service-area path (never /blog/).
- Primary keyword should reflect the dominant location for that cluster, not a list of every suburb.
- Meta description: local commercial intent, service + geography.`;

export function entityMergeContextForMembers(members: readonly SitemapOptimizerPostRow[]): string {
  const metros = [...new Set(members.map((m) => entityMetroAnchorFromRow(m)))];
  const places = members
    .map((m) => entityLocationSlugFromRow(m) || m.title.trim())
    .filter(Boolean)
    .slice(0, 8);
  return [
    `Metro anchor(s): ${metros.join(", ") || "general"}`,
    `Member locations: ${places.join("; ")}`,
    `Member count: ${members.length}`,
  ].join("\n");
}

export function entityConsolidatedTitleHint(
  members: readonly SitemapOptimizerPostRow[],
  keyword: string,
): string {
  const metro = entityMetroAnchorFromRow(members[0] ?? ({} as SitemapOptimizerPostRow));
  const metroLabel = metro === "general" ? "" : metro.charAt(0).toUpperCase() + metro.slice(1);
  const base = keyword.trim() || members[0]?.title.trim() || "Window Treatments";
  if (metroLabel && !base.toLowerCase().includes(metroLabel.toLowerCase())) {
    return `${base} in ${metroLabel}`;
  }
  return base;
}
