import Papa from "papaparse";

/** Row shape aligned with API + `convertQueriesToCSV` in GSCFeature (ctr 0–1). */
export type GscParsedQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  /** ISO date when known; empty string otherwise. */
  date: string;
};

function stripLeadingCommentLines(text: string): string {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim().startsWith("#")) {
    i++;
  }
  return lines.slice(i).join("\n");
}

function normalizeHeaderKey(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Tracks which MoM “first period” metric columns were already bound (second period columns are ignored). */
type MomFirstFlags = { clicks: boolean; impressions: boolean; ctr: boolean; position: boolean };

/** Map common GSC export / locale header labels to canonical keys. */
function resolveHeaderAlias(normalized: string, mom: MomFirstFlags): string | null {
  if (normalized === "query" || normalized === "top queries" || normalized === "search query") {
    return "query";
  }
  if (normalized === "date") return "date";

  const momFirst = (
    base: "clicks" | "impressions" | "ctr" | "position",
    flag: keyof MomFirstFlags,
  ): string | null => {
    if (normalized === `${base} (primary)` || normalized === `${base} a`) {
      mom[flag] = true;
      return base;
    }
    if (new RegExp(`^${base} \\(.+\\)$`).test(normalized)) {
      if (!mom[flag]) {
        mom[flag] = true;
        return base;
      }
      return null;
    }
    if (normalized === base) {
      if (!mom[flag]) {
        mom[flag] = true;
        return base;
      }
      return null;
    }
    return null;
  };

  const c = momFirst("clicks", "clicks");
  if (c) return c;
  const i = momFirst("impressions", "impressions");
  if (i) return i;
  const t = momFirst("ctr", "ctr");
  if (t) return t;
  if (normalized === "average position") {
    if (!mom.position) {
      mom.position = true;
      return "position";
    }
    return null;
  }
  const p = momFirst("position", "position");
  if (p) return p;

  return null;
}

export function parseNumber(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw ?? "").trim().replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** CTR in exports may be decimal 0–1, percent string, or number 0–100. */
export function parseGscCtr(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw >= 0 && raw <= 1) return raw;
    if (raw > 1 && raw <= 100) return raw / 100;
    return Math.min(1, raw / 100);
  }
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  if (/%\s*$/.test(s)) {
    const n = parseFloat(s.replace(/%/g, ""));
    return Number.isFinite(n) ? Math.min(1, n / 100) : 0;
  }
  const n = parseFloat(s.replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  if (n >= 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return n / 100;
  return Math.min(1, n / 100);
}

function rowToCanonical(
  row: Record<string, unknown>,
  headerMap: Map<string, string>,
): GscParsedQueryRow | null {
  let queryVal: string | undefined;
  let clicksKey: string | undefined;
  let imprKey: string | undefined;
  let ctrKey: string | undefined;
  let posKey: string | undefined;
  let dateKey: string | undefined;

  for (const [orig, canon] of headerMap) {
    if (canon === "query") queryVal = String(row[orig] ?? "").trim();
    if (canon === "clicks") clicksKey = orig;
    if (canon === "impressions") imprKey = orig;
    if (canon === "ctr") ctrKey = orig;
    if (canon === "position") posKey = orig;
    if (canon === "date") dateKey = orig;
  }

  if (!queryVal) return null;

  const clicks = parseNumber(clicksKey ? row[clicksKey] : 0);
  const impressions = parseNumber(imprKey ? row[imprKey] : 0);
  const ctr = ctrKey ? parseGscCtr(row[ctrKey]) : 0;
  const position = parseNumber(posKey ? row[posKey] : 0);
  const dateRaw = dateKey ? String(row[dateKey] ?? "").trim() : "";
  const date = /^\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.slice(0, 10) : "";

  return {
    query: queryVal,
    clicks,
    impressions,
    ctr,
    position,
    date,
  };
}

export type ParseGscQueriesResult =
  | { ok: true; rows: GscParsedQueryRow[] }
  | { ok: false; reason: string };

/**
 * Parse a Google Search Console "Queries" (or query-dimension) CSV export.
 * Strips leading `#` comment lines, then uses the first header row.
 */
export function parseGscQueriesCsv(text: string): ParseGscQueriesResult {
  const body = stripLeadingCommentLines(text).trim();
  if (!body) {
    return { ok: false, reason: "Empty file" };
  }

  const parsed = Papa.parse<Record<string, string>>(body, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    const msg = parsed.errors.map((e) => e.message).join("; ");
    return { ok: false, reason: `CSV parse error: ${msg}` };
  }

  const fields = parsed.meta.fields;
  if (!fields?.length) {
    return { ok: false, reason: "No CSV header row" };
  }

  const mom: MomFirstFlags = { clicks: false, impressions: false, ctr: false, position: false };
  const headerMap = new Map<string, string>();
  for (const f of fields) {
    const key = f?.trim();
    if (!key) continue;
    const canon = resolveHeaderAlias(normalizeHeaderKey(key), mom);
    if (canon) {
      headerMap.set(key, canon);
    }
  }

  if (![...headerMap.values()].includes("query")) {
    return { ok: false, reason: "No Query column found (expected Query, query, or Top queries)" };
  }
  if (![...headerMap.values()].includes("clicks") || ![...headerMap.values()].includes("impressions")) {
    return { ok: false, reason: "Need Clicks and Impressions columns for a GSC query export" };
  }

  const rows: GscParsedQueryRow[] = [];
  for (const row of parsed.data) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const out = rowToCanonical(rec, headerMap);
    if (out) rows.push(out);
  }

  if (rows.length === 0) {
    return { ok: false, reason: "No data rows after header" };
  }

  return { ok: true, rows };
}

