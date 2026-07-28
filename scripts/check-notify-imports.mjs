#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === "node_modules") continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const catalogDir = "src/lib/notify-messages";
const exports = new Set();
for (const f of readdirSync(catalogDir)) {
  if (!f.endsWith(".ts") || f === "index.ts") continue;
  const t = readFileSync(join(catalogDir, f), "utf8");
  for (const m of t.matchAll(/^export (?:const|function) ([A-Za-z0-9_]+)/gm)) {
    exports.add(m[1]);
  }
}

const missing = new Map();
for (const file of walk("src")) {
  const t = readFileSync(file, "utf8");
  if (!t.includes("@/lib/notify-messages")) continue;
  const importMatch = t.match(
    /import\s*\{([^}]+)\}\s*from\s*["']@\/lib\/notify-messages["']/,
  );
  if (!importMatch) continue;
  for (const part of importMatch[1].split(",")) {
    const name = part.trim().split(/\s+as\s+/)[0].trim();
    if (!name || exports.has(name)) continue;
    if (!missing.has(name)) missing.set(name, []);
    missing.get(name).push(file.replace(/\\/g, "/"));
  }
}

console.log(`Missing exports: ${missing.size}`);
for (const [name, files] of [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`${name} <- ${files[0]}`);
}
