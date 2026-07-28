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

function fixText(text) {
  let fixes = 0;
  let out = text;
  const patterns = [
    [/, \)(\s*\{ duration)/g, ")$1"],
    [/, \)(\s*\{ id)/g, ")$1"],
    [/, \)(\s*\{\s*\n\s*duration)/g, ")$1"],
    [/, \)(\s*\{\s*\n\s*id)/g, ")$1"],
  ];
  for (const [re, rep] of patterns) {
    const next = out.replace(re, (...args) => {
      if (args[0].includes("notify")) {
        fixes++;
        return rep.replace("$1", args[1]);
      }
      return args[0];
    });
    out = next;
  }
  // Global safe replace when line contains notify helper
  out = out
    .split("\n")
    .map((line) => {
      if (!line.includes("(notify") || !line.includes(", )")) return line;
      const n = line.replace(/, \)(\s*\{)/g, ")$1");
      if (n !== line) fixes++;
      return n;
    })
    .join("\n");
  return { text: out, fixes };
}

const files = await walk(join(ROOT, "src"));
let total = 0;
for (const file of files) {
  if (file.includes("notify-messages")) continue;
  const text = await readFile(file, "utf8");
  if (!text.includes(", )")) continue;
  const { text: fixed, fixes } = fixText(text);
  if (fixes) {
    await writeFile(file, fixed);
    total += fixes;
    console.log(fixes, file.replace(/\\/g, "/").slice(ROOT.length + 1));
  }
}
console.log(`Total: ${total}`);
