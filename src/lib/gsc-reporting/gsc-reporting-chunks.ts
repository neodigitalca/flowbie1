import type { GscReportingChunk } from "@/lib/gsc-reporting/gsc-reporting-types";

const DEFAULT_MAX_CHUNK_CHARS = 4_000;
const ROW_WINDOW = 80;

function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  const lower = s.toLowerCase();
  for (const w of lower.split(/[^a-z0-9]+/)) {
    if (w.length >= 2) out.add(w);
  }
  return out;
}

/** Split file text into overlapping row windows and char-bounded chunks for RAG. */
export function splitGscFilesIntoChunks(
  files: { name: string; content: string }[],
  maxChunkChars = DEFAULT_MAX_CHUNK_CHARS,
): GscReportingChunk[] {
  const chunks: GscReportingChunk[] = [];
  let gid = 0;
  for (const f of files) {
    const lines = f.content.split(/\r?\n/);
    if (lines.length <= 1) {
      const text = `--- FILE: ${f.name} ---\n${f.content}`;
      chunks.push({ id: `c${gid++}`, sourceFile: f.name, text: text.slice(0, maxChunkChars) });
      continue;
    }
    const header = lines[0] ?? "";
    for (let i = 1; i < lines.length; i += ROW_WINDOW) {
      const slice = [header, ...lines.slice(i, i + ROW_WINDOW)].join("\n");
      const block = `--- FILE: ${f.name} (rows ${i}-${Math.min(lines.length - 1, i + ROW_WINDOW - 1)}) ---\n${slice}`;
      if (block.length <= maxChunkChars) {
        chunks.push({ id: `c${gid++}`, sourceFile: f.name, text: block });
      } else {
        for (let j = 0; j < block.length; j += maxChunkChars) {
          chunks.push({
            id: `c${gid++}`,
            sourceFile: f.name,
            text: block.slice(j, j + maxChunkChars),
          });
        }
      }
    }
  }
  return chunks;
}

/** Lexical overlap score: Jaccard on word tokens between query and chunk. */
export function scoreChunkForRagQuery(chunkText: string, ragQuery: string): number {
  const a = tokenize(ragQuery);
  const b = tokenize(chunkText);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

/** One chunk per uploaded file (first in split order) so every CSV contributes header plus rows to retrieval. */
export function pickFirstChunkPerSourceFile(chunks: GscReportingChunk[]): GscReportingChunk[] {
  const seen = new Set<string>();
  const out: GscReportingChunk[] = [];
  for (const c of chunks) {
    if (seen.has(c.sourceFile)) continue;
    seen.add(c.sourceFile);
    out.push(c);
  }
  return out;
}

/** Pin chunks first (e.g. per-file coverage), then fill from scored list; dedupe by chunk id; respect caps. */
export function mergePinnedChunksWithRetrieval(args: {
  pinned: GscReportingChunk[];
  scored: GscReportingChunk[];
  maxChunks: number;
  maxTotalChars: number;
}): GscReportingChunk[] {
  const out: GscReportingChunk[] = [];
  const ids = new Set<string>();
  let total = 0;

  const tryAdd = (c: GscReportingChunk): boolean => {
    if (ids.has(c.id)) return false;
    if (out.length >= args.maxChunks) return false;
    if (out.length > 0 && total + c.text.length > args.maxTotalChars) return false;
    ids.add(c.id);
    out.push(c);
    total += c.text.length;
    return true;
  };

  for (const c of args.pinned) tryAdd(c);
  for (const c of args.scored) tryAdd(c);
  return out;
}

export function retrieveTopChunks(args: {
  chunks: GscReportingChunk[];
  ragQuery: string;
  h2Title: string;
  maxChunks: number;
  maxTotalChars: number;
}): GscReportingChunk[] {
  const q = `${args.h2Title} ${args.ragQuery}`;
  const scored = args.chunks
    .map((c) => ({ c, s: scoreChunkForRagQuery(c.text, q) }))
    .sort((a, b) => b.s - a.s);
  const out: GscReportingChunk[] = [];
  let total = 0;
  for (const { c } of scored) {
    if (out.length >= args.maxChunks) break;
    if (total + c.text.length > args.maxTotalChars && out.length > 0) break;
    out.push(c);
    total += c.text.length;
  }
  if (out.length === 0 && args.chunks.length > 0) {
    for (const c of args.chunks) {
      if (out.length >= args.maxChunks) break;
      if (total + c.text.length > args.maxTotalChars && out.length > 0) break;
      out.push(c);
      total += c.text.length;
    }
  }
  return out;
}
