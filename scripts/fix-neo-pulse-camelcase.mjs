#!/usr/bin/env node
/** Fix neoPulseCamelCase identifiers broken by flowbie → neo-pulse replace. */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx"]);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (EXT.has(name.slice(name.lastIndexOf(".")))) files.push(p);
  }
  return files;
}

function fix(content) {
  return content
    .replace(/\bneo-pulse(?=[A-Z])/g, "neoPulse")
    .replace(/(window|global)\.neo-pulse/g, "$1.neoPulse");
}

let n = 0;
for (const base of [join(root, "src"), join(root, "wordpress-plugins"), join(root, "scripts")]) {
  for (const file of walk(base)) {
    const before = readFileSync(file, "utf8");
    const after = fix(before);
    if (after !== before) {
      writeFileSync(file, after, "utf8");
      n++;
    }
  }
}
console.log(`Fixed camelCase in ${n} files`);
