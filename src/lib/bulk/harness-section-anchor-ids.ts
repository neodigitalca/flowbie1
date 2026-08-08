import type { BulkHarnessOutlineSection } from "@/lib/bulk/bulk-harness-outline";
import {
  BLOG_HARNESS_SUMMARY_AGENT_ID,
  isBlogHarnessSummaryAgent,
} from "@/lib/bulk/blog-harness-summary-agent";

/** Fixed id for the mandatory Overview H2. */
export const HARNESS_OVERVIEW_ANCHOR_ID = "overview";

export type HarnessSectionAnchorEntry = {
  sectionIndex: number;
  displayTitle: string;
  anchorId: string;
};

const MAX_ANCHOR_LEN = 64;

/**
 * Deterministic URL-safe id from an H2 title (lowercase, hyphenated, a-z0-9-).
 * Strips HTML tags by character scan (no attribute parsing).
 */
export function headingTitleToHarnessAnchorId(title: string): string {
  let plain = "";
  let inTag = false;
  for (const ch of title) {
    if (ch === "<") {
      inTag = true;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      continue;
    }
    if (!inTag) plain += ch;
  }

  const lower = plain.trim().toLowerCase();
  let out = "";
  let lastWasHyphen = false;
  for (const ch of lower) {
    const code = ch.charCodeAt(0);
    const isDigit = code >= 48 && code <= 57;
    const isAlpha = code >= 97 && code <= 122;
    if (isDigit || isAlpha) {
      out += ch;
      lastWasHyphen = false;
      continue;
    }
    if (!lastWasHyphen && out.length > 0) {
      out += "-";
      lastWasHyphen = true;
    }
  }
  while (out.endsWith("-")) out = out.slice(0, -1);
  if (out.length > MAX_ANCHOR_LEN) {
    out = out.slice(0, MAX_ANCHOR_LEN);
    while (out.endsWith("-")) out = out.slice(0, -1);
  }
  return out || "section";
}

/**
 * Body-section anchors only (skips Overview / ai-overview-summary).
 * Collision: cost-guide, cost-guide-2, …
 */
export function buildHarnessSectionAnchorMap(
  outline: BulkHarnessOutlineSection[],
): HarnessSectionAnchorEntry[] {
  const used = new Set<string>();
  const entries: HarnessSectionAnchorEntry[] = [];

  for (const section of outline) {
    if (section.agent.id === BLOG_HARNESS_SUMMARY_AGENT_ID) continue;
    if (isBlogHarnessSummaryAgent(section.agent)) continue;
    if (section.index === 0 && section.displayTitle.trim().toLowerCase() === "overview") continue;

    let base = headingTitleToHarnessAnchorId(section.displayTitle);
    if (base === HARNESS_OVERVIEW_ANCHOR_ID) base = "section-overview";
    let anchorId = base;
    let n = 2;
    while (used.has(anchorId)) {
      const suffix = `-${n}`;
      const room = Math.max(1, MAX_ANCHOR_LEN - suffix.length);
      anchorId = `${base.slice(0, room)}${suffix}`;
      n += 1;
    }
    used.add(anchorId);
    entries.push({
      sectionIndex: section.index,
      displayTitle: section.displayTitle,
      anchorId,
    });
  }

  return entries;
}

