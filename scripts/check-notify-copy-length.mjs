#!/usr/bin/env node
/**
 * Lint notify-messages catalog: max length + banned verbose phrases.
 * Usage: node scripts/check-notify-copy-length.mjs
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const NOTIFY_DIR = join(ROOT, "src/lib/notify-messages");
const MAX_LEN = 48;

const BANNED = [
  /try again/i,
  /please try/i,
  /please check/i,
  /from the response/i,
  /from the model/i,
];

function extractConstants(source) {
  const items = [];
  const re = /export const (NOTIFY_\w+) = "((?:[^"\\]|\\.)*)";/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    items.push({
      name: m[1],
      value: m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
    });
  }
  return items;
}

const files = (await readdir(NOTIFY_DIR)).filter((f) => f.endsWith(".ts") && f !== "index.ts");
let violations = 0;

for (const file of files) {
  const path = join(NOTIFY_DIR, file);
  const source = await readFile(path, "utf8");
  for (const { name, value } of extractConstants(source)) {
    if (value.length > MAX_LEN) {
      console.log(`LENGTH ${value.length}>${MAX_LEN} ${file} ${name}: ${value.slice(0, 60)}`);
      violations++;
    }
    if (value.endsWith("...")) {
      console.log(`ELLIPSIS ${file} ${name}`);
      violations++;
    }
    if (/^\d+\/\d+:/.test(value) || /^Step \d/i.test(value)) {
      console.log(`STEP_PREFIX ${file} ${name}`);
      violations++;
    }
    for (const ban of BANNED) {
      if (ban.test(value)) {
        console.log(`BANNED ${file} ${name}: ${value.slice(0, 60)}`);
        violations++;
        break;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} violation(s)`);
  process.exit(1);
}

console.log(`OK: all notify constants ≤${MAX_LEN} chars, no banned phrases`);
