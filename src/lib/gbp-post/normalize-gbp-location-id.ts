/**
 * Normalize GBP Location ID from pasted URL, path, or bare numeric id.
 */
export function normalizeGbpLocationIdInput(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  const fromPath = trimmed.match(/\/n\/(\d+)/i);
  if (fromPath?.[1]) return fromPath[1];

  const fromLocations = trimmed.match(/locations\/(\d+)/i);
  if (fromLocations?.[1]) return fromLocations[1];

  const fidMatch = trimmed.match(/[?&]fid=(\d+)/i);
  if (fidMatch?.[1]) return fidMatch[1];

  if (/^\d+$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 ? digits : trimmed;
}
