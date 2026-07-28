#!/usr/bin/env node
/**
 * Generates notify-messages domain modules from inventory and migrates call sites.
 * Usage: node scripts/migrate-notify-strings.mjs
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const inventory = JSON.parse(await readFile(join(ROOT, "docs/notify-inventory.json"), "utf8"));

const DOMAIN_RULES = [
  { test: (f) => /content-generation|content-generation-upload|featured-image|acf-origin|apply-meta-optimizer/.test(f), module: "content-generation" },
  { test: (f) => /content-optimization|content-optimizer|handle-optimize|continue-optimization|bulk-optimization|bulk-seo|sem-fix|gsc-query-processor/.test(f), module: "content-optimization" },
  { test: (f) => /wordpress|gbp-post|use-wordpress-sites|wordpress-sitemap/.test(f), module: "wordpress" },
  { test: (f) => /research|competitor|citation|backlink|sitemap-optimizer|reporting|overview|vertical-benchmark|local-analysis|knowledge-graph/.test(f), module: "research" },
  { test: (f) => /keyword-research|bulk|BlogTemplate|PressRelease|entity-generation|flow-freeform|agent-generation|prompt-bulk|bulk-auto|OutputManager|sap-generator/.test(f), module: "generator" },
  { test: (f) => /manager|KnowledgeBase|ApiKey|GMB|GSCFeature|SEMFeature|pages\/Index/.test(f), module: "dashboard" },
];

function pickModule(file) {
  for (const r of DOMAIN_RULES) {
    if (r.test(file)) return r.module;
  }
  return "core";
}

const REWRITES = new Map([
  ["Content converted to HTML. Ready for upload...", "HTML ready to upload"],
  ["Generating optimized content (parallel harness workers)...", "Generating content"],
  ["Content generated (harness). Processing…", "Content generated"],
  ["Content generated (harness). Processing...", "Content generated"],
  ["Keyword recommendation complete!", "Keyword recommendation ready"],
  ["Skipped (no seo_research)", "Skipped: no SEO research field"],
  ["Skipped (no keyword)", "Skipped: no keyword"],
  ["No seo_research field", "No SEO research field"],
  ["2/3: Starting Draft Report Generation", "Writing draft report"],
  ["3/3: Starting Final Review and Polishing", "Reviewing final draft"],
  ["Could not fetch WordPress content. Continuing without internal links...", "WordPress links unavailable, continuing without them"],
  ["TEST MODE: Using mock blueprint...", "Using test blueprint data"],
  ["TEST MODE: Using mock keyword data and AI analysis...", "Using test keyword data"],
  ["Approval expired, restart", "Approval expired. Restart the run"],
  ["Connect WordPress first", "Connect WordPress first"],
  ["Add OpenRouter key", "Add OpenRouter key"],
  ["Add OpenRouter key in settings", "Add OpenRouter key in Settings"],
  ["Using GSC only", "Using Search Console only"],
  ["Optimizing without GSC", "Optimizing without Search Console"],
  ["Staging: no GSC", "Staging site: no Search Console"],
]);

function humanize(raw) {
  let t = raw.trim();
  if (REWRITES.has(t)) return REWRITES.get(t);
  t = t.replace(/\u2026/g, "...");
  t = t.replace(/\.\.\.$/, "");
  t = t.replace(/^Step \d+[a-z]?\s*\/\s*\d+:\s*/i, "");
  t = t.replace(/^\d+\/\d+:\s*/, "");
  t = t.replace(/^TEST MODE:\s*/i, "");
  t = t.replace(/\s*[\u2014\u2013]\s*/g, ", ");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/!+$/, "");
  if (t.endsWith(",")) t = t.slice(0, -1);
  return t;
}

function slugify(s) {
  return s
    .replace(/\$\{[^}]+\}/g, "X")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 40);
}

function uniqueName(base, used) {
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base}_${i++}`;
  used.add(name);
  return name;
}

function isTemplate(raw) {
  return raw.includes("${");
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

const moduleBuckets = new Map();
for (const mod of ["core", "content-generation", "content-optimization", "wordpress", "research", "generator", "dashboard"]) {
  moduleBuckets.set(mod, { constants: new Map(), helpers: new Map(), used: new Set() });
}

/** itemKey -> { mod, kind, exportName, raw, human, params? } */
const catalog = new Map();

for (const item of inventory.items) {
  const mod = pickModule(item.file);
  const bucket = moduleBuckets.get(mod);
  const raw = item.raw;

  if (isTemplate(raw)) {
    const key = `tpl:${mod}:${raw}`;
    if (!catalog.has(key)) {
      const params = extractParams(raw);
      const humanBody = humanize(raw);
      let body = humanBody;
      params.forEach((p) => {
        body = body.replace(`\${${p}}`, `\${${p}}`);
      });
      const constName = uniqueName(`NOTIFY_${slugify(raw) || "MSG"}`, bucket.used);
      const fnName = toFnName(constName);
      bucket.helpers.set(key, { fnName, constName, params, body: humanBody, raw });
      catalog.set(key, { mod, kind: "helper", exportName: fnName, raw, params });
    }
  } else {
    const key = `str:${mod}:${raw}`;
    if (!catalog.has(key)) {
      const human = humanize(raw);
      const constName = uniqueName(`NOTIFY_${slugify(human) || "MSG"}`, bucket.used);
      bucket.constants.set(key, { constName, human, raw });
      catalog.set(key, { mod, kind: "const", exportName: constName, raw, human });
    }
  }
}

const outDir = join(ROOT, "src/lib/notify-messages");
await mkdir(outDir, { recursive: true });

await writeFile(
  join(outDir, "core-helpers.ts"),
  `/** Generic notify message helpers. */

