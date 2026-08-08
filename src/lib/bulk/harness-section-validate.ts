import {
  plainTextEndsWithCompleteSentence,
  stripHtmlTagsForSentenceCheck,
} from "@/lib/bulk/harness-section-complete-sentences";
import { headingTitleToHarnessAnchorId } from "@/lib/bulk/harness-section-anchor-ids";
import { markdownToHtml } from "@/lib/markdown-to-html";

function isHarnessPlaceholderToken(token: string): boolean {
  return (
    token.startsWith("[[EXTERNAL:") ||
    token === "[[EXTERNAL]]" ||
    token.startsWith("[[LINK:") ||
    token.startsWith("[[SCROLL:")
  );
}

function maskHarnessMarkdownPlaceholders(content: string): { text: string; tokens: string[] } {
  const tokens: string[] = [];
  let out = "";
  let i = 0;
  while (i < content.length) {
    if (content[i] === "[" && content[i + 1] === "[") {
      const end = content.indexOf("]]", i + 2);
      if (end !== -1) {
        const token = content.slice(i, end + 2);
        if (isHarnessPlaceholderToken(token)) {
          tokens.push(token);
          out += `HARNESSPH${tokens.length - 1}END`;
          i = end + 2;
          continue;
        }
      }
    }
    out += content[i]!;
    i += 1;
  }
  return { text: out, tokens };
}

function unmaskHarnessMarkdownPlaceholders(content: string, tokens: string[]): string {
  let out = content;
  for (let i = 0; i < tokens.length; i++) {
    out = out.split(`HARNESSPH${i}END`).join(tokens[i]!);
  }
  return out;
}

/** Remove known model contamination (Semrush MCP errors, tool leaks) from harness HTML. */
export function stripHarnessModelContamination(html: string): string {
  let s = html;
  const patterns = [
    /If you can see this response, the user has an active Semrush subscription[\s\S]*?semrush\.com\/mcp-access\.?/gi,
    /Action required:\s*The user can view available options to get more API units[\s\S]*?semrush\.com\/mcp-access\.?/gi,
    /does not have enough API units to complete this request\.?/gi,
  ];
  for (const re of patterns) {
    s = s.replace(re, "");
  }
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** Drop trailing partial tags (e.g. lone "<" after an empty section). */
export function stripHarnessSectionTrailingGarbage(html: string): string {
  let s = html.trim();
  for (let pass = 0; pass < 8; pass++) {
    const before = s;
    s = s.replace(/<\s*$/g, "").trimEnd();
    const dangling = s.match(/<[^>]*$/);
    if (dangling) {
      s = s.slice(0, s.lastIndexOf("<")).trimEnd();
    }
    if (s === before) break;
  }
  return s;
}

export function harnessSectionParagraphPlainTexts(html: string): string[] {
  const texts: string[] = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const plain = stripHtmlTagsForSentenceCheck(m[1]).trim();
    if (plain) texts.push(plain);
  }
  return texts;
}

export function harnessBodySectionHasCompleteParagraph(html: string): boolean {
  return harnessSectionParagraphPlainTexts(html).some((t) =>
    plainTextEndsWithCompleteSentence(t),
  );
}

export function harnessOverviewProseHasCompleteParagraph(html: string): boolean {
  const lower = html.toLowerCase();
  const h2End = lower.indexOf("</h2>");
  if (h2End < 0) return false;
  const ulStart = lower.indexOf("<ul", h2End);
  const proseSlice = ulStart >= 0 ? html.slice(h2End + 5, ulStart) : html.slice(h2End + 5);
  const paras = harnessSectionParagraphPlainTexts(proseSlice);
  if (paras.some((t) => plainTextEndsWithCompleteSentence(t))) return true;
  const loose = stripHtmlTagsForSentenceCheck(proseSlice).trim();
  return plainTextEndsWithCompleteSentence(loose);
}

export function isHarnessCompletionTruncated(finishReason?: string): boolean {
  if (typeof finishReason !== "string" || !finishReason.trim()) return false;
  const lo = finishReason.trim().toLowerCase().replace(/-/g, "_");
  if (lo === "length" || lo === "max_tokens" || lo === "max_output_tokens") return true;
  if (lo.includes("max_tokens") || lo.includes("length_limit")) return true;
  return false;
}

function isTagBoundaryChar(ch: string | undefined): boolean {
  if (!ch || ch.length === 0) return true;
  const c = ch.charCodeAt(0);
  if (c <= 32) return true;
  return ch === "/" || ch === ">";
}

