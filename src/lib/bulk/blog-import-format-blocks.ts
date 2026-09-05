const VOID_TAGS = new Set(["img", "br", "hr", "input", "meta", "link"]);
const RETAG_SOURCE = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "div"]);
export const FORMAT_BLOCK_TAGS = new Set(["p", "h2", "h3"]);

export type FormatBlock = {
  id: number;
  tag: string;
  innerHtml: string;
};

export type FormatBlockCatalogItem = {
  id: number;
  tag: string;
  textPreview: string;
  hasStrong: boolean;
};

export function htmlTextFingerprint(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function previewText(innerHtml: string): string {
  return innerHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function catalogFromBlocks(blocks: FormatBlock[]): FormatBlockCatalogItem[] {
  return blocks.map((block) => ({
    id: block.id,
    tag: block.tag,
    textPreview: previewText(block.innerHtml),
    hasStrong: /<strong\b/i.test(block.innerHtml),
  }));
}

export function serializeFormatBlocks(blocks: FormatBlock[]): string {
  return blocks
    .map((block) => {
      if (VOID_TAGS.has(block.tag)) return block.innerHtml;
      return `<${block.tag}>${block.innerHtml}</${block.tag}>`;
    })
    .join("\n");
}

function readOpenTag(
  html: string,
  start: number,
): { tag: string; end: number; selfClosing: boolean } | null {
  if (html[start] !== "<") return null;
  const slice = html.slice(start);
  const match = slice.match(/^<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/)?>/);
  if (!match) return null;
  const tag = match[1]!.toLowerCase();
  return {
    tag,
    end: start + match[0].length,
    selfClosing: Boolean(match[2]) || VOID_TAGS.has(tag),
  };
}

function findMatchingClose(html: string, innerStart: number, tag: string): number {
  const lower = html.toLowerCase();
  const openNeedle = `<${tag}`;
  const closeNeedle = `</${tag}`;
  let depth = 1;
  let i = innerStart;
  while (i < html.length && depth > 0) {
    const openAt = lower.indexOf(openNeedle, i);
    const closeAt = lower.indexOf(closeNeedle, i);
    if (closeAt < 0) return html.length;
    const openIsTag =
      openAt >= 0 &&
      openAt < closeAt &&
      (lower[openAt + openNeedle.length] === ">" ||
        lower[openAt + openNeedle.length] === " " ||
        lower[openAt + openNeedle.length] === "\n" ||
        lower[openAt + openNeedle.length] === "\t" ||
        lower[openAt + openNeedle.length] === "/");
    if (openIsTag) {
      depth += 1;
      i = openAt + openNeedle.length;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      const closeEnd = lower.indexOf(">", closeAt);
      return closeEnd < 0 ? html.length : closeEnd + 1;
    }
    i = closeAt + closeNeedle.length;
  }
  return html.length;
}

export function parseFormatBlocks(html: string): FormatBlock[] {
  const source = html.trim();
  const blocks: FormatBlock[] = [];
  let i = 0;
  let id = 0;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i] ?? "")) i += 1;
    if (i >= source.length) break;
    if (source.startsWith("<!--", i)) {
      const end = source.indexOf("-->", i);
      i = end < 0 ? source.length : end + 3;
      continue;
    }
    const open = readOpenTag(source, i);
    if (!open) {
      const nextTag = source.indexOf("<", i + 1);
      const text = source.slice(i, nextTag < 0 ? source.length : nextTag).trim();
      if (text) {
        blocks.push({ id: id++, tag: "p", innerHtml: text });
      }
      i = nextTag < 0 ? source.length : nextTag;
      continue;
    }
    if (open.selfClosing) {
      blocks.push({ id: id++, tag: open.tag, innerHtml: source.slice(i, open.end) });
      i = open.end;
      continue;
    }
    const closeEnd = findMatchingClose(source, open.end, open.tag);
    const closeAt = source.lastIndexOf("</", closeEnd - 1);
    blocks.push({
      id: id++,
      tag: open.tag,
      innerHtml: closeAt >= open.end ? source.slice(open.end, closeAt) : source.slice(open.end, closeEnd),
    });
    i = closeEnd;
  }
  return blocks;
}

export function canRetagBlock(block: FormatBlock): boolean {
  return RETAG_SOURCE.has(block.tag);
}

