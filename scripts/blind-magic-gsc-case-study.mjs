/**
 * Blind Magic GSC m12 compare for the Our Work case study.
 * POST /api/gsc/fetch-reporting-bundle, join queries, print showcase rows.
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const argSite = process.argv.find((a) => a.startsWith("--site="));
const SITE_URL = argSite ? argSite.slice("--site=".length) : "https://blindmagic.com/";
const SITE_NAME = process.argv.find((a) => a.startsWith("--name="))?.slice("--name=".length) || "Blind Magic Window Coverings";
const MIN_IMPRESSIONS = 80;
const MIN_CLICKS = 1;
const SHOWCASE_LIMIT = 10;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiBase = (process.env.NEO_PULSE_GSC_API_BASE || process.env.GSC_API_BASE || "http://localhost:8080")
  .trim()
  .replace(/\/+$/, "");

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Last N full months vs the N full months before (gsc-fetch-date-presets). */
function trailingFullMonths(monthCount, reference = new Date()) {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  const primaryEnd = new Date(y, m, 0);
  const primaryStart = new Date(primaryEnd.getFullYear(), primaryEnd.getMonth() - (monthCount - 1), 1);
  const compareEnd = new Date(primaryStart.getFullYear(), primaryStart.getMonth(), 0);
  const compareStart = new Date(compareEnd.getFullYear(), compareEnd.getMonth() - (monthCount - 1), 1);
  return {
    primary: { startDate: ymd(primaryStart), endDate: ymd(primaryEnd) },
    compare: { startDate: ymd(compareStart), endDate: ymd(compareEnd) },
  };
}

const STOP = new Set(["and", "the", "of", "in", "a", "an", "for", "to", "at", "by"]);

function brandPhrases(name) {
  const norm = name.replace(/&/g, " and ").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const out = new Set([norm]);
  const words = norm.split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  for (let i = 0; i < words.length; i++) {
    for (let len = 2; len <= Math.min(5, words.length - i); len++) {
      out.add(words.slice(i, i + len).join(" "));
    }
  }
  return [...out].filter((p) => p.split(/\s+/).length >= 2);
}

function isBrand(query, phrases) {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  return phrases.some((p) => p.length >= 4 && q.includes(p));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const ranges = trailingFullMonths(12);
const phrases = brandPhrases(SITE_NAME);

const res = await fetch(`${apiBase}/api/gsc/fetch-reporting-bundle`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    siteUrl: SITE_URL,
    startDate: ranges.primary.startDate,
    endDate: ranges.primary.endDate,
    compareStartDate: ranges.compare.startDate,
    compareEndDate: ranges.compare.endDate,
    rowLimit: 10000,
  }),
});
const data = await res.json();
if (!res.ok || !data.success) {
  console.error(JSON.stringify({ ok: false, status: res.status, error: data.error || data, ranges }, null, 2));
  process.exit(1);
}

const primary = Array.isArray(data.queries) ? data.queries : [];
const compare = Array.isArray(data.compareQueries) ? data.compareQueries : [];
if (primary.length === 0 && compare.length === 0) {
  console.error(JSON.stringify({ ok: false, error: "No GSC queries for either period", ranges }, null, 2));
  process.exit(1);
}

const byQuery = new Map();
for (const r of primary) {
  const k = String(r.query ?? "").trim();
  if (k) byQuery.set(k, { ...(byQuery.get(k) ?? {}), p: r });
}
for (const r of compare) {
  const k = String(r.query ?? "").trim();
  if (k) byQuery.set(k, { ...(byQuery.get(k) ?? {}), c: r });
}

const showcase = [];
const newPage1 = [];
for (const [query, pair] of byQuery) {
  if (isBrand(query, phrases)) continue;
  const pPos = pair.p ? num(pair.p.position) : null;
  const cPos = pair.c ? num(pair.c.position) : null;
  const pClicks = pair.p ? num(pair.p.clicks) : 0;
  const cClicks = pair.c ? num(pair.c.clicks) : 0;
  const pImp = pair.p ? num(pair.p.impressions) : 0;
  const cImp = pair.c ? num(pair.c.impressions) : 0;
  if (pair.p && !pair.c && pPos != null && pPos <= 10 && pImp >= MIN_IMPRESSIONS && pClicks >= MIN_CLICKS) {
    newPage1.push({ query, kind: "new_top10", oldPosition: null, newPosition: pPos, positionGain: null, oldClicks: 0, newClicks: pClicks, oldImpressions: 0, newImpressions: pImp });
    continue;
  }
  if (!pair.p || !pair.c || pPos == null || cPos == null) continue;
  if (pImp < MIN_IMPRESSIONS) continue;
  if (pClicks < MIN_CLICKS) continue;
  const positionGain = cPos - pPos;
  const enteredTop10 = cPos > 10 && pPos <= 10;
  if (positionGain < 5 && !enteredTop10) continue;
  showcase.push({ query, kind: enteredTop10 ? "entered_top10" : "position_gain", oldPosition: cPos, newPosition: pPos, positionGain, oldClicks: cClicks, newClicks: pClicks, oldImpressions: cImp, newImpressions: pImp });
}

showcase.sort((a, b) => (b.positionGain ?? 0) - (a.positionGain ?? 0) || b.newClicks - a.newClicks);
newPage1.sort((a, b) => a.newPosition - b.newPosition || b.newClicks - a.newClicks);
const allQualifying = [...showcase, ...newPage1];
const picks = allQualifying.slice(0, SHOWCASE_LIMIT);
const byClicks = [...allQualifying].sort((a, b) => b.newClicks - a.newClicks || (b.positionGain ?? 0) - (a.positionGain ?? 0)).slice(0, 15);
const local = allQualifying.filter((r) => /edmonton|sherwood|st\.?\s*albert|spruce grove|lethbridge|calgary/i.test(r.query));

const out = {
  ok: true,
  siteUrl: SITE_URL,
  ranges,
  totals: {
    primaryQueries: primary.length,
    compareQueries: compare.length,
    aggregatePrimary: data.aggregatePrimary ?? null,
    aggregateCompare: data.aggregateCompare ?? null,
  },
    showcase: picks,
    byClicks,
    local,
    qualifyingCount: allQualifying.length,
  };

const outPath = join(root, "test-output", "blind-magic-gsc-case-study.json");
writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(JSON.stringify(out, null, 2));
console.error(`wrote ${outPath}`);