function escapeHtmlForHeading(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Force the first `<h2>` inner text to the harness display title (blueprint contract).
 * Runs after LLM/length-agent output so scroll anchors and Details drawer titles stay aligned.
 */
export function enforceHarnessSectionHeadingTitle(html: string, displayTitle: string): string {
  const title = displayTitle.trim();
  if (!title || !html?.trim()) return html;

  const open = html.search(/<h2\b/i);
  if (open < 0) return html;
  const gt = html.indexOf(">", open);
  if (gt < 0) return html;
  const closeAt = html.toLowerCase().indexOf("</h2>", gt);
  if (closeAt < 0) return html;

  const safeTitle = escapeHtmlForHeading(title);
  return html.slice(0, gt + 1) + safeTitle + html.slice(closeAt);
}

/**
 * Set `id` on the first `<h2>` opening tag in an HTML fragment.
 * Replaces an existing id if present; otherwise inserts after `<h2`.
 */
export function injectHarnessSectionH2AnchorId(html: string, anchorId: string): string {
  const safeId = headingTitleToHarnessAnchorId(anchorId) || HARNESS_OVERVIEW_ANCHOR_ID;
  const open = html.search(/<h2\b/i);
  if (open < 0) return html;
  const gt = html.indexOf(">", open);
  if (gt < 0) return html;
  const openTag = html.slice(open, gt);
  let nextOpenTag: string;
  if (/\sid\s*=/i.test(openTag)) {
    nextOpenTag = openTag.replace(/\sid\s*=\s*(["'])[^"']*\1/i, ` id="${safeId}"`);
    if (nextOpenTag === openTag) {
      nextOpenTag = openTag.replace(/\sid\s*=\s*[^\s>]+/i, ` id="${safeId}"`);
    }
  } else {
    nextOpenTag = `${openTag} id="${safeId}"`;
  }
  return html.slice(0, open) + nextOpenTag + html.slice(gt);
}

/** Prompt block for Overview: planned same-page citation targets (or context-only when scroll links are manual). */
export function formatHarnessInPageAnchorBlock(
  map: HarnessSectionAnchorEntry[],
  opts?: { contextOnly?: boolean },
): string {
  if (map.length === 0) return "";
  if (opts?.contextOnly) {
    const lines = map.map(
      (e, i) => `Section ${i + 1} → #${e.anchorId} → "${e.displayTitle}"`,
    );
    return (
      `=== OVERVIEW SCROLL-LINK TARGETS (write contextual <ul> after lead <p>) ===\n` +
      `NON-NEGOTIABLE: exactly ${map.length} bullets for ${map.length} body sections — one <li> per line below, in order.\n` +
      `Each <li>: <strong>2–3 word label</strong>: contextual sentence with [[SCROLL:#exact-id|2–4 word phrase]] woven in (code inserts the <a href>). Example: <li><strong>Local Care</strong>: Families choose our [[SCROLL:#${map[0]?.anchorId ?? "section-id"}|preventive cleaning]] for routine visits.</li>\n` +
      `Use the exact #id from each line for href. Anchor text = subtle phrase only — never paste the full H2 title into the link.\n` +
      `FORBIDDEN in Overview: http/https URLs, boilerplate "see … below", or skipping any anchor.\n` +
      `${lines.join("\n")}\n` +
      `=== END OVERVIEW SCROLL-LINK TARGETS ===`
    );
  }
  const n = map.length;
  const lines = map.map(
    (e, i) => `Bullet ${i + 1} → #${e.anchorId} → "${e.displayTitle}"`,
  );
  return (
    `=== IN-PAGE SECTION ANCHORS (same-page citation targets) ===\n` +
    `NON-NEGOTIABLE: exactly ${n} Overview bullets for ${n} body sections — one <li> per line below, in order.\n` +
    `Overview LINKS ARE CLICK-TO-SCROLL ONLY. Every <a> href in this section MUST be one of these #ids.\n` +
    `Each bullet MUST contain exactly one # citation to its assigned anchor. Anchor TEXT must be a subtle 2–4 word phrase woven into the sentence — e.g. <a href="#factors-influencing-solar-panel-prices">cost factors</a>.\n` +
    `FORBIDDEN as link text: the full H2 / display title after the arrow, long section names, or "as detailed in [Full Title]". The titles below are TARGETS only (for picking the #id) — do NOT paste them into the <a>…</a>.\n` +
    `Do not invent other # ids. Do not skip any anchor.\n` +
    `FORBIDDEN in Overview: any http/https URL, any site page path, Wikipedia, Semrush, or non-# href. Body sections may use site links later — not Overview.\n` +
    `${lines.join("\n")}\n` +
    `=== END IN-PAGE SECTION ANCHORS ===`
  );
}

/** Parse first `<h2>` id + title from each body harness piece (post-inject). */
export function extractBodyAnchorsFromHarnessPieces(pieces: string[]): HarnessSectionAnchorEntry[] {
  const entries: HarnessSectionAnchorEntry[] = [];
  const used = new Set<string>();

  pieces.forEach((html, sectionIndex) => {
    const open = html.search(/<h2\b/i);
    if (open < 0) return;
    const gt = html.indexOf(">", open);
    if (gt < 0) return;
    const closeAt = html.toLowerCase().indexOf("</h2>", gt);
    const openTag = html.slice(open, gt + 1);
    const inner = closeAt >= 0 ? html.slice(gt + 1, closeAt) : "";
    const idMatch = openTag.match(/\sid\s*=\s*(["'])([^"']+)\1/i);
    let anchorId = idMatch?.[2]?.trim() ?? "";
    const displayTitle = inner.replace(/<[^>]+>/g, "").trim();
    if (!anchorId) anchorId = headingTitleToHarnessAnchorId(displayTitle);
    if (used.has(anchorId)) {
      let n = 2;
      let next = `${anchorId}-${n}`;
      while (used.has(next)) {
        n += 1;
        next = `${anchorId}-${n}`;
      }
      anchorId = next;
    }
    used.add(anchorId);
    entries.push({ sectionIndex, displayTitle, anchorId });
  });

  return entries;
}

/** Resolve the H2 id to inject for a harness section index. */
export function resolveHarnessSectionInjectAnchorId(
  sectionIndex: number,
  map: HarnessSectionAnchorEntry[],
  opts?: { overviewSection?: boolean },
): string {
  if (opts?.overviewSection) return HARNESS_OVERVIEW_ANCHOR_ID;
  const hit = map.find((e) => e.sectionIndex === sectionIndex);
  return hit?.anchorId ?? `section-${sectionIndex + 1}`;
}
