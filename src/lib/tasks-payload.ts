import type { TaskPayloadKind } from "@/lib/tasks-types";

/** Ensure keyword is the first key in a payload object (matches backend encode_payload). */
export function encodeKeywordFirstPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const keyword = typeof payload.keyword === "string" ? payload.keyword : "";
  const ordered: Record<string, unknown> = { keyword };
  for (const [key, value] of Object.entries(payload)) {
    if (key === "keyword") continue;
    ordered[key] = value;
  }
  return ordered;
}

export function stringifyKeywordFirstPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(encodeKeywordFirstPayload(payload));
}

export function isKeywordFirstPayload(json: string): boolean {
  if (!json.startsWith('{"keyword"')) return false;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    return keys[0] === "keyword";
  } catch {
    return false;
  }
}

export function buildPayload(
  kind: TaskPayloadKind,
  keyword: string,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  return encodeKeywordFirstPayload({ keyword, kind, ...fields });
}
