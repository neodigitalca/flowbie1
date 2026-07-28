/**
 * Content Optimizer + bulk upload: append a visible FAQ H2 + intro + Q&A table from schema entries.
 * Stages on the grid / post HTML; WordPress write happens via Upload.
 */

import { stitchHarnessSections } from "@/lib/bulk/bulk-harness-outline";
import { repairFaqEntriesFromSchema, type FaqEntry } from "@/lib/faq-entries";
import { generateFaqIntroParagraph } from "@/lib/overview/overview-blog-faq-intro-agent";

export const HARNESS_FAQ_ANCHOR_ID = "faq";
export const FLO_FAQ_CLASS = "flo-faq";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isTagBoundaryChar(ch: string | undefined): boolean {
  if (!ch || ch.length === 0) return true;
  const c = ch.charCodeAt(0);
  if (c <= 32) return true;
  return ch === "/" || ch === ">";
}

function findH2OpenPositions(html: string): number[] {
  const low = html.toLowerCase();
  const out: number[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    if (low.startsWith("<h2", lt) && isTagBoundaryChar(html[lt + 3])) {
      out.push(lt);
      i = lt + 1;
      continue;
    }
    i = lt + 1;
  }
  return out;
}

function plainInnerFromH2Open(html: string, openAt: number): string {
  const closeTag = "</h2>";
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

function headingOpenHasFaqId(html: string, openAt: number): boolean {
  const gt = html.indexOf(">", openAt);
  if (gt < 0) return false;
  const openTag = html.slice(openAt, gt).toLowerCase();
  const needle = `id="${HARNESS_FAQ_ANCHOR_ID}"`;
  const needle2 = `id='${HARNESS_FAQ_ANCHOR_ID}'`;
  return openTag.includes(needle) || openTag.includes(needle2);
}

function normalizeFaqTitleKey(title: string): string {
  return (title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isFaqHeadingTitle(title: string): boolean {
  const key = normalizeFaqTitleKey(title);
  return key === "faq" || key === "frequently asked questions";
}

function isFaqHeadingAt(html: string, openAt: number): boolean {
  if (headingOpenHasFaqId(html, openAt)) return true;
  return isFaqHeadingTitle(plainInnerFromH2Open(html, openAt));
}

function faqSectionEndAt(html: string, openAt: number): number {
  const positions = findH2OpenPositions(html);
  for (const pos of positions) {
    if (pos <= openAt) continue;
    return pos;
  }
  return html.length;
}

function openTagHasFloFaqClass(openTagLower: string): boolean {
  const cls = FLO_FAQ_CLASS.toLowerCase();
  if (openTagLower.includes(`class="${cls}"`) || openTagLower.includes(`class='${cls}'`)) {
    return true;
  }
  if (openTagLower.includes(`class="${cls} `) || openTagLower.includes(`class='${cls} `)) {
    return true;
  }
  if (openTagLower.includes(` ${cls}"`) || openTagLower.includes(` ${cls}'`)) {
    return true;
  }
  return openTagLower.includes(` ${cls} `);
}

/** Start index of `<div class="flo-faq">` immediately before the FAQ H2, or -1. */
function findPrecedingFloFaqDivOpen(html: string, h2OpenAt: number): number {
  const low = html.toLowerCase();
  let searchEnd = h2OpenAt;
  for (let guard = 0; guard < 8; guard += 1) {
    const div = low.lastIndexOf("<div", searchEnd - 1);
    if (div < 0) return -1;
    const gt = html.indexOf(">", div);
    if (gt < 0 || gt >= h2OpenAt) {
      searchEnd = div;
      continue;
    }
    const openTag = low.slice(div, gt + 1);
    if (openTagHasFloFaqClass(openTag)) {
      const between = html.slice(gt + 1, h2OpenAt).trim();
      if (!between) return div;
    }
    searchEnd = div;
  }
  return -1;
}

/** End index after a trailing `</div>` that closes flo-faq, else `from`. */
function endAfterClosingDiv(html: string, from: number): number {
  const low = html.toLowerCase();
  let i = from;
  while (i < html.length) {
    const c = html.charCodeAt(i);
    if (c <= 32) {
      i += 1;
      continue;
    }
    break;
  }
  if (low.startsWith("</div>", i)) return i + 6;
  return from;
}

/** Build visible FAQ section HTML from backend Q/A entries + intro (copy fields as-is into table cells). */
export function buildFaqSectionHtml(entries: FaqEntry[], introParagraph: string): string {
  const intro = (introParagraph ?? "").trim();
  if (!intro) return "";

  const rows = repairFaqEntriesFromSchema(entries ?? [])
    .map((e) => ({
      question: String(e.question ?? "").trim(),
      answer: String(e.answer ?? "").trim(),
    }))
    .filter((e) => e.question.length > 0)
    .map(
      (e) =>
        `<tr><td style="white-space:normal;overflow:visible;word-break:normal;vertical-align:top;">${escapeHtml(e.question)}</td><td style="white-space:normal;overflow:visible;word-break:normal;vertical-align:top;">${escapeHtml(e.answer)}</td></tr>`,
    );
  if (!rows.length) return "";

  const inner = [
    `<h2 id="${HARNESS_FAQ_ANCHOR_ID}">FAQ</h2>`,
    `<p>${escapeHtml(intro)}</p>`,
    `<table style="width:100%;table-layout:auto;"><thead><tr><th style="white-space:normal;">Question</th><th style="white-space:normal;">Answer</th></tr></thead><tbody>${rows.join("")}</tbody></table>`,
  ].join("\n");

  return `<div class="${FLO_FAQ_CLASS}">\n${inner}\n</div>`;
}

/**
 * Remove every FAQ / Frequently Asked Questions H2 section (and flo-faq wrapper) so re-runs replace instead of stacking.
 */
export function stripTrailingFaqSection(html: string): string {
  let src = (html ?? "").trim();
  if (!src) return src;

  for (let guard = 0; guard < 20; guard += 1) {
    const positions = findH2OpenPositions(src);
    let removed = false;
    for (let i = positions.length - 1; i >= 0; i -= 1) {
      const openAt = positions[i]!;
      if (!isFaqHeadingAt(src, openAt)) continue;
      const divStart = findPrecedingFloFaqDivOpen(src, openAt);
      const start = divStart >= 0 ? divStart : openAt;
      let endAt = faqSectionEndAt(src, openAt);
      if (divStart >= 0) {
        endAt = endAfterClosingDiv(src, endAt);
      }
      src = `${src.slice(0, start)}${src.slice(endAt)}`.trim();
      removed = true;
      break;
    }
    if (!removed) break;
  }
  return src;
}

export function resolveFaqSourceHtml(row: {
  postContentOptimized?: string;
  postContent?: string;
}): string {
  return row.postContentOptimized?.trim() || row.postContent?.trim() || "";
}

export type AppendFaqResult = {
  html: string;
  faqSectionHtml: string;
};

/**
 * Strip existing FAQ section(s), then append a fresh FAQ table from schema entries.
 * Returns null when there is no body HTML, no intro, or no usable FAQ entries.
 */
export function appendFaqSectionToPostHtml(args: {
  sourceHtml: string;
  entries: FaqEntry[];
  introParagraph: string;
}): AppendFaqResult | null {
  const source = (args.sourceHtml ?? "").trim();
  if (!source) return null;

  const faqSectionHtml = buildFaqSectionHtml(args.entries, args.introParagraph);
  if (!faqSectionHtml) return null;

  const body = stripTrailingFaqSection(source);
  if (!body.trim()) return null;

  return {
    html: stitchHarnessSections([body, faqSectionHtml]),
    faqSectionHtml,
  };
}

/**
 * OpenRouter intro + deterministic flo-faq table append for bulk / optimizer uploads.
 * Table cells are a direct copy of backend FAQ question/answer fields (no Q:/A: stripping).
 */
export async function appendVisibleFaqTableWithIntro(args: {
  sourceHtml: string;
  entries: FaqEntry[];
  apiKey: string;
  model?: string;
  focusKeyword?: string;
  pageTitle?: string;
}): Promise<AppendFaqResult | null> {
  const usable = repairFaqEntriesFromSchema(args.entries ?? [])
    .map((e) => ({
      question: String(e.question ?? "").trim(),
      answer: String(e.answer ?? "").trim(),
    }))
    .filter((e) => e.question.length > 0);
  if (!usable.length) return null;
  const apiKey = (args.apiKey ?? "").trim();
  if (!apiKey) return null;

  const introParagraph = await generateFaqIntroParagraph({
    apiKey,
    model: args.model,
    focusKeyword: args.focusKeyword,
    pageTitle: args.pageTitle,
    entries: usable,
  });

  return appendFaqSectionToPostHtml({
    sourceHtml: args.sourceHtml,
    entries: usable,
    introParagraph,
  });
}
