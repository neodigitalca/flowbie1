#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const inventory = JSON.parse(await readFile(join(ROOT, "docs/notify-inventory.json"), "utf8"));

function pickMod(file) {
  if (/PostPagePackGenerator|wordpress\/PostPage/.test(file)) return "wordpress";
  if (/overview|research|competitor|proposal|sitemap|vertical-benchmark/.test(file)) return "research";
  if (/content-optimization|bulk-seo/.test(file)) return "content-optimization";
  if (/EntityGeneration|BlogTemplate|keyword-research|bulk|quarter-gap|competitor-bulk|prompt-bulk|LocalAnalysis/.test(file)) return "generator";
  if (/use-wordpress|AgentMail|GMB|SocialMedia/.test(file)) return "dashboard";
  return "core";
}

function humanize(raw) {
  let t = raw.trim();
  t = t.replace(/\u2026/g, "...");
  t = t.replace(/\.\.\.$/, "");
  t = t.replace(/^Step \d+[a-z]?\s*\/\s*\d+:\s*/i, "");
  t = t.replace(/^Step \d+[a-z]?\s*\/\s*\d+\s+Complete:\s*/i, "");
  t = t.replace(/^Step \d+[a-z]?\s*\/\s*\d+\s+Warning:\s*/i, "Warning: ");
  t = t.replace(/^Step \d+b\/\d+:\s*/i, "");
  t = t.replace(/^Step \d+b\/\d+\s+Complete:\s*/i, "");
  t = t.replace(/^\d+\/\d+:\s*/, "");
  t = t.replace(/^Step 3\/3:\s*/i, "");
  t = t.replace(/\s*[\u2014\u2013]\s*/g, ", ");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/!+$/, "");
  return t;
}

function slugify(s) {
  return s.replace(/\$\{[^}]+\}/g, "X").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase().slice(0, 40);
}

function uniqueName(base, used) {
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base}_${i++}`;
  used.add(name);
  return name;
}

function extractParams(raw) {
  const params = [];
  const re = /\$\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const p = m[1].trim();
    if (!params.includes(p)) params.push(p);
  }
  return params;
}

function toFnName(constName) {
  const parts = constName.replace(/^NOTIFY_/, "").toLowerCase().split("_").filter(Boolean);
  return "notify" + parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

function sanitizeParam(expr) {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim())) return expr.trim();
  return expr.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean).map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join("").slice(0, 40) || "value";
}

const moduleBuckets = new Map();
for (const mod of ["core", "wordpress", "research", "content-optimization", "generator", "dashboard"]) {
  moduleBuckets.set(mod, { constants: new Map(), helpers: new Map(), used: new Set() });
}

const catalog = new Map();
for (const item of inventory.items) {
  const mod = pickMod(item.file);
  const bucket = moduleBuckets.get(mod);
  const raw = item.raw;
  if (raw.includes("${")) {
    const key = `tpl:${mod}:${raw}`;
    if (!catalog.has(key)) {
      const params = extractParams(raw);
      const body = humanize(raw);
      const constName = uniqueName(`NOTIFY_${slugify(raw) || "MSG"}`, bucket.used);
      const fnName = toFnName(constName);
      const safeParams = params.map(sanitizeParam);
      bucket.helpers.set(key, { fnName, params, safeParams, body });
      catalog.set(key, { mod, kind: "helper", exportName: fnName, raw, params, safeParams });
    }
  } else {
    const key = `str:${mod}:${raw}`;
    if (!catalog.has(key)) {
      const human = humanize(raw);
      const constName = uniqueName(`NOTIFY_${slugify(human) || "MSG"}`, bucket.used);
      bucket.constants.set(key, { constName, human });
      catalog.set(key, { mod, kind: "const", exportName: constName, raw, human });
    }
  }
}

for (const [mod, bucket] of moduleBuckets) {
  if (!bucket.constants.size && !bucket.helpers.size) continue;
  const path = join(ROOT, `src/lib/notify-messages/${mod}.ts`);
  let text = await readFile(path, "utf8");
  const additions = [];
  for (const { constName, human } of bucket.constants.values()) {
    if (text.includes(`export const ${constName}`)) continue;
    additions.push(`export const ${constName} = ${JSON.stringify(human)};`);
  }
  for (const h of bucket.helpers.values()) {
    if (text.includes(`export function ${h.fnName}`)) continue;
    const types = h.safeParams.map((p) => `${p}: string | number`).join(", ");
    let body = h.body;
    h.params.forEach((p, i) => {
      body = body.split(`\${${p}}`).join(`\${${h.safeParams[i]}}`);
    });
    additions.push(`export function ${h.fnName}(${types}): string {`, `  return \`${body}\`;`, `}`, "");
  }
  if (additions.length) await writeFile(path, `${text.trim()}\n\n/** Inventory pass 2 */\n${additions.join("\n")}\n`);
}

const fileItems = new Map();
for (const item of inventory.items) {
  const mod = pickMod(item.file);
  const key = item.raw.includes("${") ? `tpl:${mod}:${item.raw}` : `str:${mod}:${item.raw}`;
  const cat = catalog.get(key);
  if (!cat) continue;
  if (!fileItems.has(item.file)) fileItems.set(item.file, []);
  fileItems.get(item.file).push({ ...item, ...cat });
}

let total = 0;
for (const [file, items] of fileItems) {
  const path = join(ROOT, file);
  let text = await readFile(path, "utf8");
  const symbols = new Set();
  for (const item of items) {
    symbols.add(item.exportName);
    for (const q of ["'", '"', "`"]) {
      const escaped = item.raw.replace(/\\/g, "\\\\").replace(new RegExp(q, "g"), "\\" + q);
      const needle = `notify.${item.variant}(${q}${escaped}${q}`;
      if (!text.includes(needle)) continue;
      const args = (item.params || []).join(", ");
      const rep = item.kind === "const" ? `notify.${item.variant}(${item.exportName}` : `notify.${item.variant}(${item.exportName}(${args})`;
      text = text.split(needle).join(rep);
      total++;
      break;
    }
  }
  const symList = [...symbols].sort();
  const importPath = "@/lib/notify-messages";
  const existingRe = /import \{([^}]+)\} from ["']@\/lib\/notify-messages["'];?\n?/;
  const existing = text.match(existingRe);
  if (existing) {
    const cur = existing[1].split(",").map((s) => s.trim()).filter(Boolean);
    text = text.replace(existingRe, `import { ${[...new Set([...cur, ...symList])].sort().join(", ")} } from "${importPath}";\n`);
  } else {
    const notifyImport = text.match(/^import .* from ["']@\/lib\/app-notifications["'];?\n/m);
    const line = `import { ${symList.join(", ")} } from "${importPath}";\n`;
    text = notifyImport ? text.replace(notifyImport[0], notifyImport[0] + line) : line + text;
  }
  await writeFile(path, text);
}

console.log(`Pass 2: ${total} replacements in ${fileItems.size} files`);
