/**
 * OpenRouter POST body only: shorter top-level JSON keys and CSV row delimiter
 * to reduce serialized size. Canonical `CompetitorReportWirePayload` keeps long names.
 */

/** ASCII Record Separator - used instead of newlines inside `ssc` / `scv` blobs in JSON. */
export const OPENROUTER_SSC_SCV_ROW_SEP = "\x1e";

/** Canonical wire key → key used in JSON.stringify for OpenRouter. */
export const OPENROUTER_WIRE_KEY_SHORT: Record<string, string> = {
  scsv: "scv",
  ekrM: "ekM",
};

export function shortenWireKeysForOpenRouterPayload(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...o };
  for (const [from, to] of Object.entries(OPENROUTER_WIRE_KEY_SHORT)) {
    if (Object.prototype.hasOwnProperty.call(out, from)) {
      out[to] = out[from];
      delete out[from];
    }
  }
  return out;
}