export function countHarnessH2Tags(html: string): number {
  const lower = html.toLowerCase();
  let count = 0;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) break;
    if (lower.startsWith("<h2", lt) && isTagBoundaryChar(html[lt + 3])) {
      count += 1;
      i = lt + 1;
      continue;
    }
    i = lt + 1;
  }
  return count;
}

export function assertHarnessBodySectionComplete(html: string, title: string): void {
  const t = html.trim();
  if (!/<h2\b/i.test(t)) {
    throw new Error(`Harness: section "${title}" missing <h2>`);
  }
  if (!harnessBodySectionHasCompleteParagraph(t)) {
    throw new Error(
      `Harness: section "${title}" has no complete paragraphs — generation must not ship empty or cut-off body sections`,
    );
  }
}

export function assertHarnessOverviewProseComplete(html: string): void {
  if (!/<h2\b/i.test(html)) {
    throw new Error("Harness: Overview missing <h2>");
  }
  if (!harnessOverviewProseHasCompleteParagraph(html)) {
    throw new Error(
      "Harness: Overview has no complete prose paragraphs — generation must not ship truncated Overview",
    );
  }
}

export function validateHarnessSectionOrThrow(
  html: string,
  opts: {
    title: string;
    finishReason?: string;
    isOverview: boolean;
  },
): void {
  if (isHarnessCompletionTruncated(opts.finishReason)) {
    throw new Error(
      `Section "${opts.title}" truncated at ${opts.finishReason} — increase max tokens`,
    );
  }

  const h2Count = countHarnessH2Tags(html);
  if (h2Count === 0) {
    throw new Error(`Section "${opts.title}" missing <h2>`);
  }
  if (h2Count > 1) {
    throw new Error(`Section "${opts.title}" contains ${h2Count} <h2> tags — section bleed`);
  }

  if (opts.isOverview) {
    assertHarnessOverviewProseComplete(html);
  } else {
    assertHarnessBodySectionComplete(html, opts.title);
  }
}

/** Wrap loose Overview text after </h2> in <p> when the model omitted paragraph tags. */
export function normalizeOverviewProseHtml(html: string): string {
  const cleaned = stripHarnessModelContamination(html);
  const lower = cleaned.toLowerCase();
  const h2Open = lower.search(/<h2\b/);
  if (h2Open < 0) return cleaned;
  const h2End = lower.indexOf("</h2>", h2Open);
  if (h2End < 0) return cleaned;

  const head = cleaned.slice(0, h2End + 5);
  const tail = cleaned.slice(h2End + 5);
  const ulIdx = tail.toLowerCase().indexOf("<ul");
  const prosePart = (ulIdx >= 0 ? tail.slice(0, ulIdx) : tail).trim();
  const afterUl = ulIdx >= 0 ? tail.slice(ulIdx) : "";

  if (!prosePart || /<p\b/i.test(prosePart)) {
    return head + (prosePart ? `\n${prosePart}` : "") + (afterUl ? `\n${afterUl}` : "");
  }

  const blocks = prosePart
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const wrapped = blocks.map((b) => `<p>${b}</p>`).join("\n");
  return `${head}\n${wrapped}${afterUl ? `\n${afterUl}` : ""}`;
}

export function finalizeHarnessSectionHtml(
  html: string,
  opts: { isOverview: boolean; title: string },
): string {
  let s = stripHarnessModelContamination(html);
  s = stripHarnessSectionTrailingGarbage(s);
  if (opts.isOverview) {
    s = normalizeOverviewProseHtml(s);
  } else if (!/\bid\s*=\s*["'][^"']+["']/i.test(s) && /<h2\b/i.test(s)) {
    const anchorId = headingTitleToHarnessAnchorId(opts.title);
    s = s.replace(/<h2\b/i, `<h2 id="${anchorId}"`);
  }
  return s;
}

/** Normalize markdown harness sections to HTML before validation and stitch. */
export function prepareHarnessSectionHtml(
  raw: string,
  opts: { isOverview: boolean; title: string },
): string {
  let text = raw.trim();
  const fence = text.match(/^```(?:html|markdown)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fence) text = fence[1]!.trim();
  if (!text) return "";

  let html = text;
  const lower = text.toLowerCase();
  if (!lower.includes("<h2") && text.includes("## ")) {
    const { text: masked, tokens } = maskHarnessMarkdownPlaceholders(text);
    html = unmaskHarnessMarkdownPlaceholders(markdownToHtml(masked), tokens);
  }

  return finalizeHarnessSectionHtml(html, opts);
}
