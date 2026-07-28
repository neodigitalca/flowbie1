import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import { stripGeoTokensForContentBlogPhrase } from "@/lib/content-blog-geo-strip";

function stripPipeCell(raw: string): string {
  return raw
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

/** H3 under Traffic & Intent Gaps. */
const CONTENT_OPPORTUNITY_MATRIX_H3 = /###[^\n]*Content Opportunity Matrix[^\n]*/i;

/** Matches bulk content CSV column count; used to synthesize M1–M3 labels (avoid importing competitor-bulk-content-csv). */
const MATRIX_ROWS_PER_PLAN_MONTH = 3;

function isBulkTemplateMatrixHeader(headerCells: string[]): boolean {
  const norm = headerCells.map(normalizeHeaderCell);
  const has = (name: string) => norm.some((n) => n === name);
  const hasFeatured =
    norm.some((n) => n === "featuredimage" || n.replace(/\s/g, "") === "featuredimage") ||
    norm.some((n) => n.includes("featured") && n.includes("image"));
  return (
    has("keyword") &&
    has("entity") &&
    has("title") &&
    has("modifier") &&
    hasFeatured
  );
}

function findBulkColumnIndex(headerCells: string[], name: string): number {
  const want = name.toLowerCase();
  return headerCells.findIndex((h) => normalizeHeaderCell(h) === want);
}

function findFeaturedImageBulkColumnIndex(headerCells: string[]): number {
  return headerCells.findIndex((h) => {
    const n = normalizeHeaderCell(h);
    const compact = n.replace(/\s/g, "");
    return compact === "featuredimage" || (n.includes("featured") && n.includes("image"));
  });
}

function findContentOpportunityMatrixSection(md: string): string {
  const text = md.replace(/\r\n/g, "\n");
  const m = CONTENT_OPPORTUNITY_MATRIX_H3.exec(text);
  if (!m) return "";
  const after = text.slice(m.index + m[0].length);
  const nextH2 = after.search(/\n##\s+/);
  return nextH2 >= 0 ? after.slice(0, nextH2) : after;
}

function parsePipeRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return [];
  const inner = trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => stripPipeCell(c));
  return inner;
}

function isPipeSeparatorRow(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith("|")) return false;
  return /^\|[\s\-:|]+\|\s*$/.test(t) || t.includes("---");
}

