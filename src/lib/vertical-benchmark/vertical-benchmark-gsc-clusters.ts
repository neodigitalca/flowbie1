import type { GscTop10RagPage } from "@/lib/vertical-benchmark/vertical-benchmark-gsc-rag";
import { WINDOW_TREATMENT_BRAND_CHECKS } from "@/lib/vertical-benchmark/vertical-benchmark-site-context";

export type BrandProductLineCluster = {
  brandLabel: string;
  /** Highest-click page in the cluster; sole source_exemplar_url for the merged row. */
  leadPage: GscTop10RagPage;
  memberPages: GscTop10RagPage[];
};

function isComparisonUrl(url: string): boolean {
  return /\bvs\.?\b|\bversus\b/i.test(url);
}

function brandLabelForPage(url: string): string | null {
  for (const brand of WINDOW_TREATMENT_BRAND_CHECKS) {
    if (brand.slugPattern.test(url) || brand.textPattern.test(url)) {
      return brand.label;
    }
  }
  return null;
}

/** True when URL looks like a single product-line page for a brand (not a vs/comparison URL). */
function isBrandProductLinePage(page: GscTop10RagPage, brandLabel: string): boolean {
  const url = page.url ?? "";
  if (isComparisonUrl(url)) return false;
  const brand = WINDOW_TREATMENT_BRAND_CHECKS.find((b) => b.label === brandLabel);
  if (!brand) return false;
  return brand.slugPattern.test(url) || brand.textPattern.test(url);
}

/**
 * Groups GSC post URLs that are same-brand product-line pages (2+) so Curate emits one merged blog.
 */
export function detectBrandProductLineClusters(
  pages: GscTop10RagPage[],
  _verifiedBrands?: string[],
): BrandProductLineCluster[] {
  if (pages.length < 2) return [];

  const byBrand = new Map<string, GscTop10RagPage[]>();
  for (const page of pages) {
    const label = brandLabelForPage(page.url ?? "");
    if (!label || !isBrandProductLinePage(page, label)) continue;
    const list = byBrand.get(label) ?? [];
    list.push(page);
    byBrand.set(label, list);
  }

  const clusters: BrandProductLineCluster[] = [];
  for (const [brandLabel, members] of byBrand) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
    clusters.push({
      brandLabel,
      leadPage: sorted[0]!,
      memberPages: sorted,
    });
  }
  return clusters;
}

/** GSC URLs that should not get their own CSV row (merged into cluster lead). */
export function mergedAwayUrls(clusters: BrandProductLineCluster[]): Set<string> {
  const out = new Set<string>();
  for (const c of clusters) {
    for (const p of c.memberPages) {
      const u = p.url?.trim();
      if (u && u !== c.leadPage.url?.trim()) out.add(u);
    }
  }
  return out;
}

/** One bulk row per standalone GSC URL plus one per cluster (not per merged member). */
export function buildGscOutputPages(
  pages: GscTop10RagPage[],
  clusters: BrandProductLineCluster[],
): GscTop10RagPage[] {
  const away = mergedAwayUrls(clusters);
  return pages.filter((p) => !away.has(p.url?.trim() ?? ""));
}

export function buildGscClusterPromptBlock(
  pages: GscTop10RagPage[],
  clusters: BrandProductLineCluster[],
  outputPages: GscTop10RagPage[],
): string {
  if (!clusters.length) {
    return `=== GSC ROW COUNT ===
Output exactly ${outputPages.length} row(s) in rows[] — one per numbered GSC line below (same order).`;
  }

  const lines: string[] = [
    "=== GSC MERGED CLUSTERS (mandatory — fewer rows than raw GSC URLs) ===",
    `Output exactly ${outputPages.length} object(s) in rows[] (not ${pages.length}).`,
    "Do NOT output a separate row for any URL listed as merged-into-cluster.",
    "For each cluster: ONE roundup/guide/explainer post on the lead URL only (modifier guide or explainer, never product review).",
    "Title must cover that brand's product lines in one article (systems compared, which line fits), not separate product-review headlines per line.",
    "",
  ];

  clusters.forEach((c, i) => {
    const merged = c.memberPages
      .filter((p) => p.url?.trim() !== c.leadPage.url?.trim())
      .map((p) => p.url)
      .join("\n  - ");
    lines.push(
      `Cluster ${i + 1} — ${c.brandLabel} (${c.memberPages.length} GSC URLs → 1 blog row):`,
      `  Lead URL (source_exemplar_url for this cluster): ${c.leadPage.url} (clicks ${c.leadPage.clicks})`,
      merged ? `  Merged URLs (no separate rows):\n  - ${merged}` : "",
      "",
    );
  });

  lines.push("=== END GSC MERGED CLUSTERS ===");
  return lines.join("\n");
}