export function notifyActionFailed(action: string, err: unknown): string {
  const detail = err instanceof Error ? err.message : "Unknown error";
  return \`\${action} failed: \${detail}\`;
}

export function notifyErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  return err instanceof Error ? err.message : fallback;
}
`
);

function renderModule(mod, bucket) {
  const lines = [`/** Notify copy: ${mod}. */`, ""];
  if (mod === "core") {
    lines.push(`export { notifyActionFailed, notifyErrorMessage } from "./core-helpers";`, "");
  }
  for (const { constName, human } of bucket.constants.values()) {
    lines.push(`export const ${constName} = ${JSON.stringify(human)};`);
  }
  if (bucket.constants.size) lines.push("");
  for (const h of bucket.helpers.values()) {
    const types = h.params.map((p) => `${p}: string | number`).join(", ");
    lines.push(`export function ${h.fnName}(${types}): string {`);
    lines.push(`  return \`${h.body}\`;`);
    lines.push(`}`, "");
  }
  return lines.join("\n");
}

for (const [mod, bucket] of moduleBuckets) {
  await writeFile(join(outDir, `${mod}.ts`), renderModule(mod, bucket));
}

await writeFile(
  join(outDir, "index.ts"),
  [
    `/** Central notify copy catalog. */`,
    ``,
    `export * from "./core-helpers";`,
    ...["core", "content-generation", "content-optimization", "wordpress", "research", "generator", "dashboard"].map(
      (m) => `export * from "./${m}";`
    ),
  ].join("\n")
);

await writeFile(
  join(ROOT, "src/lib/notify-messages.ts"),
  `/** Re-export catalog for backward-compatible "@/lib/notify-messages" imports. */\nexport * from "./notify-messages/index";\n`
);

// Apply replacements per file
const fileItems = new Map();
for (const item of inventory.items) {
  const mod = pickModule(item.file);
  const raw = item.raw;
  const key = isTemplate(raw) ? `tpl:${mod}:${raw}` : `str:${mod}:${raw}`;
  const cat = catalog.get(key);
  if (!cat) continue;
  if (!fileItems.has(item.file)) fileItems.set(item.file, []);
  fileItems.get(item.file).push({ ...item, ...cat });
}

let totalReplacements = 0;

for (const [file, items] of fileItems) {
  const path = join(ROOT, file);
  let text = await readFile(path, "utf8");
  const symbols = new Set();

  for (const item of items) {
    symbols.add(item.exportName);
    const variants = [`'${item.raw.replace(/'/g, "\\'")}'`, `"${item.raw.replace(/"/g, '\\"')}"`, `\`${item.raw.replace(/`/g, "\\`")}\``];
    let replaced = false;
    for (const lit of variants) {
      const needle = `notify.${item.variant}(${lit}`;
      if (text.includes(needle)) {
        const rep =
          item.kind === "const"
            ? `notify.${item.variant}(${item.exportName}`
            : `notify.${item.variant}(${item.exportName}(${item.params.join(", ")}`;
        text = text.split(needle).join(rep);
        replaced = true;
        totalReplacements++;
        break;
      }
    }
    if (!replaced) {
      // multiline or spacing variants - skip
    }
  }

  const importPath = "@/lib/notify-messages";
  const symList = [...symbols].sort();
  const newImport = `import { ${symList.join(", ")} } from "${importPath}";`;

  const existingRe = /import \{([^}]+)\} from ["']@\/lib\/notify-messages["'];?\n?/;
  const existing = text.match(existingRe);
  if (existing) {
    const cur = existing[1].split(",").map((s) => s.trim()).filter(Boolean);
    const merged = [...new Set([...cur, ...symList])].sort();
    text = text.replace(existingRe, `import { ${merged.join(", ")} } from "${importPath}";\n`);
  } else {
    const notifyImport = text.match(/^import .* from ["']@\/lib\/app-notifications["'];?\n/m);
    if (notifyImport) {
      text = text.replace(notifyImport[0], `${notifyImport[0]}${newImport}\n`);
    } else if (text.includes('from "@/lib/app-notifications"')) {
      text = text.replace(
        /(import \{[^}]+\} from ["']@\/lib\/app-notifications["'];?\n)/,
        `$1${newImport}\n`
      );
    } else {
      text = `${newImport}\n${text}`;
    }
  }

  await writeFile(path, text);
}

console.log(`Generated modules in src/lib/notify-messages/`);
console.log(`Applied ~${totalReplacements} replacements across ${fileItems.size} files`);
