#!/usr/bin/env node
/** Fix notify helper calls where options object was swallowed: notify.x(helper(arg, { -> notify.x(helper(arg), { */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      files.push(...(await walk(p)));
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      files.push(p);
    }
  }
  return files;
}

const OPT_KEYS = new Set(["duration", "id", "description"]);

function fixText(text) {
  const re = /notify\.(success|error|info|warning|loading|message)\((notify[A-Za-z0-9_]+)\(/g;
  let out = "";
  let last = 0;
  let fixes = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const variant = m[1];
    const helper = m[2];
    const argsStart = m.index + m[0].length;
    let depth = 1;
    let i = argsStart;
    let splitAt = -1;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (depth === 1 && ch === "{") {
        const rest = text.slice(i);
        const optMatch = rest.match(/^\{([^}]*)\}/);
        if (optMatch) {
          const keys = optMatch[1].match(/\b(\w+)\s*:/g);
          if (keys && keys.some((k) => OPT_KEYS.has(k.replace(/\s*:/, "")))) {
            splitAt = i;
            break;
          }
        }
      }
      i++;
    }
    if (splitAt === -1) continue;
    out += text.slice(last, splitAt);
    out += ")";
    last = splitAt;
    fixes++;
  }
  out += text.slice(last);
  return { text: out, fixes };
}

const files = await walk(SRC);
let total = 0;
for (const file of files) {
  if (file.includes("notify-messages")) continue;
  let text = await readFile(file, "utf8");
  if (!text.includes("notify.") || !text.includes("(notify")) continue;
  const { text: fixed, fixes } = fixText(text);
  if (fixes > 0) {
    await writeFile(file, fixed);
    total += fixes;
    console.log(`${fixes} fixes in ${file.replace(/\\/g, "/").slice(ROOT.length + 1)}`);
  }
}
console.log(`Total fixes: ${total}`);
