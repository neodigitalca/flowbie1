#!/usr/bin/env node
/**
 * Scans src for notify.* calls and emits inventory JSON + markdown checklist.
 * Usage: node scripts/audit-notify-strings.mjs
 */
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const OUT_DIR = join(ROOT, "docs");

const NOTIFY_RE =
  /notify\.(success|error|info|warning|loading|message)\(\s*(['"`])((?:\\.|(?!\2)[\s\S])*?)\2/g;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      files.push(...(await walk(p)));
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      files.push(p);
    }
  }
  return files;
}

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

async function main() {
  const files = await walk(SRC);
  const inventory = [];

  for (const file of files) {
    const text = await readFile(file, "utf8");
    if (!text.includes("notify.")) continue;

    NOTIFY_RE.lastIndex = 0;
    let m;
    while ((m = NOTIFY_RE.exec(text)) !== null) {
      inventory.push({
        file: relative(ROOT, file).replace(/\\/g, "/"),
        line: lineNumber(text, m.index),
        variant: m[1],
        raw: m[3].replace(/\\(.)/g, "$1"),
      });
    }
  }

  inventory.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  await mkdir(OUT_DIR, { recursive: true });

  const jsonPath = join(OUT_DIR, "notify-inventory.json");
  await writeFile(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), count: inventory.length, items: inventory }, null, 2));

  const byFile = new Map();
  for (const item of inventory) {
    if (!byFile.has(item.file)) byFile.set(item.file, []);
    byFile.get(item.file).push(item);
  }

  let md = `# Notify inventory\n\nGenerated: ${new Date().toISOString()}\n\nTotal: **${inventory.length}** string literals\n\n`;
  for (const [file, items] of [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    md += `## ${file}\n\n`;
    for (const item of items) {
      md += `- L${item.line} \`${item.variant}\`: ${item.raw.replace(/\n/g, " ")}\n`;
    }
    md += "\n";
  }

  const mdPath = join(OUT_DIR, "notify-inventory.md");
  await writeFile(mdPath, md);

  console.log(`Wrote ${inventory.length} entries to ${jsonPath}`);
  console.log(`Wrote checklist to ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
