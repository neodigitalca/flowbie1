import {
  OPENROUTER_SSC_SCV_ROW_SEP,
  shortenWireKeysForOpenRouterPayload,
} from "@/lib/competitor-research/competitor-report-wire-openrouter-keys";

/**
 * Rounds numbers to integers before embedding wire JSON in OpenRouter requests.
 * Reduces float noise (e.g. 84.17000000000002) and long GSC decimals in the POST body.
 *
 * Note: GSC `gq` CTR values are fractions; Math.round(0.0025) === 0, so relative CTR is lost in the payload.
 */

/** Recursively round every number with Math.round; does not mutate the input. */
export function roundNumericValuesDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return value;
    return Math.round(value);
  }
  if (Array.isArray(value)) {
    return value.map(roundNumericValuesDeep);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, roundNumericValuesDeep(v)]),
    );
  }
  return value;
}

/**
 * Semrush `domain_organic` CSV: `Keyword,Volume,Traffic,Position` per line after the header.
 * Rounds the last three columns when they parse as finite numbers (keyword may contain commas - we take last 3 fields).
 */
export function roundSemrushCsvStringNumbers(csv: string): string {
  const lines = csv.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 || line.trim() === "") {
      out.push(line);
      continue;
    }
    const parts = line.split(",");
    if (parts.length < 4) {
      out.push(line);
      continue;
    }
    const posRaw = parts[parts.length - 1] ?? "";
    const trRaw = parts[parts.length - 2] ?? "";
    const volRaw = parts[parts.length - 3] ?? "";
    const keyword = parts.slice(0, parts.length - 3).join(",");
    const vol = Number(volRaw);
    const tr = Number(trRaw);
    const pos = Number(posRaw);
    if (Number.isFinite(vol) && Number.isFinite(tr) && Number.isFinite(pos)) {
      out.push(`${keyword},${Math.round(vol)},${Math.round(tr)},${Math.round(pos)}`);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

/** Deep round + round embedded `ssc` / `scsv` CSV strings. Safe for any JSON-like payload. */
export function roundWirePayloadForOpenRouterJson(payload: unknown): unknown {
  const rounded = roundNumericValuesDeep(payload);
  if (!rounded || typeof rounded !== "object" || Array.isArray(rounded)) {
    return rounded;
  }
  const o = { ...(rounded as Record<string, unknown>) };
  if (typeof o.ssc === "string") {
    o.ssc = roundSemrushCsvStringNumbers(o.ssc);
  }
  if (o.scsv && typeof o.scsv === "object" && !Array.isArray(o.scsv)) {
    const scsvIn = o.scsv as Record<string, unknown>;
    const scsvOut: Record<string, unknown> = { ...scsvIn };
    for (const [k, v] of Object.entries(scsvOut)) {
      if (typeof v === "string") {
        scsvOut[k] = roundSemrushCsvStringNumbers(v);
      }
    }
    o.scsv = scsvOut;
  }

  const sep = OPENROUTER_SSC_SCV_ROW_SEP;
  if (typeof o.ssc === "string") {
    o.ssc = o.ssc.replace(/\r?\n/g, sep);
  }
  if (o.scsv && typeof o.scsv === "object" && !Array.isArray(o.scsv)) {
    const scsvIn = o.scsv as Record<string, unknown>;
    const scsvOut: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(scsvIn)) {
      scsvOut[k] = typeof v === "string" ? v.replace(/\r?\n/g, sep) : v;
    }
    o.scsv = scsvOut;
  }

  return shortenWireKeysForOpenRouterPayload(o as Record<string, unknown>);
}