export function setBlockTag(blocks: FormatBlock[], ids: number[], tag: string): string {
  if (!FORMAT_BLOCK_TAGS.has(tag)) {
    return `tag must be p, h2, or h3 (got ${tag})`;
  }
  for (const id of ids) {
    const block = blocks.find((b) => b.id === id);
    if (!block) return `unknown block id ${id}`;
    if (!canRetagBlock(block)) return `cannot retag <${block.tag}> block ${id}`;
    block.tag = tag;
  }
  return "";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const MONTH_NAME =
  /january|february|march|april|may|june|july|august|september|october|november|december/i;

function looksLikeDateTitle(text: string): boolean {
  return /\b(19|20)\d{2}\b/.test(text) && MONTH_NAME.test(text);
}

/** Short title already marked as a heading in the source. Not a body sentence. */
export function isExistingHeadingTitle(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (looksLikeDateTitle(t)) return false;
  const words = t.split(" ").filter(Boolean);
  if (words.length < 1 || words.length > 15) return false;
  if (/[.?!]$/.test(t)) return false;
  return true;
}

/** Convert a markdown line that is already a bold heading into ##. Leave body lines alone. */
export function reformatExistingMarkdownHeadings(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const trimmed = line.replace(/[ \t]+$/, "");
      const match = trimmed.match(/^\*\*([^*]+)\*\*$/);
      if (!match) return line;
      const title = match[1]!.trim();
      if (!isExistingHeadingTitle(title)) return line;
      return `## ${title}`;
    })
    .join("\n");
}

function splitExistingHeadingInner(innerHtml: string): { heading: string; body?: string } | null {
  const onlyStrong = innerHtml.match(/^\s*<(strong|b)>([\s\S]*?)<\/\1>\s*$/i);
  if (onlyStrong && isExistingHeadingTitle(stripTags(onlyStrong[2] ?? ""))) {
    return { heading: (onlyStrong[2] ?? "").trim() };
  }
  const strongThenBreak = innerHtml.match(
    /^\s*<(strong|b)>([\s\S]*?)<\/\1>\s*(?:<br\s*\/?>\s*)+([\s\S]+)$/i,
  );
  if (strongThenBreak && isExistingHeadingTitle(stripTags(strongThenBreak[2] ?? ""))) {
    return { heading: (strongThenBreak[2] ?? "").trim(), body: (strongThenBreak[3] ?? "").trim() };
  }
  return null;
}

/** Retag existing headings only. Do not invent headings from body copy. */
export function reformatExistingHtmlHeadings(html: string): string {
  const blocks = parseFormatBlocks(html.trim());
  const out: FormatBlock[] = [];
  let id = 0;
  for (const block of blocks) {
    if (block.tag === "h1") {
      out.push({ id: id++, tag: "h2", innerHtml: block.innerHtml });
      continue;
    }
    if (block.tag === "h2" || block.tag === "h3") {
      const split = splitExistingHeadingInner(block.innerHtml);
      if (split?.body) {
        out.push({ id: id++, tag: block.tag, innerHtml: split.heading });
        out.push({ id: id++, tag: "p", innerHtml: split.body });
      } else {
        out.push({ id: id++, tag: block.tag, innerHtml: block.innerHtml });
      }
      continue;
    }
    if (block.tag === "p") {
      const split = splitExistingHeadingInner(block.innerHtml);
      if (split) {
        out.push({ id: id++, tag: "h2", innerHtml: split.heading });
        if (split.body) out.push({ id: id++, tag: "p", innerHtml: split.body });
        continue;
      }
    }
    out.push({ id: id++, tag: block.tag, innerHtml: block.innerHtml });
  }
  return serializeFormatBlocks(out);
}

export function wrapBlocksAsList(
  blocks: FormatBlock[],
  startId: number,
  endId: number,
  list: "ul" | "ol",
): string {
  if (list !== "ul" && list !== "ol") return "list must be ul or ol";
  const startIndex = blocks.findIndex((b) => b.id === startId);
  const endIndex = blocks.findIndex((b) => b.id === endId);
  if (startIndex < 0 || endIndex < 0) return "unknown startId or endId";
  if (endIndex < startIndex) return "endId must be at or after startId";
  const slice = blocks.slice(startIndex, endIndex + 1);
  if (slice.some((b) => b.tag !== "p")) return "wrap_list only accepts consecutive p blocks";
  const inner = slice.map((b) => `<li>${b.innerHtml}</li>`).join("");
  blocks.splice(startIndex, slice.length, { id: startId, tag: list, innerHtml: inner });
  return "";
}
