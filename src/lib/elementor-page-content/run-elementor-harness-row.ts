import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { hydrateElementorRow } from "@/lib/elementor-page-content/hydrate-elementor-row";
import { runDesignBreakdownAgent } from "@/lib/elementor-optimizer";
import { applyHarnessSectionToElementor } from "@/lib/elementor-page-content/apply-harness-to-elementor";
import type { ElementorHarnessKind } from "@/lib/elementor-page-content/detect-harness-slots";
import { detectHarnessSlotsFromElementor } from "@/lib/elementor-page-content/detect-harness-slots";
import {
  buildElementorHeadersHarnessHtml,
} from "@/lib/elementor-page-content/elementor-section-harness-html";
import {
  applyElementorSectionCopy,
  sectionOutlineFromJson,
} from "@/lib/elementor-page-content/apply-elementor-section-copy";
import { richestSectionBodyForOptimize } from "@/lib/elementor-page-content/elementor-section-headers-from-cache";
import { parseElementorDataJson, parseElementorSectionOutline } from "@/lib/elementor-page-content/parse-elementor-section-outline";
import { runElementorPageOptimizeFromResearch } from "@/lib/elementor-page-content/run-elementor-page-optimize";
import { resolveElementorSectionFocusKeyword } from "@/lib/elementor-page-content/elementor-section-focus-keyword";
import { resolveElementorTargetSectionId } from "@/lib/elementor-page-content/resolve-elementor-target-section-id";
import {
  formatSitemapLinkTargetsList,
} from "@/lib/overview/overview-blog-links-agent-payload";
import {
  getBlogLinksLinkPoolFromSession,
  loadBlogLinksLinkInventory,
} from "@/lib/overview/overview-blog-links-inventory";
import {
  generateAnswerSectionHtml,
  generateAndPrependOverviewHtml,
  extractAnswerSectionHtml,
  extractOverviewSectionHtml,
} from "@/lib/overview/overview-blog-overview-prepend";
import {
  extractIllustrativeSectionHtml,
  generateAndReplaceScenarioSectionHtml,
} from "@/lib/overview/overview-blog-scenario-section";
import type { ScenarioJsonArtifact } from "@/lib/overview/overview-blog-scenario-harness-sections";

function syntheticBodyHtmlFromHeaders(headers: string[] | undefined): string {
  const titles = (headers ?? []).filter(Boolean);
  if (!titles.length) {
    return "<h2>Services</h2><p>Page content.</p>";
  }
  return titles.map((t) => `<h2>${t}</h2><p>Section body.</p>`).join("");
}

async function resolveInternalLinkTargets(
  site: WordPressSite,
  pageUrl: string,
): Promise<string | undefined> {
  let pool = getBlogLinksLinkPoolFromSession(site.id);
  if (!pool) {
    const loaded = await loadBlogLinksLinkInventory(site);
    pool = loaded?.pool ?? null;
  }
  if (!pool) return undefined;
  return formatSitemapLinkTargetsList(pool, site.siteUrl, pageUrl);
}

export function shouldUseElementorPageHarness(
  sitemapSource: OverviewSitemapSource,
  row: OverviewRow,
): boolean {
  if (sitemapSource === "pages") return Boolean(row.url?.trim());
  return row.contentFormat === "elementor" || Boolean(row.elementorDataJson?.trim());
}

export async function ensureElementorRowHydrated(
  site: WordPressSite,
  row: OverviewRow,
  url: string,
): Promise<Partial<OverviewRow>> {
  const elementorJson = row.elementorDataJson?.trim();
  const breakdown = row.elementorDesignBreakdown?.trim();

  if (elementorJson && breakdown) {
    return row.contentFormat === "elementor" ? {} : { contentFormat: "elementor" as const };
  }

  if (elementorJson && !breakdown) {
    const generated = await runDesignBreakdownAgent(elementorJson, { siteId: site.id });
    return {
      contentFormat: "elementor",
      elementorDesignBreakdown: generated,
    };
  }

  const { patch } = await hydrateElementorRow(site, url, {
    siteId: site.id,
    postId: row.postId,
  });
  return patch;
}

export type RunElementorHarnessRowArgs = {
  site: WordPressSite;
  row: OverviewRow;
  index: number;
  kind: ElementorHarnessKind;
  apiKey: string;
  model?: string;
  targetSectionId?: string;
  targetSectionTitle?: string;
  updateRow: (index: number, patch: Partial<OverviewRow>) => void;
  onProgress?: (message: string) => void;
};

export type RunElementorHarnessRowResult = {
  scenarioArtifact?: ScenarioJsonArtifact;
};

