/**
 * Content Optimizer: generate AI Overview HTML and prepend it to existing post body.
 * Stages on the grid; WordPress write happens via Upload (same as Headers/Links).
 */

import type { AgentConfig } from "@/types/agent-config";
import {
  BLOG_HARNESS_SUMMARY_TITLE,
  buildBlogHarnessSummaryAgent,
  isBlogHarnessSummaryAgent,
} from "@/lib/bulk/blog-harness-summary-agent";
import { ensureOverviewBulletBoldLabels } from "@/lib/overview/overview-bullet-bold-labels";
import { applyOverviewHarnessScrollLinks } from "@/lib/overview/overview-harness-scroll-links";
import {
  FLO_OVERVIEW_CLASS,
  wrapOverviewSectionHtml,
} from "@/lib/overview/wrap-overview-section-html";
import {
  formatOutlineTitlesForHarnessPrompt,
  stitchHarnessSections,
  type BulkHarnessOutlineSection,
} from "@/lib/bulk/bulk-harness-outline";
import {
  buildHarnessSectionAnchorMap,
  formatHarnessInPageAnchorBlock,
  HARNESS_OVERVIEW_ANCHOR_ID,
  injectHarnessSectionH2AnchorId,
  type HarnessSectionAnchorEntry,
} from "@/lib/bulk/harness-section-anchor-ids";
import { ensureHarnessSectionLengthCompliance } from "@/lib/bulk/harness-section-length-agent";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getProductionModel } from "@/lib/optimization-settings-storage";
import { extractH2TextsFromHtml } from "@/lib/overview/overview-blog-headers-extract";
import { generateSingleSectionPrompt } from "@/lib/prompt-builders/core";
import { buildBulkHarnessSectionUserPrompt } from "@/lib/prompt-builders/system-user";

function isTagBoundaryChar(ch: string | undefined): boolean {
  if (!ch || ch.length === 0) return true;
  const c = ch.charCodeAt(0);
  if (c <= 32) return true;
  return ch === "/" || ch === ">";
}

/** Document-order start indices of every `<h2` or `<h3` open tag. */
export function findH2OpenPositions(html: string): number[] {
  return findHeadingOpenPositions(html, [2]);
}

function findHeadingOpenPositions(html: string, levels: number[]): number[] {
  const low = html.toLowerCase();
  const out: number[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    let matched = false;
    for (const level of levels) {
      const tag = `h${level}`;
      if (low.startsWith(`<${tag}`, lt) && isTagBoundaryChar(html[lt + tag.length + 1])) {
        out.push(lt);
        matched = true;
        break;
      }
    }
    i = matched ? lt + 1 : lt + 1;
  }
  return out;
}

function headingLevelAt(html: string, openAt: number): 2 | 3 | null {
  const low = html.toLowerCase();
  if (low.startsWith("<h2", openAt) && isTagBoundaryChar(html[openAt + 3])) return 2;
  if (low.startsWith("<h3", openAt) && isTagBoundaryChar(html[openAt + 3])) return 3;
  return null;
}

