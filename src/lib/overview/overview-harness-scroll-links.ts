import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseJsonWithRepair } from "@/lib/json-repair-utility";
import type { HarnessSectionAnchorEntry } from "@/lib/bulk/harness-section-anchor-ids";
import { getProductionModel } from "@/lib/optimization-settings-storage";

export type OverviewHarnessScrollLinkBullet = {
  anchorId: string;
  bulletLabel: string;
  sentenceHtml: string;
};

type OverviewHarnessScrollLinksPayload = {
  bullets: OverviewHarnessScrollLinkBullet[];
};

function countListItems(html: string): number {
  const lower = html.toLowerCase();
  let count = 0;
  let searchFrom = 0;
  while (true) {
    const idx = lower.indexOf("<li", searchFrom);
    if (idx < 0) break;
    const openEnd = lower.indexOf(">", idx);
    if (openEnd < 0) break;
    const closeAt = lower.indexOf("</li>", openEnd + 1);
    if (closeAt < 0) break;
    count += 1;
    searchFrom = closeAt + 5;
  }
  return count;
}

function liInnerStartsWithBold(inner: string): boolean {
  const t = inner.trimStart().toLowerCase();
  return t.startsWith("<strong") || t.startsWith("<b>") || t.startsWith("<b ");
}

function collectHashHrefs(html: string): string[] {
  const lower = html.toLowerCase();
  const hrefs: string[] = [];
  let searchFrom = 0;
  while (true) {
    const hrefIdx = lower.indexOf("href=", searchFrom);
    if (hrefIdx < 0) break;
    const afterEq = hrefIdx + 5;
    const quote = lower[afterEq];
    if (quote !== '"' && quote !== "'") {
      searchFrom = afterEq;
      continue;
    }
    const valueStart = afterEq + 1;
    const valueEnd = lower.indexOf(quote, valueStart);
    if (valueEnd < 0) break;
    const href = html.slice(valueStart, valueEnd).trim();
    if (href.startsWith("#")) {
      hrefs.push(href.slice(1));
    }
    searchFrom = valueEnd + 1;
  }
  return hrefs;
}

function collectNonHashHrefs(html: string, allowWikipediaUrl?: string): string[] {
  const lower = html.toLowerCase();
  const allowed = allowWikipediaUrl?.trim().toLowerCase() ?? "";
  const bad: string[] = [];
  let searchFrom = 0;
  while (true) {
    const hrefIdx = lower.indexOf("href=", searchFrom);
    if (hrefIdx < 0) break;
    const afterEq = hrefIdx + 5;
    const quote = lower[afterEq];
    if (quote !== '"' && quote !== "'") {
      searchFrom = afterEq;
      continue;
    }
    const valueStart = afterEq + 1;
    const valueEnd = lower.indexOf(quote, valueStart);
    if (valueEnd < 0) break;
    const href = html.slice(valueStart, valueEnd).trim();
    if (!href.startsWith("#")) {
      if (!allowed || href.toLowerCase() !== allowed) {
        bad.push(href);
      }
    }
    searchFrom = valueEnd + 1;
  }
  return bad;
}

/** Remove the first <ul>…</ul> block; keep h2 and lead paragraphs. */
export function stripOverviewBulletList(html: string): string {
  const lower = html.toLowerCase();
  const ulOpen = lower.indexOf("<ul");
  if (ulOpen < 0) return html.trim();
  const ulClose = lower.indexOf("</ul>", ulOpen);
  if (ulClose < 0) return html.trim();
  const before = html.slice(0, ulOpen).trimEnd();
  const after = html.slice(ulClose + 5).trim();
  return after ? `${before}\n${after}`.trim() : before;
}

export function rebuildOverviewWithScrollLinkBullets(
  headHtml: string,
  bullets: OverviewHarnessScrollLinkBullet[],
): string {
  const lis = bullets
    .map((b) => `<li><strong>${b.bulletLabel.trim()}</strong>: ${b.sentenceHtml.trim()}</li>`)
    .join("\n");
  return `${headHtml.trim()}\n<ul>\n${lis}\n</ul>`;
}

