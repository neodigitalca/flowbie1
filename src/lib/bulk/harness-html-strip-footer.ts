/**
 * Harness blog sections must never use <footer> (WordPress post_content uses section body only).
 * Unwraps footer inner HTML into the section; removes empty footers. No alternate wrapper.
 */

function findOpenFooterIndex(html: string, fromIndex: number): number {
  const lower = html.toLowerCase();
  const tag = "footer";
  let i = fromIndex;
  while (i < html.length) {
    const pos = lower.indexOf(`<${tag}`, i);
    if (pos < 0) return -1;
    const afterTag = pos + tag.length + 1;
    const next = lower[afterTag];
    if (next === ">" || next === "/" || next === " " || next === "\n" || next === "\t" || next === "\r") {
      return pos;
    }
    i = pos + 1;
  }
  return -1;
}

function findCloseFooterIndex(html: string, fromIndex: number): number {
  return html.toLowerCase().indexOf("</footer>", fromIndex);
}

/** Strip every <footer>…</footer> block from one harness section HTML fragment. */
export function stripFooterElementsFromHarnessSectionHtml(html: string): string {
  let s = html.trim();
  if (!s) return s;

  for (;;) {
    const open = findOpenFooterIndex(s, 0);
    if (open < 0) break;

    const openEnd = s.indexOf(">", open);
    if (openEnd < 0) {
      s = s.slice(0, open).trimEnd();
      break;
    }

    const close = findCloseFooterIndex(s, openEnd + 1);
    if (close < 0) {
      s = (s.slice(0, open) + s.slice(openEnd + 1)).trim();
      continue;
    }

    const closeEnd = s.indexOf(">", close);
    if (closeEnd < 0) break;

    const inner = s.slice(openEnd + 1, close);
    s = (s.slice(0, open) + inner + s.slice(closeEnd + 1)).trim();
  }

  let out = s;
  for (;;) {
    const closeOnly = findCloseFooterIndex(out, 0);
    if (closeOnly < 0) break;
    const closeEnd = out.indexOf(">", closeOnly);
    if (closeEnd < 0) break;
    out = (out.slice(0, closeOnly) + out.slice(closeEnd + 1)).trim();
  }

  return out;
}
