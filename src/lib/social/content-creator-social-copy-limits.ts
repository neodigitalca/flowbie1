export const CONTENT_CREATOR_IG_TARGET_CHARS = 125;
export const CONTENT_CREATOR_IG_MAX_CHARS = 300;
export const CONTENT_CREATOR_IG_HASHTAG_MIN = 3;
export const CONTENT_CREATOR_IG_HASHTAG_MAX = 5;

export const CONTENT_CREATOR_FB_TARGET_CHARS = 250;
export const CONTENT_CREATOR_FB_MAX_CHARS = 500;
export const CONTENT_CREATOR_FB_HASHTAG_MAX = 3;

export const CONTENT_CREATOR_LINKEDIN_TARGET_CHARS = 900;
export const CONTENT_CREATOR_LINKEDIN_MAX_CHARS = 1300;
export const CONTENT_CREATOR_LINKEDIN_HASHTAG_MAX = 3;

export const CONTENT_CREATOR_EVENTS_RULE =
  "Do not mention holidays, observances, seasons, or event hooks unless Event context is explicitly provided in the user payload. Do not infer events from the scheduled date.";

function stripEdges(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && /\s/.test(value[start] ?? "")) start += 1;
  while (end > start && /\s/.test(value[end - 1] ?? "")) end -= 1;
  return value.slice(start, end);
}

function splitHashtagLine(text: string): { body: string; hashtags: string[] } {
  const lines = text.split("\n").map((line) => stripEdges(line)).filter(Boolean);
  if (!lines.length) return { body: "", hashtags: [] };

  const last = lines[lines.length - 1] ?? "";
  const tagMatches = last.match(/#[\w\d_]+/g);
  const looksLikeHashtagLine = tagMatches && tagMatches.length >= 2 && tagMatches.join(" ").length >= last.length * 0.6;

  if (looksLikeHashtagLine) {
    return {
      body: stripEdges(lines.slice(0, -1).join("\n")),
      hashtags: normalizeHashtags(tagMatches, CONTENT_CREATOR_IG_HASHTAG_MAX),
    };
  }

  const inlineTags = text.match(/#[\w\d_]+/g) ?? [];
  const body = inlineTags.length
    ? stripEdges(text.replace(/#[\w\d_]+/g, "").replace(/\s+/g, " "))
    : stripEdges(text);
  return {
    body,
    hashtags: normalizeHashtags(inlineTags, CONTENT_CREATOR_IG_HASHTAG_MAX),
  };
}

export function normalizeHashtags(tags: string[], maxCount: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const normalized = tag.startsWith("#") ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= maxCount) break;
  }
  return out;
}

function clampBody(body: string, maxChars: number): string {
  if (body.length <= maxChars) return body;
  const slice = body.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) return stripEdges(slice.slice(0, lastSpace));
  return stripEdges(slice);
}

function assembleCaption(body: string, hashtags: string[], maxTotal: number): string {
  const trimmedBody = stripEdges(body);
  if (!hashtags.length) return clampBody(trimmedBody, maxTotal);
  const tagLine = hashtags.join(" ");
  const combined = stripEdges(`${trimmedBody}\n${tagLine}`);
  if (combined.length <= maxTotal) return combined;
  const tagBudget = tagLine.length + 1;
  const bodyBudget = Math.max(40, maxTotal - tagBudget);
  return stripEdges(`${clampBody(trimmedBody, bodyBudget)}\n${tagLine}`);
}

export function clampInstagramCaption(value: string, briefHashtags?: string[]): string {
  const { body, hashtags } = splitHashtagLine(value);
  const tags =
    hashtags.length > 0
      ? hashtags
      : normalizeHashtags(briefHashtags ?? [], CONTENT_CREATOR_IG_HASHTAG_MAX);
  const bodyLines = body.split("\n").map((l) => stripEdges(l)).filter(Boolean);
  const trimmedBody = bodyLines.slice(0, 2).join("\n");
  return assembleCaption(trimmedBody, tags, CONTENT_CREATOR_IG_MAX_CHARS);
}

export function clampLinkedinCaption(value: string, briefHashtags?: string[]): string {
  const { body, hashtags } = splitHashtagLine(value);
  const tags = normalizeHashtags(
    hashtags.length > 0 ? hashtags : briefHashtags ?? [],
    CONTENT_CREATOR_LINKEDIN_HASHTAG_MAX,
  );
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => stripEdges(p))
    .filter(Boolean)
    .slice(0, 3);
  const trimmedBody = paragraphs.join("\n\n");
  return assembleCaption(trimmedBody, tags, CONTENT_CREATOR_LINKEDIN_MAX_CHARS);
}

export function countSentences(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((s) => stripEdges(s))
    .filter(Boolean).length;
}
