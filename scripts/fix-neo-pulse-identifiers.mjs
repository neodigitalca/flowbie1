#!/usr/bin/env node
/** Fix "NEO Pulse" accidentally inserted into code identifiers. */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const TARGETS = [
  join(root, "wordpress-plugins"),
  join(root, "src"),
  join(root, "scripts"),
];

const EXT = new Set([".js", ".mjs", ".cjs", ".php", ".ts", ".tsx"]);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else {
      const ext = name.slice(name.lastIndexOf("."));
      if (EXT.has(ext)) files.push(p);
    }
  }
  return files;
}

function fixIdentifiers(content) {
  let out = content;
  out = out.replace(/NEO Pulse(?=[A-Za-z_])/g, "NeoPulse");
  out = out.replace(/Source_Neo_Pulse_/g, "Source_Neo_Pulse_");
  out = out.replace(/Neo_Pulse_Native/g, "Neo_Pulse_Native");
  out = out.replace(/NeoPulseWpSecrets/g, "NeoPulseWpSecrets");
  out = out.replace(/NEO_PULSE_/g, "NEO_PULSE_");
  out = out.replace(/<<<NEO_PULSE_/g, "<<<NEO_PULSE_");
  out = out.replace(/<<<END_NEO_PULSE_/g, "<<<END_NEO_PULSE_");
  return out;
}

let changed = 0;
for (const base of TARGETS) {
  for (const file of walk(base)) {
    const before = readFileSync(file, "utf8");
    const after = fixIdentifiers(before);
    if (after !== before) {
      writeFileSync(file, after, "utf8");
      changed++;
    }
  }
}
console.log(`Fixed identifiers in ${changed} files`);
