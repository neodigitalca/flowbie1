import { formatGscReportTitlePeriod } from "@/lib/gsc-reporting/gsc-reporting-document-title";
import { sanitizeGoogleDriveDocumentTitle } from "@/lib/gsc-reporting/gsc-reporting-drive-document-title";

const ADS_HEADING_PREFIX = "# Neo Digital PPC Report - ";

export function buildAdsReportDocumentHeading(compareLabel: string): string {
  const period = formatGscReportTitlePeriod(compareLabel);
  return period ? `Neo Digital PPC Report - ${period}` : "Neo Digital PPC Report";
}

export function reportPeriodFromAdsMarkdownHeading(markdown: string): string {
  const firstLine = markdown.split("\n")[0]?.trim() ?? "";
  if (firstLine.length <= ADS_HEADING_PREFIX.length) return "";
  if (!firstLine.toLowerCase().startsWith(ADS_HEADING_PREFIX.toLowerCase())) return "";
  return firstLine.slice(ADS_HEADING_PREFIX.length).trim();
}

function brandClientName(siteName: string): string {
  const raw = siteName.trim();
  const cut = raw.split(":")[0]?.trim() ?? "";
  return cut || raw;
}

/** Drive file name: `{Client} - Neo Digital PPC Report - {current period range}`. */
export function adsReportingDriveDocumentTitle(siteName: string, markdown: string): string {
  const body = markdown.trim();
  if (!body) {
    throw new Error("PPC Drive title requires report markdown.");
  }
  const period = reportPeriodFromAdsMarkdownHeading(body);
  if (!period) {
    throw new Error("PPC Drive title requires a Neo Digital PPC Report heading with the current period date range.");
  }
  const client = sanitizeGoogleDriveDocumentTitle(brandClientName(siteName));
  if (client.length < 2) {
    throw new Error("PPC Drive title requires a client name.");
  }
  return sanitizeGoogleDriveDocumentTitle(`${client} - Neo Digital PPC Report - ${period}`);
}

export async function generateAdsReportingDriveDocumentTitle(input: {
  siteName: string;
  markdown: string;
}): Promise<string> {
  return adsReportingDriveDocumentTitle(input.siteName, input.markdown);
}

export function adPerformanceH2ForCompareKind(compareKind: "mom" | "yoy" | "custom"): string {
  if (compareKind === "yoy") return "Ad Performance Compared Year Over Year";
  if (compareKind === "custom") return "Ad Performance Compared Period Over Period";
  return "Ad Performance Compared Month Over Month";
}
