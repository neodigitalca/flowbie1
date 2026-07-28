/**
 * Insert a WordPress image figure immediately after a matching H2.
 */

export {
  stripPreferredBodyImageFromHtml,
} from "@/lib/overview/sap-cross-site-image-search";

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
  const gt = html.indexOf(">", openAt);
  if (gt < 0) return "";
  const close = html.toLowerCase().indexOf("</h2>", gt + 1);
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

function normalizeHeadingKey(title: string): string {
  return (title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildInContentImageFigureHtml(params: {
  imageUrl: string;
  alt: string;
  mediaId?: number;
}): string {
  const alt = escapeHtmlAttr(params.alt.trim());
  const src = escapeHtmlAttr(params.imageUrl.trim());
  const classAttr =
    params.mediaId != null && Number.isFinite(params.mediaId)
      ? ` class="wp-image-${params.mediaId}"`
      : "";
  return `<figure class="wp-block-image size-full"><img src="${src}" alt="${alt}"${classAttr}/></figure>`;
}

/**
 * Insert figure HTML immediately after the closing </h2> of the first H2 whose
 * plain text matches sectionHeader (case-insensitive, collapsed whitespace).
 */
export function insertFigureAfterH2(
  html: string,
  sectionHeader: string,
  figureHtml: string,
): string {
  const target = normalizeHeadingKey(sectionHeader);
  if (!target) {
    throw new Error("Section header is empty");
  }
  const trimmedFigure = figureHtml.trim();
  if (!trimmedFigure) {
    throw new Error("Figure HTML is empty");
  }

  const positions = findH2OpenPositions(html);
  for (const openAt of positions) {
    const label = plainInnerFromH2Open(html, openAt);
    if (normalizeHeadingKey(label) !== target) continue;
    const gt = html.indexOf(">", openAt);
    if (gt < 0) continue;
    const close = html.toLowerCase().indexOf("</h2>", gt + 1);
    if (close < 0) {
      throw new Error(`H2 "${sectionHeader}" has no closing tag`);
    }
    const insertAt = close + "</h2>".length;
    return `${html.slice(0, insertAt)}\n${trimmedFigure}\n${html.slice(insertAt)}`;
  }

  throw new Error(`H2 "${sectionHeader}" not found in content`);
}

/** Focus-keyword filename: simple sanitize + .png (no LLM). */
export function inContentImageFilenameFromFocusKeyword(
  focusKeyword: string,
  fallback = "in-content-image",
): string {
  const raw = (focusKeyword ?? "").trim() || fallback;
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
  return `${slug || fallback}.png`;
}

/** Alt centered on focus keyword. */
export function inContentImageAltFromFocusKeyword(
  focusKeyword: string,
  sectionHeader?: string,
): string {
  const kw = (focusKeyword ?? "").trim();
  if (kw) return kw;
  const section = (sectionHeader ?? "").trim();
  if (section) return section;
  return "In content image";
}

export function inContentImageTitleFromFocusKeyword(
  focusKeyword: string,
  sectionHeader?: string,
): string {
  const kw = (focusKeyword ?? "").trim();
  const section = (sectionHeader ?? "").trim();
  if (kw && section && normalizeHeadingKey(kw) !== normalizeHeadingKey(section)) {
    return `${kw} - ${section}`;
  }
  if (kw) return kw;
  if (section) return section;
  return "In content image";
}
