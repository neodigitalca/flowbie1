import Papa from "papaparse";
import type { WordPressSite } from "@/components/integrations/types";
import { parseGscCtr, parseNumber } from "@/lib/gsc-export-csv-parse";
import { normalizeLegacyUrlRows } from "@/lib/redirect-matcher/normalize-legacy-url-rows";
import type { LegacyUrlRow } from "@/lib/redirect-matcher/types";

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

const SOURCE_HEADER_ALIASES = [
  "top pages",
  "page",
  "url",
  "old_url",
  "old url",
  "source",
  "legacy url",
  "legacy_url",
];

function resolveSourceHeader(headers: string[]): string | null {
  for (const h of headers) {
    const n = normalizeHeaderKey(h);
    if (SOURCE_HEADER_ALIASES.includes(n)) return h;
  }
  return null;
}

function resolveMetricHeader(headers: string[], metric: string): string | null {
  for (const h of headers) {
    if (normalizeHeaderKey(h) === metric) return h;
  }
  return null;
}

function looksLikeUrl(value: string): boolean {
  const v = value.trim();
  return (
    /^https?:\/\//i.test(v) ||
    (v.startsWith("/") && v.length > 1) ||
    /^\d{4}\/\d{2}\//.test(v)
  );
}

function parseBareUrlLines(text: string): LegacyUrlRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: LegacyUrlRow[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const cell = lines[i]!;
    if (!looksLikeUrl(cell)) continue;
    rows.push({
      legacyUrl: cell,
      uploadRow: i + 1,
    });
  }

  return rows;
}

function hasCsvDelimiter(text: string): boolean {
  return text.split(/\r?\n/).some((line) => line.includes(","));
}

/** Parse legacy URL CSV (GSC export, redirect map, or bare URL list). */
export function parseLegacyUrlCsv(
  csvText: string,
  site: WordPressSite,
): { rows: LegacyUrlRow[]; error?: string } {
  const trimmed = stripLeadingCommentLines(csvText.trim());
  if (!trimmed) return { rows: [], error: "CSV is empty." };

  if (!hasCsvDelimiter(trimmed)) {
    const bareRows = parseBareUrlLines(trimmed);
    if (!bareRows.length) {
      return { rows: [], error: "No legacy URL rows found." };
    }
    return normalizeLegacyUrlRows(bareRows, site);
  }

  const parsed = Papa.parse<Record<string, unknown>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const fatalErrors = parsed.errors.filter((e) => e.type !== "Delimiter");
  if (fatalErrors.length > 0) {
    const msg = fatalErrors.map((e) => e.message).join("; ");
    return { rows: [], error: msg || "Failed to parse CSV." };
  }

  const headers = parsed.meta.fields ?? [];
  const sourceKey = resolveSourceHeader(headers);

  if (sourceKey) {
    const clicksKey = resolveMetricHeader(headers, "clicks");
    const imprKey = resolveMetricHeader(headers, "impressions");
    const ctrKey = resolveMetricHeader(headers, "ctr");
    const posKey =
      resolveMetricHeader(headers, "position") ?? resolveMetricHeader(headers, "average position");

    const rows: LegacyUrlRow[] = [];
    for (let i = 0; i < parsed.data.length; i += 1) {
      const row = parsed.data[i];
      if (!row || typeof row !== "object") continue;
      const legacyUrl = pickColumn(row, [sourceKey]) || String(row[sourceKey] ?? "").trim();
      if (!legacyUrl) continue;
      rows.push({
        legacyUrl,
        uploadRow: i + 1,
        clicks: clicksKey ? parseNumber(row[clicksKey]) : undefined,
        impressions: imprKey ? parseNumber(row[imprKey]) : undefined,
        ctr: ctrKey ? parseGscCtr(row[ctrKey]) : undefined,
        position: posKey ? parseNumber(row[posKey]) : undefined,
      });
    }

    if (!rows.length) {
      return { rows: [], error: "No legacy URL rows found in CSV." };
    }
    return normalizeLegacyUrlRows(rows, site);
  }

  const bareRows = parseBareUrlLines(trimmed);
  if (!bareRows.length) {
    return {
      rows: [],
      error: "Missing Top pages / old_url / source column, and no URL rows found.",
    };
  }

  return normalizeLegacyUrlRows(bareRows, site);
}
