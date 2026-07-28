#!/usr/bin/env node
/** Remove duplicate export definitions; keep first by module order in index.ts. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/lib/notify-messages");
const MODULE_ORDER = [
  "core-helpers.ts",
  "core.ts",
  "content-generation.ts",
  "content-optimization.ts",
  "wordpress.ts",
  "research.ts",
  "generator.ts",
  "dashboard.ts",
];

const FN_RE = /^export function (notify\w+)\(/gm;
const CONST_RE = /^export const (NOTIFY_\w+) =/gm;

function extractBlocks(text, re) {
  const blocks = [];
  let m;
  const regex = new RegExp(re.source, re.flags);
  while ((m = regex.exec(text)) !== null) {
    const name = m[1];
    const start = m.index;
    let end = start;
    if (re === CONST_RE) {
      const lineEnd = text.indexOf("\n", start);
      end = lineEnd === -1 ? text.length : lineEnd;
    } else {
      let depth = 0;
      let i = start;
      let started = false;
      for (; i < text.length; i++) {
        const ch = text[i];
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") {
          depth--;
          if (started && depth === 0) {
            i++;
            break;
          }
        }
      }
      end = i;
    }
    blocks.push({ name, start, end });
  }
  return blocks;
}

const seen = new Set();
let totalRemoved = 0;

for (const file of MODULE_ORDER) {
  const path = join(ROOT, file);
  let text = await readFile(path, "utf8");
  const blocks = [...extractBlocks(text, FN_RE), ...extractBlocks(text, CONST_RE)];
  const toRemove = [];

  for (const block of blocks) {
    if (seen.has(block.name)) {
      toRemove.push(block);
      totalRemoved++;
      console.log(`Removed duplicate ${block.name} from ${file}`);
    } else {
      seen.add(block.name);
    }
  }

  if (toRemove.length === 0) continue;

  toRemove.sort((a, b) => b.start - a.start);
  for (const block of toRemove) {
    let start = block.start;
    while (start > 0 && (text[start - 1] === "\n" || text[start - 1] === "\r")) start--;
    text = text.slice(0, start) + text.slice(block.end);
  }

  text = text.replace(/\n{3,}/g, "\n\n");
  await writeFile(path, text);
}

console.log(`Total duplicates removed: ${totalRemoved}`);
