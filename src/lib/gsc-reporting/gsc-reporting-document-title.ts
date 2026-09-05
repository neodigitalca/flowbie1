/** Current-period range from a GSC compare label (text before " vs "). */
export function formatGscReportTitlePeriod(compareLabel: string): string {
  return compareLabel.split(" vs ")[0]?.trim() ?? "";
}

/** Primary period month and year from a GSC compare label, e.g. "July 2026". */
export function formatGscReportTitleMonthYear(compareLabel: string): string {
  const primary = formatGscReportTitlePeriod(compareLabel);
  if (!primary) return "";

  const comma = primary.lastIndexOf(",");
  if (comma < 0) return "";

  const year = primary.slice(comma + 1).trim();
  const month = primary.split(" ")[0]?.trim() ?? "";
  if (!month || !year) return "";

  return `${month} ${year}`;
}

export function buildGscReportDocumentHeading(compareLabel: string): string {
  const period = formatGscReportTitlePeriod(compareLabel);
  return period ? `Neo Digital SEO Report - ${period}` : "Neo Digital SEO Report";
}

export function reportPeriodFromMarkdownHeading(markdown: string): string {
  const firstLine = markdown.split("\n")[0]?.trim() ?? "";
  const prefix = "# Neo Digital SEO Report - ";
  if (firstLine.length <= prefix.length) return "";
  if (!firstLine.toLowerCase().startsWith(prefix.toLowerCase())) return "";
  return firstLine.slice(prefix.length).trim();
}
