import Papa from "papaparse";
import {
  cellString,
  hasCell,
  type ContentCalendarRow,
} from "@/lib/social/content-creator-types";

export const CONTENT_CALENDAR_TEMPLATE_CSV =
  "Events,Keyword,Day Of week,Dates,FB/Instagram Content,Linkedin Content,Link/Landing page,Image,Prompt Modifier\n,edmonton seo expert,Tuesday,8/11/2026,,,https://example.com/blog/post/,,Optional visual note\n";

export const CONTENT_CALENDAR_TEMPLATE_FILENAME = "content-calendar-template.csv";

export const CONTENT_CALENDAR_HEADERS = [
  "Events",
  "Keyword",
  "Day Of week",
  "Dates",
  "FB/Instagram Content",
  "Linkedin Content",
  "Link/Landing page",
  "Image",
  "Prompt Modifier",
] as const;

export type ContentCalendarImportRow = {
  events?: string;
  keyword?: string;
  dayOfWeek?: string;
  date?: string;
  fbInstagramContent?: string;
  linkedinContent?: string;
  landingPageUrl?: string;
  imageUrl?: string;
  promptModifier?: string;
};

function normalizeHeaderKey(key: string): string {
  return key.toLowerCase().replace(/[\s_/-]+/g, "");
}

const HEADER_MAP: Record<string, keyof ContentCalendarImportRow> = {
  events: "events",
  keyword: "keyword",
  keywords: "keyword",
  dayofweek: "dayOfWeek",
  dates: "date",
  date: "date",
  fbinstagramcontent: "fbInstagramContent",
  fblinkedincontent: "fbInstagramContent",
  linkedincontent: "linkedinContent",
  linklandingpage: "landingPageUrl",
  landingpage: "landingPageUrl",
  url: "landingPageUrl",
  image: "imageUrl",
  promptmodifier: "promptModifier",
};

function csvCellToString(value: unknown): string {
  return cellString(value);
}

function recordToImportRow(record: Record<string, unknown>): ContentCalendarImportRow | null {
  const row: ContentCalendarImportRow = {};
  for (const [key, value] of Object.entries(record)) {
    const field = HEADER_MAP[normalizeHeaderKey(key)];
    if (!field) continue;
    const text = csvCellToString(value);
    if (text.length > 0) row[field] = text;
  }
  if (!hasCell(row.keyword) && !hasCell(row.landingPageUrl)) {
    return null;
  }
  return row;
}

export function parseContentCalendarCsv(csvText: string): ContentCalendarImportRow[] {
  if (typeof csvText !== "string" || csvText.length === 0) return [];

  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => (value == null ? "" : String(value)),
  });

  const rows: ContentCalendarImportRow[] = [];
  for (const record of parsed.data) {
    if (!record || typeof record !== "object") continue;
    const row = recordToImportRow(record);
    if (row) rows.push(row);
  }
  return rows;
}

function csvCell(value: string): string {
  const text = value ?? "";
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildContentCalendarExportCsv(rows: ContentCalendarRow[]): string {
  const exportRows = rows.filter(
    (row) =>
      hasCell(row.keyword) ||
      hasCell(row.fbInstagramContent) ||
      hasCell(row.linkedinContent),
  );
  if (!exportRows.length) {
    throw new Error("No generated content to export.");
  }

  const lines: string[] = [CONTENT_CALENDAR_HEADERS.map(csvCell).join(",")];
  for (const row of exportRows) {
    lines.push(
      [
        row.events ?? "",
        row.keyword ?? "",
        row.dayOfWeek ?? "",
        row.date ?? "",
        row.fbInstagramContent ?? "",
        row.linkedinContent ?? "",
        row.landingPageUrl ?? "",
        row.imageUrl ?? "",
        row.promptModifier ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function contentCalendarExportFilename(siteName: string): string {
  const slug = cellString(siteName).replace(/\s+/g, "-").toLowerCase() || "content-calendar";
  return `${slug}-content-calendar.csv`;
}

export function triggerContentCalendarCsvDownload(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function importRowToCalendarPatch(
  imported: ContentCalendarImportRow,
): Partial<ContentCalendarRow> {
  return {
    events: imported.events,
    keyword: imported.keyword,
    dayOfWeek: imported.dayOfWeek,
    date: imported.date,
    fbInstagramContent: imported.fbInstagramContent,
    linkedinContent: imported.linkedinContent,
    landingPageUrl: imported.landingPageUrl,
    imageUrl: imported.imageUrl,
    promptModifier: imported.promptModifier,
    status: "idle",
    errorMessage: undefined,
  };
}
