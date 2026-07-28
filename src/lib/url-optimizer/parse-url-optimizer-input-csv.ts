import Papa from "papaparse";
import { parseGscCtr, parseNumber } from "@/lib/gsc-export-csv-parse";
import type { UrlOptimizerInputRow } from "@/lib/url-optimizer/types";

function stripLeadingCommentLines(text: string): string {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim().startsWith("#")) {
    i++;
  }
  return lines.slice(i).join("\n");
}

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickColumn(row: Record<string, unknown>, names: string[]): string {
  const keys = Object.keys(row);
  for (const name of names) {
    const norm = normalizeHeaderKey(name);
    for (const k of keys) {
      if (normalizeHeaderKey(k) === norm) {
        const v = row[k];
        if (v != null && String(v).trim()) return String(v).trim();
      }
    }
  }
  return "";
}

function resolvePageHeader(headers: string[]): string | null {
  for (const h of headers) {
    const n = normalizeHeaderKey(h);
    if (n === "page" || n === "url" || n === "top pages") return h;
  }
  return null;
}

function resolveMetricHeader(headers: string[], metric: string): string | null {
  for (const h of headers) {
    if (normalizeHeaderKey(h) === metric) return h;
  }
  return null;
}

/** Parse GSC Pages CSV for URL Optimizer — preserves upload order 1:1; ignores prefilled new_url column. */
export function parseUrlOptimizerInputCsv(csvText: string): {
  rows: UrlOptimizerInputRow[];
  error?: string;
} {
  const trimmed = stripLeadingCommentLines(csvText.trim());
  if (!trimmed) return { rows: [], error: "CSV is empty." };

  const parsed = Papa.parse<Record<string, unknown>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const msg = parsed.errors.map((e) => e.message).join("; ");
    return { rows: [], error: msg || "Failed to parse CSV." };
  }

  const headers = parsed.meta.fields ?? [];
  const pageKey = resolvePageHeader(headers);
  if (!pageKey) {
    return {
      rows: [],
      error: "Missing Top pages / Page / URL column.",
    };
  }

  const clicksKey = resolveMetricHeader(headers, "clicks");
  const imprKey = resolveMetricHeader(headers, "impressions");
  const ctrKey = resolveMetricHeader(headers, "ctr");
  const posKey = resolveMetricHeader(headers, "position") ?? resolveMetricHeader(headers, "average position");

  const rows: UrlOptimizerInputRow[] = [];

  for (let i = 0; i < parsed.data.length; i += 1) {
    const row = parsed.data[i];
    if (!row || typeof row !== "object") continue;
    const page = pickColumn(row, [pageKey]) || String(row[pageKey] ?? "").trim();
    if (!page) continue;

    rows.push({
      page,
      clicks: clicksKey ? parseNumber(row[clicksKey]) : 0,
      impressions: imprKey ? parseNumber(row[imprKey]) : 0,
      ctr: ctrKey ? parseGscCtr(row[ctrKey]) : 0,
      position: posKey ? parseNumber(row[posKey]) : 0,
      csvUploadRow: i + 1,
    });
  }

  if (!rows.length) {
    return { rows: [], error: "No page rows found in CSV." };
  }

  return { rows };
}
