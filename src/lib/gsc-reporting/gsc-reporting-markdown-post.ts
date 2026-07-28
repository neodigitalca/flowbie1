import type { GscReportingSectionKind } from "@/lib/gsc-reporting/gsc-reporting-types";

/** Lossy cap so executive-facing sections stay scannable when the model ignores row limits. */
export const GSC_REPORT_MAX_TABLE_DATA_ROWS = 6;

function isPipeRow(line: string): boolean {
  return line.trimStart().startsWith("|");
}

function isPipeSeparatorRow(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith("|")) return false;
  return /^[\s|:\-]+$/.test(t);
}

/** Remove ### through ###### lines (Executive Summary keeps ### Key Insights). */
export function stripMarkdownHeadingsH3ThroughH6(md: string): string {
  return md
    .split("\n")
    .filter((line) => !/^\s{0,3}#{3,6}(\s|$)/.test(line))
    .join("\n");
}

/** Drop pipe tables that only have header + separator (no data rows). */
export function stripEmptyPipeTables(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (isPipeRow(line) && i + 1 < lines.length && isPipeSeparatorRow(lines[i + 1]!)) {
      const header = line;
      const sep = lines[i + 1]!;
      let j = i + 2;
      const dataRows: string[] = [];
      while (j < lines.length && isPipeRow(lines[j]!) && !isPipeSeparatorRow(lines[j]!)) {
        dataRows.push(lines[j]!);
        j++;
      }
      if (dataRows.length === 0) {
        i = j;
        continue;
      }
      out.push(header, sep, ...dataRows);
      i = j;
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}

/** Keep header + separator + first N data rows per pipe table block. */
export function capPipeTableDataRows(md: string, maxDataRows: number): string {
  if (maxDataRows < 1) return md;
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (isPipeRow(line) && i + 1 < lines.length && isPipeSeparatorRow(lines[i + 1]!)) {
      const header = line;
      const sep = lines[i + 1]!;
      const dataRows: string[] = [];
      let j = i + 2;
      while (j < lines.length && isPipeRow(lines[j]!) && !isPipeSeparatorRow(lines[j]!)) {
        dataRows.push(lines[j]!);
        j++;
      }
      const capped = dataRows.slice(0, maxDataRows);
      out.push(header, sep, ...capped);
      i = j;
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}

/** Deterministic cleanup after model sanitize; kind-aware heading strip. */
export function applyGscReportingMarkdownPost(md: string, kind: GscReportingSectionKind): string {
  let s = md;
  if (kind !== "executive_summary") {
    s = stripMarkdownHeadingsH3ThroughH6(s);
  }
  s = stripEmptyPipeTables(s);
  s = capPipeTableDataRows(s, GSC_REPORT_MAX_TABLE_DATA_ROWS);
  return s.replace(/\n{3,}/g, "\n\n").trim();
}