export function verifyOverviewHarnessScrollLinks(
  html: string,
  anchorMap: HarnessSectionAnchorEntry[],
  opts?: { allowWikipediaUrl?: string },
): void {
  if (anchorMap.length === 0) {
    throw new Error("Overview scroll links: anchor map is empty");
  }

  const liCount = countListItems(html);
  if (liCount !== anchorMap.length) {
    throw new Error(
      `Overview scroll links: expected ${anchorMap.length} bullets, found ${liCount}`,
    );
  }

  const hashHrefs = collectHashHrefs(html);
  const expectedIds = anchorMap.map((e) => e.anchorId);
  for (const id of expectedIds) {
    const matches = hashHrefs.filter((h) => h === id).length;
    if (matches !== 1) {
      throw new Error(
        `Overview scroll links: anchor #${id} must appear exactly once (found ${matches})`,
      );
    }
  }

  const badHrefs = collectNonHashHrefs(html, opts?.allowWikipediaUrl);
  if (badHrefs.length > 0) {
    throw new Error(
      `Overview scroll links: forbidden non-# href(s): ${badHrefs.slice(0, 3).join(", ")}`,
    );
  }

  const lower = html.toLowerCase();
  let searchFrom = 0;
  while (true) {
    const idx = lower.indexOf("<li", searchFrom);
    if (idx < 0) break;
    const openEnd = lower.indexOf(">", idx);
    if (openEnd < 0) break;
    const closeAt = lower.indexOf("</li>", openEnd + 1);
    if (closeAt < 0) break;
    const inner = html.slice(openEnd + 1, closeAt);
    if (!liInnerStartsWithBold(inner)) {
      throw new Error("Overview scroll links: every bullet must start with <strong>Label</strong>:");
    }
    searchFrom = closeAt + 5;
  }
}

const SCROLL_LINKS_SYSTEM = `You write Overview key-point bullets for a WordPress HTML block. Return JSON only.

NON-NEGOTIABLE:
- One bullet per assigned anchor, in the same order as IN-PAGE SECTION ANCHORS.
- Each bullet: bulletLabel (short scannable label), sentenceHtml (HTML fragment after the bold label colon).
- sentenceHtml MUST include exactly one <a href="#anchorId">2–4 word phrase</a> woven naturally into the sentence.
- anchorId MUST match the assigned id exactly. Never invent ids.
- Anchor link text MUST be 2–4 subtle words — NEVER the full H2 / section title.
- No http/https URLs in sentenceHtml. # anchors only.

Return JSON: {"bullets":[{"anchorId":"...","bulletLabel":"...","sentenceHtml":"..."}]}`;

export async function applyOverviewHarnessScrollLinks(args: {
  html: string;
  anchorMap: HarnessSectionAnchorEntry[];
  articleTitle: string;
  keyword: string;
  apiKey: string;
  model?: string;
  signal?: AbortSignal;
  inPageAnchorBlock?: string;
  allowWikipediaUrl?: string;
}): Promise<string> {
  const { html, anchorMap, articleTitle, keyword, apiKey } = args;
  if (anchorMap.length === 0) {
    throw new Error("Overview scroll links: cannot rebuild bullets without body H2 anchors");
  }

  const headHtml = stripOverviewBulletList(html);
  const anchorLines = anchorMap
    .map((e, i) => `Bullet ${i + 1}: #${e.anchorId} → "${e.displayTitle}"`)
    .join("\n");

  const user = `Article title: ${articleTitle}
Primary keyword: ${keyword}

${args.inPageAnchorBlock?.trim() ? `${args.inPageAnchorBlock.trim()}\n\n` : ""}Assigned anchors (one bullet each, in order):
${anchorLines}

Lead copy to preserve (keep meaning; bullets are rebuilt separately):
${headHtml}

Return JSON with exactly ${anchorMap.length} bullets — one per anchor above, in order.`;

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model: args.model?.trim() || getProductionModel(),
    system: SCROLL_LINKS_SYSTEM,
    user,
    maxTokens: 2048,
    temperature: 0.25,
    responseFormat: { type: "json_object" },
    signal: args.signal,
  });

  const { parsed } = parseJsonWithRepair<OverviewHarnessScrollLinksPayload>(content, {
    targetKeys: ["bullets"],
  });

  const bullets = Array.isArray(parsed.bullets) ? parsed.bullets : [];
  if (bullets.length !== anchorMap.length) {
    throw new Error(
      `Overview scroll links: model returned ${bullets.length} bullets, expected ${anchorMap.length}`,
    );
  }

  for (let i = 0; i < anchorMap.length; i += 1) {
    const expected = anchorMap[i]!;
    const got = bullets[i];
    if (!got || got.anchorId !== expected.anchorId) {
      throw new Error(
        `Overview scroll links: bullet ${i + 1} anchorId mismatch (expected #${expected.anchorId})`,
      );
    }
    if (!got.bulletLabel?.trim() || !got.sentenceHtml?.trim()) {
      throw new Error(`Overview scroll links: bullet ${i + 1} missing label or sentenceHtml`);
    }
    if (!got.sentenceHtml.includes(`href="#${expected.anchorId}"`)) {
      throw new Error(
        `Overview scroll links: bullet ${i + 1} must include <a href="#${expected.anchorId}">`,
      );
    }
  }

  const rebuilt = rebuildOverviewWithScrollLinkBullets(headHtml, bullets);
  verifyOverviewHarnessScrollLinks(rebuilt, anchorMap, {
    allowWikipediaUrl: args.allowWikipediaUrl,
  });
  return rebuilt;
}