function normalizeHeaderCell(c: string): string {
  return stripPipeCell(c)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findAnchorDemandColumnIndex(headerCells: string[]): number {
  const idx = headerCells.findIndex((h) => {
    const n = normalizeHeaderCell(h);
    return n.includes("anchor") && n.includes("demand");
  });
  if (idx >= 0) return idx;
  /** Default 4-column matrix: Month | What to Produce | Anchor Demand | Why This Wins (legacy: Priority …) */
  if (headerCells.length >= 4) return 2;
  return -1;
}

function findMonthColumnIndex(headerCells: string[]): number {
  const idx = headerCells.findIndex((h) => {
    const n = normalizeHeaderCell(h);
    return n === "month" || n.startsWith("month ");
  });
  if (idx >= 0) return idx;
  if (headerCells.length >= 4) return 0;
  return -1;
}

function findWhatToProduceColumnIndex(headerCells: string[]): number {
  const idx = headerCells.findIndex((h) => {
    const n = normalizeHeaderCell(h);
    return n.includes("what") && n.includes("produce");
  });
  if (idx >= 0) return idx;
  /** Default 4-column matrix */
  if (headerCells.length >= 4) return 1;
  return -1;
}

function findWhyColumnIndex(headerCells: string[]): number {
  const idx = headerCells.findIndex((h) => {
    const n = normalizeHeaderCell(h);
    return n.includes("why");
  });
  if (idx >= 0) return idx;
  if (headerCells.length >= 4) return 3;
  return -1;
}

/** One row from the Content Opportunity Matrix (M1–M3 calendar), in document order - no deduplication. */
export type ContentOpportunityMatrixRow = {
  month: string;
  whatToProduce: string;
  /** Bulk-layout matrices: same text as the keyword column; legacy: Anchor Demand cell. */
  anchorDemand: string;
  why: string;
  /** Set when the table uses bulk CSV columns (keyword|entity|title|modifier|featuredImage). */
  entity?: string;
  modifier?: string;
  featuredImage?: string;
};

/** Split one matrix cell into phrases (comma / semicolon lists). */
function splitAnchorDemandCell(raw: string): string[] {
  const main = stripPipeCell(raw);
  if (!main) return [];
  return main
    .split(/[,;](?=\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Pulls keyword phrases from the **Content Opportunity Matrix** pipe table
 * (`### **Content Opportunity Matrix**` under Traffic & Intent Gaps): **keyword** column (bulk layout)
 * or **Anchor Demand** column (legacy).
 */
export function extractAnchorDemandPhrasesFromContentOpportunityMatrixMarkdown(md: string): string[] {
  const section = findContentOpportunityMatrixSection(md);
  if (!section.trim()) return [];

  const lines = section.split("\n");
  const pipeLines = lines.map((l) => l.trim()).filter((l) => l.startsWith("|"));
  let i = 0;
  while (i < pipeLines.length && isPipeSeparatorRow(pipeLines[i])) i++;
  if (i >= pipeLines.length) return [];

  const headerCells = parsePipeRow(pipeLines[i]);
  const bulk = isBulkTemplateMatrixHeader(headerCells);
  const anchorIdx = bulk
    ? findBulkColumnIndex(headerCells, "keyword")
    : findAnchorDemandColumnIndex(headerCells);
  if (anchorIdx < 0 || anchorIdx >= headerCells.length) return [];

  i++;
  while (i < pipeLines.length && isPipeSeparatorRow(pipeLines[i])) i++;

  const out: string[] = [];
  const seen = new Set<string>();

  while (i < pipeLines.length) {
    if (isPipeSeparatorRow(pipeLines[i])) {
      i++;
      continue;
    }
    const cells = parsePipeRow(pipeLines[i]);
    if (cells.length <= anchorIdx) {
      i++;
      continue;
    }
    const raw = cells[anchorIdx];
    for (const phrase of splitAnchorDemandCell(raw)) {
      const key = phrase.toLowerCase();
      if (!phrase || seen.has(key)) continue;
      seen.add(key);
      out.push(phrase.replace(/\\/g, "").trim());
    }
    i++;
  }

  return out;
}

function extractBulkLayoutMatrixRows(headerCells: string[], pipeLines: string[], headerLineIndex: number): ContentOpportunityMatrixRow[] {
  const kwIdx = findBulkColumnIndex(headerCells, "keyword");
  const entIdx = findBulkColumnIndex(headerCells, "entity");
  const titleIdx = findBulkColumnIndex(headerCells, "title");
  const modIdx = findBulkColumnIndex(headerCells, "modifier");
  const fiIdx = findFeaturedImageBulkColumnIndex(headerCells);
  if (kwIdx < 0 || entIdx < 0 || titleIdx < 0 || modIdx < 0 || fiIdx < 0) return [];

  let i = headerLineIndex + 1;
  while (i < pipeLines.length && isPipeSeparatorRow(pipeLines[i])) i++;

  const out: ContentOpportunityMatrixRow[] = [];
  let rowOrdinal = 0;

  while (i < pipeLines.length) {
    if (isPipeSeparatorRow(pipeLines[i])) {
      i++;
      continue;
    }
    const cells = parsePipeRow(pipeLines[i]);
    const title = stripPipeCell(cells[titleIdx] ?? "").replace(/\\/g, "").trim();
    if (!title) {
      i++;
      continue;
    }
    const keyword = stripPipeCell(cells[kwIdx] ?? "").replace(/\\/g, "").trim();
    const entity = stripPipeCell(cells[entIdx] ?? "").replace(/\\/g, "").trim();
    const modifier = stripPipeCell(cells[modIdx] ?? "").replace(/\\/g, "").trim();
    const featuredImage = stripPipeCell(cells[fiIdx] ?? "").replace(/\\/g, "").trim();
    const monthN = Math.floor(rowOrdinal / MATRIX_ROWS_PER_PLAN_MONTH) + 1;
    const month = `M${monthN}`;
    rowOrdinal++;
    out.push({
      month,
      whatToProduce: title,
      anchorDemand: keyword,
      why: "",
      entity,
      modifier,
      featuredImage,
    });
    i++;
  }

  return out;
}

/**
 * Full Content Opportunity Matrix rows in document order (same as M1–M3 table rows).
 * Legacy: **What to Produce** / **Anchor Demand**. Bulk layout: keyword|entity|title|modifier|featuredImage
 * (whatToProduce ← title, anchorDemand ← keyword; month synthesized as M1–M3).
 */
export function extractContentOpportunityMatrixRows(md: string): ContentOpportunityMatrixRow[] {
  const section = findContentOpportunityMatrixSection(md);
  if (!section.trim()) return [];

  const lines = section.split("\n");
  const pipeLines = lines.map((l) => l.trim()).filter((l) => l.startsWith("|"));
  let i = 0;
  while (i < pipeLines.length && isPipeSeparatorRow(pipeLines[i])) i++;
  if (i >= pipeLines.length) return [];

  const headerCells = parsePipeRow(pipeLines[i]);
  if (isBulkTemplateMatrixHeader(headerCells)) {
    return extractBulkLayoutMatrixRows(headerCells, pipeLines, i);
  }

  const monthIdx = findMonthColumnIndex(headerCells);
  const whatIdx = findWhatToProduceColumnIndex(headerCells);
  const anchorIdx = findAnchorDemandColumnIndex(headerCells);
  const whyIdx = findWhyColumnIndex(headerCells);
  if (whatIdx < 0 || whatIdx >= headerCells.length) return [];

  i++;
  while (i < pipeLines.length && isPipeSeparatorRow(pipeLines[i])) i++;

  const out: ContentOpportunityMatrixRow[] = [];

  while (i < pipeLines.length) {
    if (isPipeSeparatorRow(pipeLines[i])) {
      i++;
      continue;
    }
    const cells = parsePipeRow(pipeLines[i]);
    if (cells.length <= whatIdx) {
      i++;
      continue;
    }
    const what = stripPipeCell(cells[whatIdx] ?? "").replace(/\\/g, "").trim();
    if (!what) {
      i++;
      continue;
    }
    const month = monthIdx >= 0 && monthIdx < cells.length ? stripPipeCell(cells[monthIdx] ?? "").trim() : "";
    const anchor =
      anchorIdx >= 0 && anchorIdx < cells.length ? stripPipeCell(cells[anchorIdx] ?? "").replace(/\\/g, "").trim() : "";
    const why = whyIdx >= 0 && whyIdx < cells.length ? stripPipeCell(cells[whyIdx] ?? "").replace(/\\/g, "").trim() : "";
    out.push({ month, whatToProduce: what, anchorDemand: anchor, why });
    i++;
  }

  return out;
}

/**
 * Succinct SAP keyword string from a matrix row: first **anchorDemand** segment (bulk: keyword column), else **whatToProduce**,
 * aligned with bulk competitor CSV keyword derivation (geo-stripped, normalized spacing).
 */
export function sapKeywordStringFromMatrixRow(row: ContentOpportunityMatrixRow): string {
  const anchorFirst = row.anchorDemand.split(/[,;]/)[0]?.trim() ?? "";
  const base = anchorFirst.length > 0 ? anchorFirst : row.whatToProduce.trim();
  if (!base) return "";
  const withoutGeo = stripGeoTokensForContentBlogPhrase(base);
  const use = withoutGeo.length > 0 ? withoutGeo : base;
  return use.replace(/\s+/g, " ").trim().toLowerCase();
}

/** First match wins (lowest index): canonical **Keywords They Own**, then legacy headings. */
const KEYWORD_SECTION_PATTERNS: RegExp[] = [
  /##\s+\*\*Keywords They Own\*\*[^\n]*/i,
  /##\s+Keywords They Own[^\n]*/i,
  /##\s+\*\*Non-brand organic keywords \(Semrush\)\*\*[^\n]*/i,
  /##\s+Non-brand organic keywords \(Semrush\)[^\n]*/i,
  /##\s+Target competitor keywords[^\n]*/i,
];

function findFirstKeywordSectionMatch(text: string): { index: number; length: number } | null {
  let best: { index: number; length: number } | null = null;
  for (const re of KEYWORD_SECTION_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    if (!best || m.index < best.index) {
      best = { index: m.index, length: m[0].length };
    }
  }
  return best;
}

/** First label of hostname (brand-ish slug), e.g. wildernesstimes.com → wildernesstimes */
function domainBrandSlug(domain: string): string {
  const host = normalizeCompetitorDomainKey(domain);
  if (!host) return "";
  return host.split(".")[0] ?? "";
}

/**
 * Pulls keyword phrases from Markdown tables under the competitor-keyword H2:
 * `## **Keywords They Own**` (Semrush appendix: domain metrics + organic keyword tables), legacy
 * `## **Non-brand organic keywords (Semrush)**`, or `## Target competitor keywords…`.
 * Only rows under a `| Keyword phrase | …` table header are collected (skips Semrush domain metrics).
 */
export function extractKeywordPhrasesFromCompetitorReportMarkdown(md: string): string[] {
  const text = (md || "").replace(/\r\n/g, "\n");
  const m = findFirstKeywordSectionMatch(text);
  if (!m) return [];
  const start = m.index + m.length;
  const rest = text.slice(start);
  const nextH2 = rest.search(/\n##\s+/);
  const section = nextH2 >= 0 ? rest.slice(0, nextH2) : rest;

  const out: string[] = [];
  const seen = new Set<string>();
  let inKeywordPhraseTable = false;

  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/^\|[\s\-:|]+\|\s*$/.test(trimmed) || trimmed.includes("---")) continue;

    const inner = trimmed
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => stripPipeCell(c));
    if (inner.length < 2) continue;

    const firstRaw = inner[0] ?? "";
    const first = firstRaw.replace(/\*\*/g, "").trim();
    if (!first) continue;

    if (!inKeywordPhraseTable) {
      if (/^keyword(\s+phrase)?$/i.test(first)) {
        inKeywordPhraseTable = true;
      }
      continue;
    }

    if (/^keyword(\s+phrase)?$/i.test(first)) continue;
    if (/^volume$/i.test((inner[1] ?? "").replace(/\*\*/g, "").trim())) continue;

    const phrase = firstRaw.replace(/\\/g, "").trim();
    if (!phrase) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
  }

  return out;
}

/**
 * Drops navigational / brand-only queries (seed site + competitor domain brands).
 * Keeps topical queries like "strohboid pavilion" or "tent rental fredericton".
 */
export function filterNonBrandedAttackKeywords(
  phrases: string[],
  siteName: string,
  seedDomain: string | undefined,
  competitorDomains: string[],
): string[] {
  const siteWords = siteName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const seedSlug = seedDomain ? domainBrandSlug(seedDomain) : "";
  const seedSlugNoHyphen = seedSlug.replace(/-/g, "");

  const competitorSlugs = competitorDomains
    .map((d) => domainBrandSlug(d))
    .filter(Boolean)
    .map((s) => s.toLowerCase());

  const siteLower = siteName.trim().toLowerCase();

  return phrases.filter((raw) => {
    const p = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (p.length < 2) return false;

    if (siteLower && p === siteLower) return false;

    if (seedSlug && (p === seedSlug.toLowerCase() || p === seedSlugNoHyphen.toLowerCase())) return false;

    for (const slug of competitorSlugs) {
      if (!slug) continue;
      const spaced = slug.replace(/-/g, " ");
      if (p === slug || p === spaced) return false;
    }

    const words = p.split(/\s+/);
    if (words.length === 1) {
      const w = words[0];
      if (siteWords.includes(w)) return false;
      if (seedSlug && (w === seedSlug.toLowerCase() || w === seedSlugNoHyphen.toLowerCase())) return false;
      if (competitorSlugs.some((s) => w === s || w === s.replace(/-/g, ""))) return false;
    }

    if (siteWords.length >= 1 && words.length <= siteWords.length + 1) {
      const allFromSite = words.every((w) => siteWords.includes(w));
      if (allFromSite && words.length <= siteWords.length) return false;
    }

    if (siteWords.length >= 2 && words.length <= siteWords.length) {
      const allFromSite = words.every((w) => siteWords.includes(w));
      if (allFromSite) return false;
    }

    return true;
  });
}
