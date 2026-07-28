#!/usr/bin/env node
/** Balance parens on notify(helper(...)) calls; fix double-close before options. */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const NOTIFY_RE = /notify\.(success|error|info|warning|loading|message)\(/;

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
  const m = line.match(NOTIFY_RE);
  if (!m) return line;

  // Fix double-close before options: `}), { duration: 3000 }));` -> `}), { duration: 3000 });`
  let out = line.replace(/\),\s*(\{[^}]*\})\s*\)\);(\s*)$/, "), $1);$2");

  const idx = out.indexOf(m[0]);
  const start = idx + m[0].length;
  let depth = 1;
  let i = start;
  while (i < out.length && depth > 0) {
    const ch = out[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    i++;
  }

  if (depth === 0) return out;

  // Missing closing paren(s) before semicolon or before `, {`
  if (depth === 1) {
    const semi = out.indexOf(";", start);
    const opt = out.indexOf(", {", start);
    const insertAt =
      opt !== -1 && (semi === -1 || opt < semi) ? opt : semi !== -1 ? semi : out.length;
    if (insertAt !== -1) {
      out = out.slice(0, insertAt) + ")" + out.slice(insertAt);
    }
  }
  return out;
}

const files = await walk(join(ROOT, "src"));
let count = 0;
for (const file of files) {
  if (file.includes("notify-messages")) continue;
  const text = await readFile(file, "utf8");
  const lines = text.split("\n");
  let changed = false;
  const fixed = lines.map((line) => {
    if (!NOTIFY_RE.test(line) || !line.includes("(notify")) return line;
    const n = fixLine(line);
    if (n !== line) changed = true;
    return n;
  });
  if (changed) {
    await writeFile(file, fixed.join("\n"));
    count++;
    console.log(file.replace(/\\/g, "/").slice(ROOT.length + 1));
  }
}
console.log(`Fixed ${count} files`);
