import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseJsonWithRepair } from "@/lib/json-repair-utility";
import { getProductionModel } from "@/lib/optimization-settings-storage";

/** When true, one OpenRouter pass may rewrite an HTML harness section to meet length contract. */
export const HARNESS_AI_LENGTH_RETRY = true;

export type HarnessSectionLengthResult = {
  compliant: boolean;
  section_html: string;
};

const SYSTEM = `You are a harness section editor for WordPress HTML. Return JSON only.

Contract for the section HTML:
- Exactly one top-level <h2> for this section (plus optional <h3> subheads under it).
- At most 3 <p> tags for body prose (lists/tables allowed but concise).
- At most 4 sentences per <p>.
- No full-article intro, no "this guide will explore", no repeating topics from sibling H2s listed in the user message.
- Never add <footer>. Never use markdown.

If the draft already complies, set compliant true and return the same HTML in section_html (light copy-edit only).
If it violates the contract, set compliant false and return a rewritten section_html that complies while preserving facts and links.`;

const OVERVIEW_SYSTEM = `You are a harness section editor for the Overview (AI Overview) block. Return JSON only.

NON-NEGOTIABLE contract for Overview HTML:
1. Exactly one <h2>Overview</h2> (id attribute optional; keep if present).
2. Exactly 1 or 2 short <p> paragraphs first. First sentence must keep the primary keyword answer.
3. Then a MANDATORY <ul> with exactly N <li> items where N = the number of IN-PAGE SECTION ANCHORS in the user message. NEVER omit the list. NEVER replace the list with more paragraphs.
4. Every <li> MUST start with <strong>Label</strong>: then a colon, then the rest of the line. Example: <li><strong>Code compliance</strong>: licensed crews pull permits and meet local codes.</li>. NEVER use a comma after the bold label.
5. LINKS: every <a href="..."> MUST be a same-page click-to-scroll citation. href MUST start with # (e.g. href="#factors-influencing-your-solar-panel-installation-price"). ZERO http/https site URLs, ZERO page paths, ZERO Wikipedia/Semrush links in Overview unless the user message allows one entity Wikipedia URL.
6. Anchor TEXT must be subtle: 2–4 words woven into the sentence (e.g. "cost factors", "system pricing", "tax rebates"). NEVER use the full H2 / section title as link text. NEVER "as detailed in <a>Full Title Here</a>". If the draft pastes a long section title into an <a>, set compliant false and rewrite to a short phrase while keeping the same #href.
7. Each bullet MUST contain exactly one # citation to its assigned anchor from IN-PAGE SECTION ANCHORS. Every anchor id must appear exactly once across the bullets.
8. No <h3>, no tables, no <footer>, no markdown.

If the draft is missing the <ul> or has fewer than N <li>, set compliant false and rewrite to add a valid N-item key-points list (derive bullets from the paragraphs and article topic). Preserve facts; convert site URLs to #anchors with short link text.
If the draft already has a valid <ul> of N bold-label bullets AND only # hrefs with short (2–4 word) anchor text covering every anchor, set compliant true and return it (light copy-edit only).`;

function overviewHasKeyPointsList(html: string, expectedCount: number): boolean {
  if (expectedCount < 1) return false;
  const lower = html.toLowerCase();
  if (!lower.includes("<ul")) return false;
  let liCount = 0;
  let boldLi = 0;
  let searchFrom = 0;
  while (true) {
    const idx = lower.indexOf("<li", searchFrom);
    if (idx < 0) break;
    const openEnd = lower.indexOf(">", idx);
    if (openEnd < 0) break;
    const closeAt = lower.indexOf("</li>", openEnd + 1);
    if (closeAt < 0) break;
    liCount += 1;
    const inner = html.slice(openEnd + 1, closeAt).trimStart().toLowerCase();
    if (inner.startsWith("<strong") || inner.startsWith("<b>") || inner.startsWith("<b ")) {
      boldLi += 1;
    }
    searchFrom = closeAt + 5;
  }
  return liCount === expectedCount && boldLi === liCount;
}

/** True when any <a href> is not a same-page #anchor (site URLs, paths, etc.). */
function overviewHasNonInPageLinks(html: string): boolean {
  const lower = html.toLowerCase();
  let searchFrom = 0;
  while (true) {
    const hrefIdx = lower.indexOf("href=", searchFrom);
    if (hrefIdx < 0) return false;
    const afterEq = hrefIdx + 5;
    const quote = lower[afterEq];
    if (quote !== '"' && quote !== "'") {
      searchFrom = afterEq;
      continue;
    }
    const valueStart = afterEq + 1;
    const valueEnd = lower.indexOf(quote, valueStart);
    if (valueEnd < 0) return true;
    const href = lower.slice(valueStart, valueEnd).trim();
    if (!href.startsWith("#")) return true;
    searchFrom = valueEnd + 1;
  }
}

