export type KbChunk = { id: string; text: string };

const CHUNK_CHARS = 3_500;

/** Split KB into overlapping-ish chunks for scoring. */
export function splitKbIntoChunks(kbText: string): KbChunk[] {
  const t = kbText.trim();
  if (!t) return [];
  const chunks: KbChunk[] = [];
  let start = 0;
  let i = 0;
  while (start < t.length) {
    const end = Math.min(t.length, start + CHUNK_CHARS);
    const slice = t.slice(start, end);
    chunks.push({ id: `c${i}`, text: slice });
    i += 1;
    start += CHUNK_CHARS;
  }
  return chunks;
}

function tokenizeQuery(q: string): Set<string> {
  const words = q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 2);
  return new Set(words);
}

function scoreChunk(text: string, queryTokens: Set<string>): number {
  const lower = text.toLowerCase();
  let s = 0;
  for (const w of queryTokens) {
    if (lower.includes(w)) s += 1;
  }
  return s;
}

export function retrieveTopKbChunks(args: {
  kbText: string;
  ragQuery: string;
  h2Title: string;
  maxChunks: number;
  maxTotalChars: number;
}): KbChunk[] {
  const q = `${args.ragQuery} ${args.h2Title}`.trim();
  const tokens = tokenizeQuery(q);
  const chunks = splitKbIntoChunks(args.kbText);
  if (chunks.length === 0) return [];
  const scored = chunks
    .map((c) => ({ c, score: scoreChunk(c.text, tokens) }))
    .sort((a, b) => b.score - a.score);
  const picked: KbChunk[] = [];
  let total = 0;
  for (const { c } of scored) {
    if (picked.length >= args.maxChunks) break;
    if (total + c.text.length > args.maxTotalChars && picked.length > 0) break;
    picked.push(c);
    total += c.text.length;
  }
  if (picked.length === 0) {
    return chunks.slice(0, Math.min(args.maxChunks, chunks.length));
  }
  return picked;
}
