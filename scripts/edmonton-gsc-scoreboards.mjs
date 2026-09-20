/**
 * 12-month GSC compare for Edmonton proof sites. Omits a site when the bundle fails.
 * Writes test-output/edmonton-gsc-scoreboards.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiBase = (process.env.NEO_PULSE_GSC_API_BASE || process.env.GSC_API_BASE || "https://neodigital.ca")
  .trim()
  .replace(/\/+$/, "");

const SITES = [
  { name: "Blind Magic", siteUrl: "https://blindmagic.com/", workPath: "/our-work/blind-magic/" },
  { name: "Phoenix Painting", siteUrl: "https://phoenixpainting.ca/", workPath: "/our-work/" },
  { name: "Heritage Dental", siteUrl: "https://heritagedentaledmonton.ca/", workPath: "/our-work/" },
  { name: "Andiamo Electric", siteUrl: "https://andiamoelectric.com/", workPath: "/our-work/" },
];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function lineFromAggregate(name, workPath, aggregatePrimary, aggregateCompare) {
  if (!aggregatePrimary || !aggregateCompare) return "";
  const clicks = `${Math.round(num(aggregateCompare.clicks)).toLocaleString("en-CA")} to ${Math.round(num(aggregatePrimary.clicks)).toLocaleString("en-CA")}`;
  const impressions = `${Math.round(num(aggregateCompare.impressions)).toLocaleString("en-CA")} to ${Math.round(num(aggregatePrimary.impressions)).toLocaleString("en-CA")}`;
  const pos = `${num(aggregateCompare.position).toFixed(1)} to ${num(aggregatePrimary.position).toFixed(1)}`;
  return `${name}: site clicks ${clicks}, impressions ${impressions}, average position ${pos}.`;
}

const ranges = trailingFullMonths(12);
const rows = [];

for (const site of SITES) {
  const res = await fetch(`${apiBase}/api/gsc/fetch-reporting-bundle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      siteUrl: site.siteUrl,
      startDate: ranges.primary.startDate,
      endDate: ranges.primary.endDate,
      compareStartDate: ranges.compare.startDate,
      compareEndDate: ranges.compare.endDate,
      rowLimit: 500,
    }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { error: "non-json" };
  }
  if (!res.ok || !data.success) {
    rows.push({
      ...site,
      ok: false,
      omitted: true,
      status: res.status,
      error: data.error || "bundle failed",
    });
    continue;
  }
  const line = lineFromAggregate(site.name, site.workPath, data.aggregatePrimary, data.aggregateCompare);
  if (!line) {
    rows.push({ ...site, ok: false, omitted: true, error: "no aggregate totals" });
    continue;
  }
  rows.push({
    ...site,
    ok: true,
    omitted: false,
    ranges,
    line,
    aggregatePrimary: data.aggregatePrimary,
    aggregateCompare: data.aggregateCompare,
  });
}

const proven = rows.filter((r) => r.ok);
const dest = join(root, "test-output", "edmonton-gsc-scoreboards.json");
mkdirSync(join(root, "test-output"), { recursive: true });
writeFileSync(dest, JSON.stringify({ ok: true, apiBase, ranges, provenCount: proven.length, rows }, null, 2), "utf8");
console.log(JSON.stringify({ dest, provenCount: proven.length, rows: rows.map((r) => ({ name: r.name, ok: r.ok, omitted: r.omitted, error: r.error || null })) }, null, 2));
