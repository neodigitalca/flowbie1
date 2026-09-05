#!/usr/bin/env node
/**
 * Guard prompt/content leaf modules against circular imports that cause TDZ crashes.
 * Run: npm run check:circular
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** Leaf and prompt modules that must not participate in import cycles. */
const LEAF_ENTRIES = [
  "src/lib/content-optimization/illustrative-h2.ts",
  "src/lib/content-generation/internal-link-routing-rules.ts",
  "src/lib/prompt-builders/sap-h2-constants.ts",
  "src/lib/prompt-builders/sap-checklist-pin.ts",
  "src/lib/prompt-builders/title-rules.ts",
  "src/lib/prompt-builders/sap-page-template.ts",
  "src/lib/content-word-blocklist.ts",
];

/** Forbidden edges that previously caused TDZ at runtime. */
const FORBIDDEN_EDGES = [
  ["content-word-blocklist.ts", "sap-page-template.ts"],
  ["sap-page-template.ts", "first-party-authority-prompt.ts"],
  ["internal-link-intent-match.ts", "bulk-generation-wp-inventory.ts"],
  ["first-party-authority-prompt.ts", "bulk-generation-wp-inventory.ts"],
];

function normalizePath(segment) {
  return segment.replace(/\\/g, "/");
}

function cycleTouchesForbiddenEdge(cycleLine) {
  const line = normalizePath(cycleLine);
  for (const [from, to] of FORBIDDEN_EDGES) {
    if (line.includes(from) && line.includes(to)) {
      const fromIdx = line.indexOf(from);
      const toIdx = line.indexOf(to);
      if (fromIdx >= 0 && toIdx > fromIdx) return true;
    }
  }
  return false;
}

function runMadge(args) {
  return spawnSync("npx", ["madge", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

let failed = false;
const leafCycles = [];

for (const entry of LEAF_ENTRIES) {
  const result = runMadge([entry, "--circular", "--extensions", "ts,tsx", "--ts-config", "tsconfig.json"]);
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0 && !/Found 0 circular/i.test(combined)) {
    failed = true;
    leafCycles.push({ entry, output: combined });
  } else if (/Found \d+ circular/i.test(combined) && !/Found 0 circular/i.test(combined)) {
    failed = true;
    leafCycles.push({ entry, output: combined });
  }
}

const wide = runMadge([
  "src/lib/prompt-builders",
  "src/lib/content-optimization",
  "src/lib/content-generation",
  "--circular",
  "--extensions",
  "ts,tsx",
  "--ts-config",
  "tsconfig.json",
]);

const wideOut = `${wide.stdout ?? ""}\n${wide.stderr ?? ""}`;
const forbiddenHits = wideOut
  .split("\n")
  .filter((line) => /^\d+\)/.test(line.trim()) && cycleTouchesForbiddenEdge(line));

if (leafCycles.length) {
  failed = true;
  console.error("Circular imports involving leaf/prompt modules:\n");
  for (const { entry, output } of leafCycles) {
    console.error(`--- ${entry} ---\n${output}\n`);
  }
}

if (forbiddenHits.length) {
  failed = true;
  console.error("Forbidden circular import edges detected:\n");
  for (const line of forbiddenHits) console.error(line);
}

if (failed) {
  process.exit(1);
}

console.log("Prompt/content leaf modules: no circular imports.");
if (forbiddenHits.length === 0) {
  console.log("Forbidden TDZ edges: none detected.");
}
process.exit(0);
