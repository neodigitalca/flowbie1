#!/usr/bin/env node
/**
 * Apply shorten results from docs/notify-shortened.json
 * Usage: node scripts/apply-notify-shortened.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const NOTIFY_DIR = join(ROOT, "src/lib/notify-messages");
const input = JSON.parse(await readFile(join(ROOT, "docs/notify-shortened.json"), "utf8"));

function escapeForTs(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

const byFile = new Map();
for (const { id, file, short } of input) {
  const path = join(NOTIFY_DIR, file);
  if (!byFile.has(path)) byFile.set(path, []);
  byFile.get(path).push([id, short]);
}

for (const [filePath, replacements] of byFile) {
  let source = await readFile(filePath, "utf8");
  for (const [id, short] of replacements) {
    const re = new RegExp(`(export const ${id} = ")(?:[^"\\\\]|\\\\.)*(";)`);
    source = source.replace(re, `$1${escapeForTs(short)}$2`);
  }
  await writeFile(filePath, source);
  console.log(`Updated ${replacements.length} in ${filePath}`);
}

console.log(`Applied ${input.length} replacements`);
