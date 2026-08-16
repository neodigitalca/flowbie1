/**
 * Normalize GBP Location ID from pasted URL, path, or bare numeric id.
 * Prefers fid= from business.google.com URLs (matches Google performance API docs).
 */
export function isGbpProfileUrl(raw: string | undefined | null): boolean {
  return /business\.google\.com/i.test((raw ?? "").trim());
}

export function gbpLocationIdCandidates(raw: string | undefined | null): string[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  const push = (id: string | undefined) => {
    const value = (id ?? "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };

  const fromLocations = trimmed.match(/locations\/(\d+)/i);
  if (fromLocations?.[1]) push(fromLocations[1]);

  const fidMatch = trimmed.match(/[?&]fid=(\d+)/i);
  if (fidMatch?.[1]) push(fidMatch[1]);

  const fromPath = trimmed.match(/\/n\/(\d+)/i);
  if (fromPath?.[1]) push(fromPath[1]);

  if (/^\d+$/.test(trimmed)) push(trimmed);

  if (out.length === 0) {
    const hasUrlMarkers = /[?&/=]/.test(trimmed);
    if (!hasUrlMarkers) {
      const digits = trimmed.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 25) push(digits);
    }
  }

  return out;
}

/** localPosts v4 prefers /n/ id; performance API prefers fid. */
export function gbpLocationIdPostCandidates(raw: string | undefined | null): string[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  const push = (id: string | undefined) => {
    const value = (id ?? "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };

  const fromLocations = trimmed.match(/locations\/(\d+)/i);
  if (fromLocations?.[1]) push(fromLocations[1]);

  const fromPath = trimmed.match(/\/n\/(\d+)/i);
  if (fromPath?.[1]) push(fromPath[1]);

  const fidMatch = trimmed.match(/[?&]fid=(\d+)/i);
  if (fidMatch?.[1]) push(fidMatch[1]);

  if (/^\d+$/.test(trimmed)) push(trimmed);

  if (out.length === 0) {
    return gbpLocationIdCandidates(trimmed);
  }

  return out;
}

export function normalizeGbpLocationIdInput(raw: string | undefined | null): string {
  const candidates = gbpLocationIdCandidates(raw);
  return candidates[0] ?? "";
}

/** Keep full profile URLs so posting can try every id segment. */
export function persistGbpLocationIdInput(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  if (isGbpProfileUrl(trimmed)) return trimmed;
  return normalizeGbpLocationIdInput(trimmed);
}
