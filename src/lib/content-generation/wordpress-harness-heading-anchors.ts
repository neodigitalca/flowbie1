/**
 * WordPress block editor drops raw `id` on <h2> unless the heading is a
 * wp:heading block with an `anchor` attribute. Harness scroll links need those ids on KWB.
 */

function parseH2IdFromOpenTag(openTag: string): string | undefined {
  const match = openTag.match(/\sid\s*=\s*(["'])([^"']+)\1/i);
  return match?.[2]?.trim() || undefined;
}

function isAlreadyWpHeadingBlock(before: string): boolean {
  const tail = before.slice(-120).toLowerCase();
  return tail.includes("<!-- wp:heading");
}

/**
 * Wrap each `<h2 id="…">` in Gutenberg heading block comments so WordPress
 * preserves the anchor on publish (classic raw id attrs are stripped).
 */
export function wrapHarnessH2AnchorsForWordPressBlocks(html: string): string {
  if (!html?.trim()) return html;

  const lower = html.toLowerCase();
  let result = "";
  let cursor = 0;

  while (cursor < html.length) {
    const open = lower.indexOf("<h2", cursor);
    if (open < 0) {
      result += html.slice(cursor);
      break;
    }

    result += html.slice(cursor, open);
    const gt = html.indexOf(">", open);
    if (gt < 0) {
      result += html.slice(open);
      break;
    }

    const close = lower.indexOf("</h2>", gt + 1);
    if (close < 0) {
      result += html.slice(open);
      break;
    }

    const openTag = html.slice(open, gt + 1);
    const inner = html.slice(gt + 1, close);
    const closeTag = html.slice(close, close + 5);
    const anchorId = parseH2IdFromOpenTag(openTag);

    if (!anchorId || isAlreadyWpHeadingBlock(result)) {
      result += openTag + inner + closeTag;
    } else {
      const blockJson = JSON.stringify({ level: 2, anchor: anchorId });
      const innerPlain = inner.trim();
      result +=
        `<!-- wp:heading ${blockJson} -->\n` +
        `<h2 class="wp-block-heading" id="${anchorId}">${innerPlain}</h2>\n` +
        `<!-- /wp:heading -->`;
    }

    cursor = close + 5;
  }

  return result;
}