export async function runElementorHarnessRow(
  args: RunElementorHarnessRowArgs,
): Promise<RunElementorHarnessRowResult> {
  const {
    site,
    row,
    index,
    kind,
    apiKey,
    model,
    targetSectionId,
    targetSectionTitle,
    updateRow,
    onProgress,
  } = args;
  const url = row.url?.trim();
  if (!url) return {};

  onProgress?.("Loading Elementor page data…");
  const hydratePatch = await ensureElementorRowHydrated(site, row, url);
  if (Object.keys(hydratePatch).length > 0) {
    updateRow(index, hydratePatch);
  }
  const merged = { ...row, ...hydratePatch };
  const elementorJson = merged.elementorDataJson?.trim();
  if (!elementorJson) return {};

  const isSectionCopy =
    (kind === "section-header" || kind === "section-content" || kind === "section") &&
    Boolean(targetSectionId);
  const isContentOnlyFullPage = kind === "full-page";

  let breakdown = merged.elementorDesignBreakdown?.trim();
  if (!isSectionCopy && !isContentOnlyFullPage && !breakdown) {
    onProgress?.("Building design breakdown…");
    breakdown = await runDesignBreakdownAgent(elementorJson, { siteId: site.id });
    updateRow(index, { elementorDesignBreakdown: breakdown });
  }

  const pageFocusKeyword = merged.focusKeyword?.trim() || merged.title?.trim() || "";
  const connectedSite = { name: site.name ?? site.siteUrl, siteUrl: site.siteUrl };
  const sections = sectionOutlineFromJson(elementorJson);
  const resolvedSectionId =
    targetSectionId && isSectionCopy
      ? resolveElementorTargetSectionId(targetSectionId, sections, {
          sectionTitle: targetSectionTitle,
        })
      : targetSectionId;
  const targetSection =
    resolvedSectionId != null
      ? sections.find((section) => section.id === resolvedSectionId)
      : undefined;
  const sectionFocusKeyword =
    resolvedSectionId && isSectionCopy
      ? resolveElementorSectionFocusKeyword(
          merged,
          resolvedSectionId,
          targetSection?.title ?? targetSectionTitle ?? "",
        )
      : pageFocusKeyword;
  const focusKeyword = sectionFocusKeyword || pageFocusKeyword;
  const bodyH2Titles = merged.blogH2List ?? sections.map((s) => s.title) ?? [];
  const syntheticBody = syntheticBodyHtmlFromHeaders(bodyH2Titles);
  const internalLinkTargets =
    kind === "links" ? await resolveInternalLinkTargets(site, url) : undefined;

  if (kind === "full-page") {
    const seoResearch = merged.seoResearch?.trim() ?? "";
    onProgress?.("Optimizing section body copy (headings unchanged)…");
    const optimized = await runElementorPageOptimizeFromResearch({
      site,
      elementorJson,
      designBreakdown: breakdown,
      seoResearchBrief: seoResearch,
      focusKeyword,
      pageTitle: merged.title,
      pageUrl: url,
      row: merged,
      apiKey,
      model,
      onProgress: (message) => onProgress?.(message),
    });
    const nextJson = JSON.stringify(optimized.modifiedElementorData);
    const sectionHeaders = parseElementorSectionOutline(optimized.modifiedElementorData);
    updateRow(index, {
      ...hydratePatch,
      contentFormat: "elementor",
      elementorDataJson: nextJson,
      elementorDesignBreakdown: optimized.designBreakdown,
      elementorSectionHeaders: sectionHeaders,
      elementorHarnessSlots: detectHarnessSlotsFromElementor(optimized.modifiedElementorData),
      blogH2List: sectionHeaders.map((s) => s.title),
      postContentOptimized: undefined,
    });
    return {};
  }

  let harnessHtml = "";
  let scenarioArtifact: ScenarioJsonArtifact | undefined;

  if (kind === "answer") {
    harnessHtml = await generateAnswerSectionHtml({
      articleTitle: merged.title,
      focusKeyword,
      bodyH2Titles,
      pageUrl: url,
      connectedSite,
      site,
      seoResearchBrief: merged.seoResearch,
      apiKey,
      model,
    });
  } else if (kind === "overview") {
    const prep = await generateAndPrependOverviewHtml({
      sourceHtml: syntheticBody,
      articleTitle: merged.title,
      focusKeyword,
      pageUrl: url,
      connectedSite,
      site,
      seoResearchBrief: merged.seoResearch,
      apiKey,
      model,
    });
    if (!prep?.overviewHtml) throw new Error("Overview section could not be generated.");
    harnessHtml = prep.overviewHtml;
  } else if (kind === "scenario") {
    const prep = await generateAndReplaceScenarioSectionHtml({
      sourceHtml: syntheticBody,
      articleTitle: merged.title,
      focusKeyword,
      pageUrl: url,
      site,
      seoResearchBrief: merged.seoResearch,
      apiKey,
      model,
      mergeIntoSource: false,
    });
    if (!prep.scenarioHtml.trim()) throw new Error("Scenario section could not be generated.");
    harnessHtml = prep.scenarioHtml;
    scenarioArtifact = {
      h2Title: prep.illustrativeH2Title,
      html: prep.scenarioHtml,
    };
  } else if (kind === "headers") {
    if (!sections.length) throw new Error("No Elementor sections to optimize.");
    harnessHtml = buildElementorHeadersHarnessHtml({
      sections,
      focusKeyword,
      seoResearch: merged.seoResearch,
    });
  } else if (kind === "section-header" && resolvedSectionId) {
    const section = targetSection;
    if (!section) return {};
    onProgress?.("Rewriting section heading…");
    const modified = await applyElementorSectionCopy({
      elementorJson,
      sectionId: resolvedSectionId,
      kind: "section-header",
      section,
      focusKeyword,
      pageTitle: merged.title,
      businessName: site.name ?? site.siteUrl,
      seoResearch: merged.seoResearch,
      apiKey,
      model,
    });
    const nextJson = JSON.stringify(modified);
    const sectionHeaders = parseElementorSectionOutline(modified);
    updateRow(index, {
      ...hydratePatch,
      contentFormat: "elementor",
      elementorDataJson: nextJson,
      elementorDesignBreakdown: breakdown,
      elementorSectionHeaders: sectionHeaders,
      elementorHarnessSlots: detectHarnessSlotsFromElementor(modified),
      blogH2List: sectionHeaders.map((s) => s.title),
      postContentOptimized: undefined,
      status: "idle",
    });
    return {};
  } else if (kind === "section-content" && resolvedSectionId) {
    const section = targetSection;
    if (!section) return {};
    const sectionForCopy = richestSectionBodyForOptimize(merged, section);
    onProgress?.("Rewriting section body…");
    const modified = await applyElementorSectionCopy({
      elementorJson,
      sectionId: resolvedSectionId,
      kind: "section-content",
      section: sectionForCopy,
      focusKeyword,
      pageTitle: merged.title,
      businessName: site.name ?? site.siteUrl,
      seoResearch: merged.seoResearch,
      siteBaseUrl: site.siteUrl,
      pageUrl: url,
      apiKey,
      model,
    });
    const nextJson = JSON.stringify(modified);
    const sectionHeaders = parseElementorSectionOutline(modified);
    updateRow(index, {
      ...hydratePatch,
      contentFormat: "elementor",
      elementorDataJson: nextJson,
      elementorDesignBreakdown: breakdown,
      elementorSectionHeaders: sectionHeaders,
      elementorHarnessSlots: detectHarnessSlotsFromElementor(modified),
      blogH2List: sectionHeaders.map((s) => s.title),
      postContentOptimized: undefined,
      status: "idle",
    });
    return {};
  } else if (kind === "section" && resolvedSectionId) {
    const section = targetSection;
    if (!section) return {};
    const sectionForCopy = richestSectionBodyForOptimize(merged, section);
    onProgress?.("Rewriting section body…");
    const modified = await applyElementorSectionCopy({
      elementorJson,
      sectionId: resolvedSectionId,
      kind: "section-content",
      section: sectionForCopy,
      focusKeyword,
      pageTitle: merged.title,
      businessName: site.name ?? site.siteUrl,
      seoResearch: merged.seoResearch,
      siteBaseUrl: site.siteUrl,
      pageUrl: url,
      apiKey,
      model,
    });
    const nextJson = JSON.stringify(modified);
    const sectionHeaders = parseElementorSectionOutline(modified);
    updateRow(index, {
      ...hydratePatch,
      contentFormat: "elementor",
      elementorDataJson: nextJson,
      elementorDesignBreakdown: breakdown,
      elementorSectionHeaders: sectionHeaders,
      elementorHarnessSlots: detectHarnessSlotsFromElementor(modified),
      blogH2List: sectionHeaders.map((s) => s.title),
      postContentOptimized: undefined,
      status: "idle",
    });
    return {};
  } else {
    throw new Error(`Elementor harness kind "${kind}" is not wired yet.`);
  }

  if (!harnessHtml.trim()) {
    throw new Error(`Harness HTML empty for ${kind}.`);
  }

  onProgress?.("Applying Elementor section updates…");
  const applied = await applyHarnessSectionToElementor({
    elementorJson,
    designBreakdown: breakdown!,
    harnessKind: kind,
    harnessHtml,
    focusKeyword,
    targetSectionId,
    siteId: site.id,
  });

  const nextJson = JSON.stringify(applied.modifiedElementorData);
  const sectionHeaders = parseElementorSectionOutline(applied.modifiedElementorData);
  const slots = detectHarnessSlotsFromElementor(applied.modifiedElementorData);

  updateRow(index, {
    ...hydratePatch,
    contentFormat: "elementor",
    elementorDataJson: nextJson,
    elementorDesignBreakdown: breakdown,
    elementorSectionHeaders: sectionHeaders,
    elementorHarnessSlots: slots,
    blogH2List: sectionHeaders.map((s) => s.title),
    postContentOptimized: undefined,
  });

  return { scenarioArtifact };
}

export function elementorPreviewHtmlForKind(
  kind: ElementorHarnessKind,
  row: OverviewRow,
): string {
  const pseudo = row.elementorDataJson ?? "";
  if (kind === "answer") return extractAnswerSectionHtml(pseudo) || "";
  if (kind === "overview") return extractOverviewSectionHtml(pseudo) || "";
  if (kind === "scenario") return extractIllustrativeSectionHtml(pseudo) || "";
  return "";
}
