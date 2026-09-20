import {
  capPipeTableDataRows,
  GSC_REPORT_MAX_TABLE_DATA_ROWS,
  stripEmptyPipeTables,
  stripMarkdownHeadingsH3ThroughH6,
} from "@/lib/gsc-reporting/gsc-reporting-markdown-post";
import type { AdsReportingSectionKind } from "@/lib/ads-reporting/ads-reporting-types";

/** Pipeline already prepends the section H2. Drop leftover H2 lines from the model body. */
export function stripMarkdownSectionH2(md: string): string {
  return md
    .split("\n")
    .filter((line) => !/^\s{0,3}##(?!#)/.test(line))
    .join("\n");
}

export function applyAdsReportingMarkdownPost(md: string, kind: AdsReportingSectionKind): string {
  let s = stripMarkdownSectionH2(md);
  if (kind !== "executive_summary") {
    s = stripMarkdownHeadingsH3ThroughH6(s);
  }
  s = stripEmptyPipeTables(s);
  s = capPipeTableDataRows(s, GSC_REPORT_MAX_TABLE_DATA_ROWS);
  return s.replace(/\n{3,}/g, "\n\n").trim();
}
