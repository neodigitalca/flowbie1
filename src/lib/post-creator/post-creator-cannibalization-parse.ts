export type PostCreatorCannibalDecision = {
  rowIndex: number;
  allow: boolean;
  conflictingUrl?: string;
  reason: string;
};

export function parsePostCreatorCannibalizationJson(raw: string): PostCreatorCannibalDecision[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? trimmed);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object") return [];
  const decisions = (parsed as { decisions?: unknown }).decisions;
  if (!Array.isArray(decisions)) return [];

  const out: PostCreatorCannibalDecision[] = [];
  for (const item of decisions) {
    if (!item || typeof item !== "object") continue;
    const rowIndex = Number((item as { rowIndex?: unknown }).rowIndex);
    const allow = (item as { allow?: unknown }).allow;
    const reason = String((item as { reason?: unknown }).reason ?? "").trim();
    const conflictingUrl = String((item as { conflictingUrl?: unknown }).conflictingUrl ?? "").trim();
    if (!Number.isFinite(rowIndex) || typeof allow !== "boolean") continue;
    out.push({
      rowIndex,
      allow,
      reason: reason || (allow ? "Allowed" : "Blocked by cannibalization agent"),
      conflictingUrl: conflictingUrl || undefined,
    });
  }
  return out;
}