/**
 * Heuristic: enough signal to treat as Queries export vs opaque CSV.
 */
export function isLikelyGscQueriesCsv(text: string): boolean {
  const r = parseGscQueriesCsv(text);
  return r.ok && r.rows.length > 0;
}

/**
 * Dedupe by query (case-insensitive); when duplicate, keep the row with higher impressions.
 */
export function mergeDedupeGscQueriesByMaxImpressions(rows: GscParsedQueryRow[]): GscParsedQueryRow[] {
  const byKey = new Map<string, GscParsedQueryRow>();
  for (const r of rows) {
    const k = r.query.toLowerCase();
    const prev = byKey.get(k);
    if (!prev || r.impressions > prev.impressions) {
      byKey.set(k, r);
    }
  }
  return [...byKey.values()];
}

/** Max rows rendered in UI tables; full file remains available via download / raw view. */
export const GSC_CSV_TABLE_DISPLAY_MAX_ROWS = 2500;

export type ParseCsvGridForDisplayResult =
  | {
      ok: true;
      headers: string[];
      rows: string[][];
      totalDataRows: number;
      truncated: boolean;
    }
  | { ok: false; reason: string };

/**
 * Lossless string grid for Reporting UI: every column and row from the CSV as strings (no row filtering).
 * Strips leading `#` comment lines (same as query export parser) and a UTF-8 BOM.
 */
export function parseCsvGridForDisplay(text: string): ParseCsvGridForDisplayResult {
  const body = stripLeadingCommentLines(text).replace(/^\uFEFF/, "").trim();
  if (!body) {
    return { ok: false, reason: "Empty file" };
  }

  const parsed = Papa.parse<Record<string, string>>(body, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    const msg = parsed.errors.map((e) => e.message).join("; ");
    return { ok: false, reason: `CSV parse error: ${msg}` };
  }

  const rawFields = parsed.meta.fields;
  if (rawFields?.length) {
    const headers = rawFields.map((f, i) => String(f ?? "").trim() || `Column ${i + 1}`);
    const allRows: string[][] = [];
    for (const row of parsed.data) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      allRows.push(rawFields.map((f) => String(rec[f as string] ?? "")));
    }
    const totalDataRows = allRows.length;
    const truncated = totalDataRows > GSC_CSV_TABLE_DISPLAY_MAX_ROWS;
    const rows = truncated ? allRows.slice(0, GSC_CSV_TABLE_DISPLAY_MAX_ROWS) : allRows;
    return { ok: true, headers, rows, totalDataRows, truncated };
  }

  const fallback = Papa.parse<string[]>(body, { header: false, skipEmptyLines: true });
  if (fallback.errors?.length) {
    const msg = fallback.errors.map((e) => e.message).join("; ");
    return { ok: false, reason: `CSV parse error: ${msg}` };
  }
  if (!fallback.data.length) {
    return { ok: false, reason: "No rows" };
  }
  const headerRow = fallback.data[0]!.map((h, i) => String(h ?? "").trim() || `Column ${i + 1}`);
  const allRows = fallback.data.slice(1).map((r) => r.map((c) => String(c ?? "")));
  const totalDataRows = allRows.length;
  const truncated = totalDataRows > GSC_CSV_TABLE_DISPLAY_MAX_ROWS;
  const rows = truncated ? allRows.slice(0, GSC_CSV_TABLE_DISPLAY_MAX_ROWS) : allRows;
  return { ok: true, headers: headerRow, rows, totalDataRows, truncated };
}
