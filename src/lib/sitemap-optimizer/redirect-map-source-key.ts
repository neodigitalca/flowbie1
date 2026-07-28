import {
  normalizeRankMathRelativePath,
  rankMathSourceFromPageUrl,
} from "@/lib/rank-math-redirect-csv";

/** Match Rank Math relative paths to full WordPress URLs. */
export function redirectMapSourceMatchKey(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const fromFull = rankMathSourceFromPageUrl(trimmed);
  if (fromFull) return fromFull;
  return normalizeRankMathRelativePath(trimmed);
}
