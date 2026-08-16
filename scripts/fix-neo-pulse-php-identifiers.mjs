#!/usr/bin/env node
/** Fix invalid PHP identifiers after flowbie → neo-pulse bulk replace. */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "wordpress-plugins");

const FIXES = [
  [/\$neo-pulse/g, "$neo_pulse"],
  [/\bfunction neo-pulse_/g, "function neo_pulse_"],
  [/self::neo-pulse_/g, "self::neo_pulse_"],
  [/::neo-pulse_/g, "::neo_pulse_"],
  [/\bNEO_PULSE_/g, "NEO_PULSE_"],
  [/%%NEO_PULSE_/g, "%%NEO_PULSE_"],
  [/<!--NEO_PULSE_/g, "<!--NEO_PULSE_"],
  [/HTTP_X_NEO_PULSE_/g, "HTTP_X_NEO_PULSE_"],
  [/WALK_MODE_MIGRATE_TO_FLOWBIE/g, "WALK_MODE_MIGRATE_TO_NEO_PULSE"],
  [/migrate_to_neo-pulse/g, "migrate_to_neo_pulse"],
  [/ACTION_EXPORT_FLO_SHEET/g, "ACTION_EXPORT_NEO_PULSE_SHEET"],
  [/ACTION_IMPORT_FLO_SHEET/g, "ACTION_IMPORT_NEO_PULSE_SHEET"],
  [/handle_export_flo_sheet/g, "handle_export_neo_pulse_sheet"],
  [/handle_import_flo_sheet/g, "handle_import_neo_pulse_sheet"],
  [/export_flo_sheet/g, "export_neo_pulse_sheet"],
  [/import_flo_sheet/g, "import_neo_pulse_sheet"],
  [/class-neo-pulse-wp-flo-sheet/g, "class-neo-pulse-wp-neo-pulse-sheet"],
  [/Neo_Pulse_Wp_Flo_Sheet/g, "Neo_Pulse_Wp_Neo_Pulse_Sheet"],
  [/QUERY_FLAG\s*=\s*'neo-pulse_welcome'/g, "QUERY_FLAG       = 'neo_pulse_welcome'"],
  [/neo-pulse_deactivated/g, "neo_pulse_deactivated"],
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (p.endsWith(".php")) files.push(p);
  }
  return files;
}

let changed = 0;
for (const file of walk(root)) {
  const before = readFileSync(file, "utf8");
  let after = before;
  for (const [re, rep] of FIXES) after = after.replace(re, rep);
  if (after !== before) {
    writeFileSync(file, after, "utf8");
    changed++;
  }
}
console.log(`Fixed ${changed} PHP files`);
