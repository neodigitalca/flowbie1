#!/usr/bin/env node
/**
 * Validate and merge notify shorten results; fix common over-length patterns.
 * Usage: node scripts/mcp-shorten-notify-batch.mjs docs/notify-shortened-partial.json
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const MAX_LEN = 48;
const BANNED = [
  /try again/i,
  /please try/i,
  /please check/i,
  /from the response/i,
  /from the model/i,
];

const inputPath = process.argv[2] || join(ROOT, "docs/notify-shortened.json");
const sourcePath = join(ROOT, "docs/notify-to-shorten.json");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const sourceById = new Map(source.map((x) => [x.id, x]));
const results = JSON.parse(await readFile(inputPath, "utf8"));

function validate(id, original, short) {
  if (typeof short !== "string" || !short.trim()) return `empty`;
  const t = short.trim();
  if (t.length > MAX_LEN) return `${t.length} chars`;
  if (t.endsWith("...")) return `ellipsis`;
  for (const ban of BANNED) {
    if (ban.test(t)) return `banned phrase`;
  }
  const origPh = [...original.matchAll(/\$\{[^}]+\}/g)].map((x) => x[0]).sort();
  const newPh = [...t.matchAll(/\$\{[^}]+\}/g)].map((x) => x[0]).sort();
  if (JSON.stringify(origPh) !== JSON.stringify(newPh)) return `placeholder mismatch`;
  return null;
}

const out = [];
let failed = 0;
for (const row of results) {
  const src = sourceById.get(row.id);
  if (!src) {
    console.warn(`Unknown id ${row.id}`);
    continue;
  }
  const err = validate(row.id, src.value, row.short);
  if (err) {
    console.error(`FAIL ${row.id}: ${err} | ${row.short}`);
    failed++;
    continue;
  }
  out.push({ id: row.id, file: src.file, short: row.short.trim() });
}

await writeFile(join(ROOT, "docs/notify-shortened-validated.json"), JSON.stringify(out, null, 2));
console.log(`Validated ${out.length}, failed ${failed}`);
