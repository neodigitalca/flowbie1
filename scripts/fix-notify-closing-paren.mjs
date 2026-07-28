#!/usr/bin/env node
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      files.push(...(await walk(p)));
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p);
  }
  return files;
}

function fixLine(line) {
  if (!/notify\.(success|error|info|warning|message|loading)\(notify/.test(line)) return line;
  if (line.includes("), {")) return line;
  const trimmed = line.trimEnd();
  if (trimmed.endsWith("));")) return line;
  if (trimmed.endsWith(");")) {
    return line.replace(/\);(\s*)$/, "));$1");
  }
  return line;
}

const files = await walk(join(ROOT, "src"));
let total = 0;
for (const file of files) {
  if (file.includes("notify-messages")) continue;
  const text = await readFile(file, "utf8");
  const lines = text.split("\n");
  let changed = false;
  const fixed = lines.map((line) => {
    const n = fixLine(line);
    if (n !== line) changed = true;
    return n;
  });
  if (changed) {
    await writeFile(file, fixed.join("\n"));
    total++;
  }
}
console.log(`Fixed ${total} files`);
