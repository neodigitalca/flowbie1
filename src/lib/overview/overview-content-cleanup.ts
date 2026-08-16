/**
 * Deterministic post-body hygiene: delete content H1 blocks; convert markdown pipe tables to HTML.
 * Does not rewrite existing HTML tables or repair general markup.
 */

function isTagBoundaryChar(ch: string | undefined): boolean {
  if (!ch || ch.length === 0) return true;
  const c = ch.charCodeAt(0);
  if (c <= 32) return true;
  return ch === "/" || ch === ">";
}

function findH1Ranges(html: string): Array<{ start: number; end: number }> {
  const low = html.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    const h1OpenLen = "<h1".length;
    if (low.startsWith("<h1", lt) && isTagBoundaryChar(html[lt + h1OpenLen])) {
      const gt = html.indexOf(">", lt + h1OpenLen);
      if (gt === -1) break;
      const close = low.indexOf("</h1>", gt + 1);
      const end = close === -1 ? html.length : close + "</h1>".length;
      ranges.push({ start: lt, end });
      i = end;
      continue;
    }
    i = lt + 1;
  }
  return ranges;
}

/** Delete every `<h1>...</h1>` block from post body HTML (title is the page H1). */
export function stripContentH1Blocks(html: string): { html: string; removedCount: number } {
  const ranges = findH1Ranges(html);
  if (ranges.length === 0) return { html, removedCount: 0 };
  let out = html;
  for (let i = ranges.length - 1; i >= 0; i--) {
    const r = ranges[i]!;
    out = out.slice(0, r.start) + out.slice(r.end);
  }
  return { html: out, removedCount: ranges.length };
}

const PIPE_ROW = /^\s*\|.+\|\s*$/;
/** Separator row: `| --- | --- |` (one or more columns). */
const PIPE_SEP = /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/;

function parsePipeCells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function markdownTableToHtml(tableLines: string[]): string {
  const headerRow = tableLines[0]!.trim();
  const dataRows = tableLines.slice(2);
  const headers = parsePipeCells(headerRow);
  let html = "<table><thead><tr>";
  for (const h of headers) {
    html += `<th>${h}</th>`;
  }
  html += "</tr></thead><tbody>";
  for (const row of dataRows) {
    const cells = parsePipeCells(row);
    if (!cells.some((c) => c)) continue;
    html += "<tr>";
    for (const c of cells) {
      html += `<td>${c}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  return html;
}

/** Protect existing HTML `<table>` blocks so markdown conversion does not touch them. */
function withProtectedHtmlTables(
  html: string,
  fn: (body: string) => { html: string; convertedCount: number },
): { html: string; convertedCount: number } {
  const placeholders: string[] = [];
  const protectedBody = html.replace(/<table\b[\s\S]*?<\/table>/gi, (block) => {
    const idx = placeholders.length;
    placeholders.push(block);
    return `<!--NEO_PULSE_TABLE_${idx}-->`;
  });
  const result = fn(protectedBody);
  let restored = result.html;
  for (let i = 0; i < placeholders.length; i++) {
    restored = restored.replace(`<!--NEO_PULSE_TABLE_${i}-->`, placeholders[i]!);
  }
  return { html: restored, convertedCount: result.convertedCount };
}

/**
 * Convert markdown pipe tables in the body to HTML tables.
 * Leaves existing HTML `<table>` markup unchanged.
 */
export function convertMarkdownTablesToHtml(html: string): {
  html: string;
  convertedCount: number;
} {
  return withProtectedHtmlTables(html, (body) => {
    const lineArray = body.split("\n");
    const resultLines: string[] = [];
    let convertedCount = 0;
    let i = 0;
    while (i < lineArray.length) {
      const line = lineArray[i]!;
      if (PIPE_ROW.test(line)) {
        const tableLines: string[] = [];
        let j = i;
        while (j < lineArray.length && PIPE_ROW.test(lineArray[j]!)) {
          tableLines.push(lineArray[j]!);
          j++;
        }
        const sepCount = tableLines.filter((l) => PIPE_SEP.test(l.trim())).length;
        if (tableLines.length >= 2 && sepCount >= 1) {
          resultLines.push(markdownTableToHtml(tableLines));
          convertedCount += 1;
          i = j;
          continue;
        }
      }
      resultLines.push(line);
      i += 1;
    }
    return { html: resultLines.join("\n"), convertedCount };
  });
}

export function cleanupOverviewPostContent(html: string): {
  html: string;
  removedH1Count: number;
  convertedTableCount: number;
} {
  const stripped = stripContentH1Blocks(html);
  const tables = convertMarkdownTablesToHtml(stripped.html);
  return {
    html: tables.html,
    removedH1Count: stripped.removedCount,
    convertedTableCount: tables.convertedCount,
  };
}