function plainInnerFromHeadingOpen(html: string, openAt: number): string {
  const level = headingLevelAt(html, openAt);
  if (!level) return "";
  const closeTag = `</h${level}>`;
  const gt = html.indexOf(">", openAt);
  if (gt < 0) return "";
  const close = html.toLowerCase().indexOf(closeTag, gt + 1);
  const inner = close < 0 ? html.slice(gt + 1) : html.slice(gt + 1, close);
  let out = "";
  let inTag = false;
  for (const ch of inner) {
    if (ch === "<") {
      inTag = true;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      continue;
    }
    if (!inTag) out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** @deprecated Prefer plainInnerFromHeadingOpen — kept for H2-only call sites. */
function plainInnerFromH2Open(html: string, openAt: number): string {
  return plainInnerFromHeadingOpen(html, openAt);
}

function headingOpenHasOverviewId(html: string, openAt: number): boolean {
  const gt = html.indexOf(">", openAt);
  if (gt < 0) return false;
  const openTag = html.slice(openAt, gt).toLowerCase();
  const needle = `id="${HARNESS_OVERVIEW_ANCHOR_ID}"`;
  const needle2 = `id='${HARNESS_OVERVIEW_ANCHOR_ID}'`;
  return openTag.includes(needle) || openTag.includes(needle2);
}

function normalizeOverviewTitleKey(title: string): string {
  return (title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isOverviewHeadingTitle(title: string): boolean {
  const key = normalizeOverviewTitleKey(title);
  if (!key) return false;
  if (isBlogHarnessSummaryAgent({ id: "", title: key })) return true;
  if (key === "aio" || key === "ai-overview" || key === "ai overview") return true;
  if (key.startsWith("overview ") || key.startsWith("ai overview")) return true;
  return false;
}

function isOverviewHeadingAt(html: string, openAt: number): boolean {
  if (headingOpenHasOverviewId(html, openAt)) return true;
  return isOverviewHeadingTitle(plainInnerFromHeadingOpen(html, openAt));
}

/**
 * End of an Overview block: next H2/H3, or end of document.
 * Uses H2+H3 so an Overview H3 still ends before the next body H2.
 */
function overviewSectionEndAt(html: string, openAt: number): number {
  const positions = findHeadingOpenPositions(html, [2, 3]);
  for (let i = 0; i < positions.length; i += 1) {
    if (positions[i]! <= openAt) continue;
    return positions[i]!;
  }
  return html.length;
}

/**
 * If Overview sits inside `<div class="flo-overview">…</div>`, start at that open tag
 * so strip/extract do not leave a dangling wrapper.
 */
function overviewBlockStartAt(html: string, headingOpenAt: number): number {
  let i = headingOpenAt;
  while (i > 0) {
    const ch = html[i - 1]!;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i -= 1;
      continue;
    }
    break;
  }
  if (i <= 0 || html[i - 1] !== ">") return headingOpenAt;
  const lt = html.lastIndexOf("<", i - 1);
  if (lt < 0) return headingOpenAt;
  const openTag = html.slice(lt, i).toLowerCase();
  const classNeedle = `class="${FLO_OVERVIEW_CLASS}"`;
  const classNeedle2 = `class='${FLO_OVERVIEW_CLASS}'`;
  if (
    openTag.startsWith("<div") &&
    (openTag.includes(classNeedle) || openTag.includes(classNeedle2))
  ) {
    return lt;
  }
  return headingOpenAt;
}

function overviewBlockBounds(
  html: string,
  headingOpenAt: number,
): { start: number; end: number } {
  return {
    start: overviewBlockStartAt(html, headingOpenAt),
    end: overviewSectionEndAt(html, headingOpenAt),
  };
}

/**
 * Remove every Overview / Summary / AI Overview / AIO H2 or H3 section so re-runs
 * replace instead of stacking. Loops until none remain.
 */
export function stripLeadingOverviewSection(html: string): string {
  let src = (html ?? "").trim();
  if (!src) return src;

  for (let guard = 0; guard < 20; guard += 1) {
    const positions = findHeadingOpenPositions(src, [2, 3]);
    let removed = false;
    for (let i = 0; i < positions.length; i += 1) {
      const openAt = positions[i]!;
      if (!isOverviewHeadingAt(src, openAt)) continue;
      const { start, end } = overviewBlockBounds(src, openAt);
      src = `${src.slice(0, start)}${src.slice(end)}`.trim();
      removed = true;
      break;
    }
    if (!removed) break;
  }
  return src;
}

/**
 * Keep the first Overview/AIO block; strip any later Overview sections (stacked re-runs).
 */
export function dedupeStackedOverviewSections(html: string): string {
  const src = (html ?? "").trim();
  if (!src) return src;
  const positions = findHeadingOpenPositions(src, [2, 3]);
  let firstOverviewStart = -1;
  let firstOverviewEnd = -1;
  for (const openAt of positions) {
    if (!isOverviewHeadingAt(src, openAt)) continue;
    const bounds = overviewBlockBounds(src, openAt);
    firstOverviewStart = bounds.start;
    firstOverviewEnd = bounds.end;
    break;
  }
  if (firstOverviewStart < 0) return src;

  const keptOverview = src.slice(firstOverviewStart, firstOverviewEnd);
  const withoutAll = stripLeadingOverviewSection(src);
  return `${keptOverview}${withoutAll}`.trim();
}

/** Build a harness-shaped outline from body H2 titles (no Overview agent). */
export function outlineFromBodyH2Titles(titles: string[]): BulkHarnessOutlineSection[] {
  return titles.map((title, index) => {
    const trimmed = title.trim() || `Section ${index + 1}`;
    const agent: AgentConfig = {
      id: `body-h2-${index + 1}`,
      step: index + 1,
      title: trimmed,
      description: "",
      features: [],
      headingLevel: 1,
    };
    return {
      index,
      title: trimmed,
      displayTitle: trimmed,
      description: "",
      headingLevel: 1,
      isFaq: false,
      agent,
    };
  });
}

/**
 * Inject planned #ids onto each body `<h2>` in document order (works from the end
 * so earlier offsets stay valid).
 */
export function injectBodyH2AnchorIds(
  html: string,
  map: HarnessSectionAnchorEntry[],
): string {
  const positions = findH2OpenPositions(html);
  if (!positions.length || !map.length) return html;

  let result = html;
  for (let i = Math.min(positions.length, map.length) - 1; i >= 0; i--) {
    const openAt = positions[i]!;
    const anchorId = map[i]?.anchorId;
    if (!anchorId) continue;
    const before = result.slice(0, openAt);
    const from = result.slice(openAt);
    result = before + injectHarnessSectionH2AnchorId(from, anchorId);
  }
  return result;
}

export function resolveOverviewSourceHtml(row: {
  postContentOptimized?: string;
  postContent?: string;
}, fetchedHtml?: string): string {
  return (
    row.postContentOptimized?.trim() ||
    row.postContent?.trim() ||
    fetchedHtml?.trim() ||
    ""
  );
}

/** Reject Cloudflare / full-document challenge pages mistakenly used as post body. */
export function looksLikeBlockedHostHtml(html: string): boolean {
  const raw = (html ?? "").trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (lower.includes("attention required") && lower.includes("cloudflare")) return true;
  if (lower.includes("just a moment") && lower.includes("cloudflare")) return true;
  if (lower.includes("_cf_chl_opt") || lower.includes("cf-browser-verification")) return true;
  if (lower.startsWith("<!doctype html") && lower.includes("cloudflare")) return true;
  return false;
}

/** Slice the Overview H2/H3 block (through the next heading) for row preview. */
export function extractOverviewSectionHtml(html: string): string {
  const src = (html ?? "").trim();
  if (!src) return "";
  const positions = findHeadingOpenPositions(src, [2, 3]);
  for (let i = 0; i < positions.length; i++) {
    const openAt = positions[i]!;
    if (!isOverviewHeadingAt(src, openAt)) continue;
    const { start, end } = overviewBlockBounds(src, openAt);
    return src.slice(start, end).trim();
  }
  return "";
}

export type PrependOverviewResult = {
  html: string;
  bodyH2Titles: string[];
  anchorMap: HarnessSectionAnchorEntry[];
};

/**
 * Pure stitch path used by tests: strip Overview, inject body ids, prepend Overview HTML.
 */
export function stitchOverviewOntoBody(args: {
  sourceHtml: string;
  overviewHtml: string;
}): PrependOverviewResult {
  const stripped = stripLeadingOverviewSection(args.sourceHtml);
  const bodyH2Titles = extractH2TextsFromHtml(stripped).filter(
    (t) => !isOverviewHeadingTitle(t),
  );
  const outline = outlineFromBodyH2Titles(bodyH2Titles);
  const anchorMap = buildHarnessSectionAnchorMap(outline);
  const bodyWithIds = injectBodyH2AnchorIds(stripped, anchorMap);
  const overviewWithId = wrapOverviewSectionHtml(
    injectHarnessSectionH2AnchorId(
      args.overviewHtml.trim(),
      HARNESS_OVERVIEW_ANCHOR_ID,
    ),
  );
  return {
    html: stitchHarnessSections([overviewWithId, bodyWithIds]),
    bodyH2Titles,
    anchorMap,
  };
}

export async function generateAndPrependOverviewHtml(args: {
  sourceHtml: string;
  articleTitle: string;
  focusKeyword: string;
  pageUrl?: string;
  connectedSite?: { name: string; siteUrl: string };
  apiKey: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<PrependOverviewResult> {
  const stripped = stripLeadingOverviewSection(args.sourceHtml);
  if (!stripped.trim()) {
    throw new Error("No HTML body to prepend Overview onto");
  }
  if (looksLikeBlockedHostHtml(stripped)) {
    throw new Error(
      "Post body looks like a Cloudflare block page, not WordPress content. Re-scrape or reload inventory, then retry Overview.",
    );
  }

  const bodyH2Titles = extractH2TextsFromHtml(stripped).filter(
    (t) => !isOverviewHeadingTitle(t),
  );
  if (!bodyH2Titles.length) {
    throw new Error("No H2 headings to cite from Overview");
  }

  const outline = outlineFromBodyH2Titles(bodyH2Titles);
  const anchorMap = buildHarnessSectionAnchorMap(outline);
  const bodyWithIds = injectBodyH2AnchorIds(stripped, anchorMap);
  const anchorBlock = formatHarnessInPageAnchorBlock(anchorMap);
  const overviewAgent = buildBlogHarnessSummaryAgent();
  const sectionPrompt = generateSingleSectionPrompt(overviewAgent, "html");
  const keyword = args.focusKeyword.trim() || args.articleTitle.trim() || "this topic";
  const purpose = `AI Overview opener for "${keyword}" that answers the primary keyword and cites body sections via same-page #anchors.`;
  const outlineBlock = formatOutlineTitlesForHarnessPrompt(outline);
  const userPrompt = buildBulkHarnessSectionUserPrompt(
    args.articleTitle.trim() || keyword,
    purpose,
    sectionPrompt,
    outlineBlock,
    bodyH2Titles,
    0,
    outline.length + 1,
    args.connectedSite,
    undefined,
    { keywordFocus: keyword },
    true,
    args.pageUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    anchorBlock,
  );

  const system = `You write the Overview (AI Overview) harness section for an existing blog post. Output HTML only for this section. Follow the section contract exactly. Primary keyword: ${keyword}.

BOLD LABELS (NON-NEGOTIABLE): Every key-point <li> MUST start with a bold label tag, then a colon: <li><strong>Label</strong>: description…</li>. Example: <li><strong>Cost Breakdown</strong>: discover average costs and what influences them.</li>. Never put a comma after </strong>. Plain text without <strong> is INVALID. Do not skip <strong>.`;

  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model?.trim() || getProductionModel(),
    system,
    user: userPrompt,
    maxTokens: 768,
    temperature: 0.35,
    signal: args.signal,
  });

  let overviewHtml = (content || "").trim();
  if (!overviewHtml) {
    throw new Error("Overview agent returned empty HTML");
  }

  overviewHtml = await ensureHarnessSectionLengthCompliance({
    sectionHtml: overviewHtml,
    sectionTitle: BLOG_HARNESS_SUMMARY_TITLE,
    siblingSectionTitles: bodyH2Titles,
    articleTitle: args.articleTitle.trim() || keyword,
    apiKey: args.apiKey,
    model: args.model,
    signal: args.signal,
    isOverviewSection: true,
    inPageAnchorBlock: anchorBlock,
    overviewBulletCount: anchorMap.length,
  });

  overviewHtml = ensureOverviewBulletBoldLabels(overviewHtml);
  if (anchorMap.length === 0) {
    throw new Error("Overview scroll links: no body H2 anchors to cite");
  }
  overviewHtml = await applyOverviewHarnessScrollLinks({
    html: overviewHtml,
    anchorMap,
    articleTitle: args.articleTitle.trim() || keyword,
    keyword,
    apiKey: args.apiKey,
    model: args.model,
    signal: args.signal,
    inPageAnchorBlock: anchorBlock,
  });
  overviewHtml = injectHarnessSectionH2AnchorId(overviewHtml, HARNESS_OVERVIEW_ANCHOR_ID);
  overviewHtml = wrapOverviewSectionHtml(overviewHtml);

  return {
    html: stitchHarnessSections([overviewHtml, bodyWithIds]),
    bodyH2Titles,
    anchorMap,
  };
}