export async function ensureHarnessSectionLengthCompliance(args: {
  sectionHtml: string;
  sectionTitle: string;
  siblingSectionTitles: string[];
  articleTitle: string;
  apiKey: string;
  model?: string;
  signal?: AbortSignal;
  /** Overview AI block: require bold-label key-points <ul>. */
  isOverviewSection?: boolean;
  /** Overview: IN-PAGE SECTION ANCHORS block for 1:1 bullet contract. */
  inPageAnchorBlock?: string;
  /** Overview: required bullet count (= body H2 anchor count). */
  overviewBulletCount?: number;
}): Promise<string> {
  if (!HARNESS_AI_LENGTH_RETRY || !args.sectionHtml.trim()) {
    return args.sectionHtml;
  }

  const isOverview = Boolean(args.isOverviewSection);
  const overviewN = isOverview
    ? (args.overviewBulletCount ?? args.siblingSectionTitles.length)
    : 0;

  const siblings =
    args.siblingSectionTitles.length > 0
      ? args.siblingSectionTitles.map((t) => `- ${t}`).join("\n")
      : "(none)";

  const overviewForceNote = isOverview
    ? `\nOverview rules: (1) MUST include a <ul> with exactly ${overviewN} <li> items (one per IN-PAGE anchor) each starting with <strong>Label</strong>: (colon after bold label, never a comma). Paragraphs alone are NEVER compliant. (2) EVERY <a href> MUST start with # (click-to-scroll only). Any http/https or site page link is NON-COMPLIANT — rewrite to #anchor ids from IN-PAGE SECTION ANCHORS or unwrap to plain text. (3) Anchor TEXT must be 2–4 subtle words woven in — NEVER the full H2 title as the link label. (4) Each bullet has exactly one # link; every anchor id appears once.\n`
    : "";

  const anchorBlockNote =
    isOverview && args.inPageAnchorBlock?.trim() ? `\n${args.inPageAnchorBlock.trim()}\n` : "";

  const user = `Article title: ${args.articleTitle}
Current section topic: ${args.sectionTitle}
Sibling H2s (do not duplicate their coverage):
${siblings}
${anchorBlockNote}${overviewForceNote}
Draft HTML:
${args.sectionHtml.trim()}

Return JSON: {"compliant":boolean,"section_html":"..."}`;

  try {
    const { content } = await callOpenRouterChatCompletion({
      apiKey: args.apiKey,
      model: args.model?.trim() || getProductionModel(),
      system: isOverview ? OVERVIEW_SYSTEM : SYSTEM,
      user,
      maxTokens: 2048,
      temperature: 0.25,
      responseFormat: { type: "json_object" },
      signal: args.signal,
    });

    const { parsed } = parseJsonWithRepair<HarnessSectionLengthResult>(content, {
      targetKeys: ["compliant", "section_html"],
    });

    let html =
      typeof parsed.section_html === "string" && parsed.section_html.trim()
        ? parsed.section_html.trim()
        : args.sectionHtml;

    if (isOverview && overviewN > 0 && !overviewHasKeyPointsList(html, overviewN)) {
      const retryUser = `Article title: ${args.articleTitle}
Current section topic: Overview
The previous rewrite FAILED: key-points list missing, wrong bullet count, OR bullets lack bold labels.

Every <li> MUST start with <strong>Label</strong>: then a colon (never a comma). Example:
<li><strong>Cost Breakdown</strong>: discover average motorized blinds costs and what influences them.</li>

${anchorBlockNote}
Draft HTML (fix by ADDING a mandatory key-points list with bold labels; keep the h2 and 1-2 lead paragraphs; links MUST be #anchors only; exactly ${overviewN} bullets):
${html}

Return JSON: {"compliant":false,"section_html":"..."} with <h2>, 1-2 <p>, then <ul> of ${overviewN} <li><strong>Label</strong>: description</li>.`;
      const { content: retryContent } = await callOpenRouterChatCompletion({
        apiKey: args.apiKey,
        model: args.model?.trim() || getProductionModel(),
        system: OVERVIEW_SYSTEM,
        user: retryUser,
        maxTokens: 2048,
        temperature: 0.2,
        responseFormat: { type: "json_object" },
        signal: args.signal,
      });
      const { parsed: retryParsed } = parseJsonWithRepair<HarnessSectionLengthResult>(retryContent, {
        targetKeys: ["compliant", "section_html"],
      });
      if (typeof retryParsed.section_html === "string" && retryParsed.section_html.trim()) {
        html = retryParsed.section_html.trim();
      }
      console.info(`[Bulk Harness] Overview key-points list retry applied`);
    }

    if (isOverview && overviewHasNonInPageLinks(html)) {
      const retryUser = `Article title: ${args.articleTitle}
Current section topic: Overview
Sibling H2s (use these to build #anchor ids):
${siblings}

${anchorBlockNote}
The previous rewrite FAILED because Overview still has non-# links (site URLs or page paths) and/or full-title link text.

Draft HTML (fix: (1) convert EVERY <a href> to a same-page #anchor from IN-PAGE SECTION ANCHORS, or unwrap to plain text if no match; (2) shorten every link label to 2–4 subtle words woven into the sentence — NEVER paste the full H2 title as the <a> text; keep structure; exactly ${overviewN} bullets):
${html}

Return JSON: {"compliant":false,"section_html":"..."} with ZERO http/https hrefs — only href="#..." click-to-scroll citations with short 2–4 word anchor text.`;
      const { content: retryContent } = await callOpenRouterChatCompletion({
        apiKey: args.apiKey,
        model: args.model?.trim() || getProductionModel(),
        system: OVERVIEW_SYSTEM,
        user: retryUser,
        maxTokens: 2048,
        temperature: 0.2,
        responseFormat: { type: "json_object" },
        signal: args.signal,
      });
      const { parsed: retryParsed } = parseJsonWithRepair<HarnessSectionLengthResult>(retryContent, {
        targetKeys: ["compliant", "section_html"],
      });
      if (typeof retryParsed.section_html === "string" && retryParsed.section_html.trim()) {
        html = retryParsed.section_html.trim();
      }
      console.info(`[Bulk Harness] Overview in-page-only links retry applied`);
    }

    if (parsed.compliant === false) {
      console.info(
        `[Bulk Harness] Section length agent rewrote "${args.sectionTitle}" for compliance`,
      );
    }

    return html;
  } catch (err) {
    if (isOverview) {
      throw err;
    }
    console.warn("[Bulk Harness] Section length agent failed (using draft):", err);
    return args.sectionHtml;
  }
}
