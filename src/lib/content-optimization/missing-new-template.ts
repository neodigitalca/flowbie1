import { extractH2TextsFromHtml } from "@/lib/overview/overview-blog-headers-extract";
import { lookupInventoryRow, type BulkOptimizerInventorySnapshot } from "@/lib/wordpress-api/inventory-match";
import type { TaskExecutionTargetBucket } from "@/lib/task-execution-bucket";

export const MISSING_NEW_TEMPLATE_FILTER = "missing_new_template" as const;

export type TaskExecutionUrlFilter = typeof MISSING_NEW_TEMPLATE_FILTER;

export type MissingTemplateAudit = {
  scanned: number;
  missing: string[];
  alreadyNew: string[];
  h2sByUrl: Record<string, string[]>;
};

export function formatAuditH2Cell(h2s: readonly string[]): string {
  return h2s.map((heading) => heading.trim()).filter(Boolean).join(" | ");
}

export function h2CellHasAnswer(h2: string): boolean {
  return h2
    .split("|")
    .map((part) => part.trim().toLowerCase())
    .includes("answer");
}

/** True when published HTML already has the new-template chrome H2 titled Answer. */
export function htmlHasNewTemplateAnswerH2(html: string): boolean {
  return extractH2TextsFromHtml(html).some((heading) => heading.trim().toLowerCase() === "answer");
}

export function auditUrlsMissingNewTemplate(
  urls: string[],
  htmlForUrl: (url: string) => string,
): MissingTemplateAudit {
  const missing: string[] = [];
  const alreadyNew: string[] = [];
  const h2sByUrl: Record<string, string[]> = {};
  for (const url of urls) {
    const h2s = extractH2TextsFromHtml(htmlForUrl(url));
    h2sByUrl[url] = h2s;
    if (h2s.some((heading) => heading.trim().toLowerCase() === "answer")) alreadyNew.push(url);
    else missing.push(url);
  }
  return { scanned: urls.length, missing, alreadyNew, h2sByUrl };
}

function typeHintForBucket(bucket: TaskExecutionTargetBucket): "post" | "page" | "other" {
  if (bucket === "posts") return "post";
  if (bucket === "pages") return "page";
  return "other";
}

export function inventoryHtmlForUrl(
  snapshot: BulkOptimizerInventorySnapshot,
  siteUrl: string,
  url: string,
  bucket: TaskExecutionTargetBucket,
): string {
  const row = lookupInventoryRow(snapshot, siteUrl, url, typeHintForBucket(bucket));
  return String(row?.fields?.content ?? "");
}

export function isMissingNewTemplateFilter(value: unknown): value is TaskExecutionUrlFilter {
  return value === MISSING_NEW_TEMPLATE_FILTER;
}

export const MISSING_NEW_TEMPLATE_AUDIT_PROMPT =
  "A page already has the new template when its published HTML includes an H2 whose text is exactly Answer. Keep those pages. This step lists only URLs that still lack that H2.";

export const MISSING_NEW_TEMPLATE_OPTIMIZE_INSTRUCTIONS =
  "Apply the new live template. Published HTML must include an H2 titled Answer. Rewrite the page to that chrome. Do not drop an existing Answer H2.";

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export const MISSING_TEMPLATE_AUDIT_CSV_HEADERS = ["url", "H2"] as const;

function auditCsvCell(header: string, url: string, missing: boolean, h2s: readonly string[]): string {
  const key = header.trim().toLowerCase();
  if (key === "url" || key === "page" || key === "link") return url;
  if (key === "h2" || key === "answer") return formatAuditH2Cell(h2s);
  if (key === "status") return missing ? "missing" : "already_new";
  return "";
}

/** Full scan CSV for run RAG. H2 is the scraped headings. Full AISEO works rows whose H2s do not include Answer. */
export function missingTemplateAuditToCsv(
  audit: MissingTemplateAudit,
  headers: readonly string[] = MISSING_TEMPLATE_AUDIT_CSV_HEADERS,
): string {
  const cols = headers.map((header) => header.trim()).filter(Boolean);
  const used = cols.length > 0 ? cols : [...MISSING_TEMPLATE_AUDIT_CSV_HEADERS];
  const lines = [used.join(",")];
  const write = (url: string, missing: boolean) => {
    const h2s = audit.h2sByUrl[url] ?? [];
    lines.push(used.map((header) => csvCell(auditCsvCell(header, url, missing, h2s))).join(","));
  };
  for (const url of audit.missing) write(url, true);
  for (const url of audit.alreadyNew) write(url, false);
  return `${lines.join("\n")}\n`;
}

export function missingTemplateAuditFileName(bucket: TaskExecutionTargetBucket): string {
  return `missing-template-${bucket}.csv`;
}
