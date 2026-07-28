import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import type { HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import type { BlogLinksPlanResult } from "@/lib/overview/overview-blog-links-agent";
import type { BlogHeadersGscPicks } from "@/lib/overview/overview-blog-headers-gsc";
import { formatBlogHeadersGscHarnessMarkdown } from "@/lib/overview/overview-blog-headers-gsc";
import type { BlogInternalLinkSpan } from "@/lib/overview/overview-blog-links-extract";
import type { BlogLinksAddResult, BlogLinksReplaceResult } from "@/lib/overview/overview-blog-links-apply-local";
import { WORDS_PER_LINK_ADD } from "@/lib/overview/overview-blog-links-budget";
import { linkUrlEqual } from "@/lib/overview/overview-blog-links-plan-filter";
import type { BlogLinksCatalogRow } from "@/lib/overview/overview-blog-links-catalog";

export const LINKS_SECTION_GSC = 0;
export const LINKS_SECTION_ANALYZE = 1;

export const LINKS_HARNESS_SECTION_COUNT = 2;

export function linksHarnessSectionCount(_row: BlogLinksCatalogRow): number {
  return LINKS_HARNESS_SECTION_COUNT;
}

export function linksHarnessSectionTitle(_row: BlogLinksCatalogRow, sectionIndex: number): string {
  if (sectionIndex === LINKS_SECTION_GSC) return "GSC + Sitemap";
  if (sectionIndex === LINKS_SECTION_ANALYZE) return "Analyze";
  return "Analyze";
}

export function buildLinksHarnessSectionsForRow(row: BlogLinksCatalogRow): HarnessSectionListItem[] {
  return Array.from({ length: LINKS_HARNESS_SECTION_COUNT }, (_, sectionIndex) => ({
    sectionIndex,
    title: linksHarnessSectionTitle(row, sectionIndex),
    status: "waiting" as const,
  }));
}

export function makeLinksHarnessStartPayloadForRow(
  rowIndex: number,
  row: BlogLinksCatalogRow,
  sectionIndex: number,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections: LINKS_HARNESS_SECTION_COUNT,
    title: linksHarnessSectionTitle(row, sectionIndex),
    phase: "start",
  };
}

export function makeLinksHarnessDonePayloadForRow(
  rowIndex: number,
  row: BlogLinksCatalogRow,
  sectionIndex: number,
  markdownSlice: string,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections: LINKS_HARNESS_SECTION_COUNT,
    title: linksHarnessSectionTitle(row, sectionIndex),
    phase: "done",
    markdownSlice,
  };
}

export function formatLinksAnalyzeMarkdown(
  existingLinks: BlogInternalLinkSpan[],
  postCount: number,
  pageCount: number,
  wordCount: number,
  sectionHeadings: number,
  linksToAdd: number,
): string {
  const lines = [
    `WORD COUNT: ${wordCount} | SECTION HEADINGS (h2/h3): ${sectionHeadings}`,
    `LINKS TO ADD: ${linksToAdd} (max of 1 per heading, 1 per ${WORDS_PER_LINK_ADD} words)`,
    "",
  ];
  if (!existingLinks.length) {
    lines.push("INTERNAL LINKS: none in body HTML.");
  } else {
    lines.push(`INTERNAL LINKS (${existingLinks.length} in WordPress body):`, "");
    for (const link of existingLinks) {
      lines.push(`  #${link.index + 1} [${link.anchor || "(no anchor)"}]`);
      lines.push(`    ${link.href}`);
    }
  }
  lines.push("", `SITEMAP: ${postCount} posts | ${pageCount} pages (preloaded)`);
  return lines.join("\n");
}

export function formatLinksAnalyzeAndApplyMarkdown(
  row: BlogLinksCatalogRow,
  replacements: BlogLinksReplaceResult[],
  additions: BlogLinksAddResult[],
  intentKeywords: string[],
): string {
  const base = formatLinksAnalyzeMarkdown(
    row.existingLinks,
    row.linkPool.postCount,
    row.linkPool.pageCount,
    row.wordCount,
    row.sectionHeadings,
    row.linksToAdd,
  );
  const lines = [base, ""];

  if (replacements.length) {
    lines.push("REPLACEMENTS:");
    for (let i = 0; i < replacements.length; i += 1) {
      const r = replacements[i]!;
      const kw = intentKeywords[i]?.trim();
      lines.push(`  #${i + 1} [${r.anchor}] ${r.ok ? "OK" : "SKIPPED"}`);
      lines.push(`    WAS: ${r.was}`);
      lines.push(`    NOW: ${r.now || "(unchanged)"}`);
      if (kw) lines.push(`    KEYWORD: ${kw}`);
    }
    lines.push("");
  }

  if (additions.length) {
    lines.push("ADDED:");
    for (const a of additions) {
      lines.push(`  ${a.ok ? "OK" : "SKIPPED"} ¶${a.paragraphIndex + 1} [${a.anchor}] → ${a.url || "(none)"}`);
    }
    lines.push("");
  }

  const replaced = replacements.filter((r) => r.ok).length;
  const added = additions.filter((a) => a.ok).length;
  lines.push(`APPLIED: ${replaced} replaced | ${added} added`);
  return lines.join("\n").trimEnd();
}

export function formatLinksGscSitemapMarkdown(
  picks: BlogHeadersGscPicks,
  postCount: number,
  pageCount: number,
): string {
  const gscBlock = formatBlogHeadersGscHarnessMarkdown(picks);
  const lines = [
    gscBlock,
    "",
    `SITEMAP INVENTORY: ${postCount} posts | ${pageCount} pages loaded`,
  ];
  if (!picks.totalQueries) {
    lines.push("Proceeding with sitemap targets and body anchors.");
  }
  return lines.join("\n");
}

export function formatLinksVerifyMarkdown(
  ok: boolean,
  reason?: string,
  replacedCount?: number,
  addedCount?: number,
): string {
  if (!ok) {
    return ["VERIFY: FAILED", reason ?? "Unknown error"].join("\n");
  }
  const parts = ["VERIFY: PASSED"];
  if (addedCount && addedCount > 0) {
    parts.push(`Added ${addedCount} link(s).`);
  }
  if (replacedCount != null && replacedCount > 0) {
    parts.push(`Replaced: ${replacedCount}`);
  }
  return parts.join("\n");
}

export function countPlannedLinkReplacements(
  plan: BlogLinksPlanResult,
  existingLinks: BlogInternalLinkSpan[],
): number {
  return plan.linkActions.filter((a) => {
    if (a.action !== "replace") return false;
    const was = existingLinks[a.index]?.normalizedHref ?? "";
    const now = a.proposedUrl.trim();
    return was && now && !linkUrlEqual(was, now);
  }).length;
}
