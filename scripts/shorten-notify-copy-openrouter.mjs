#!/usr/bin/env node
/**
 * Batch-rewrite notify-messages string constants to ≤48 chars via OpenRouter (Gemini).
 * Usage: OPENROUTER_API_KEY=... node scripts/shorten-notify-copy-openrouter.mjs [--dry-run]
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";

for (const envFile of [".env", ".env.local", ".env.production"]) {
  loadEnv({ path: join(process.cwd(), envFile) });
}

const ROOT = process.cwd();
const NOTIFY_DIR = join(ROOT, "src/lib/notify-messages");
const MAX_LEN = 48;
const BATCH_SIZE = 35;
const MODEL = process.env.NOTIFY_SHORTEN_MODEL || "google/gemini-2.5-flash-lite";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DRY_RUN = process.argv.includes("--dry-run");

const BANNED = [
  /try again/i,
  /please try/i,
  /please check/i,
  /from the response/i,
  /from the model/i,
];

const SYSTEM = `You shorten in-app notification copy for a web app header pill (fixed width).

Rules for every "short" value:
- Maximum ${MAX_LEN} characters (count carefully).
- Plain English, outcome-first, no filler.
- Never use: try again, please try, please check, from the response, from the model.
- No trailing ellipsis (...).
- No step prefixes like "Step 1" or "1/3:".
- No em dash or en dash.
- Preserve template placeholders exactly: \${name}, \${count}, etc.
- Do not truncate with ellipsis; rewrite shorter while keeping intent.
- Return ONLY valid JSON: { "items": [ { "id": "...", "short": "..." } ] }`;

function extractConstants(source, file) {
  const items = [];
  const re = /export const (NOTIFY_\w+) = "((?:[^"\\]|\\.)*)";/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const id = m[1];
    const value = m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n");
    items.push({ id, file, value, line: source.slice(0, m.index).split("\n").length });
  }
  return items;
}

function validateShort(id, original, short) {
  if (typeof short !== "string" || !short.trim()) {
    return `empty short for ${id}`;
  }
  const t = short.trim();
  if (t.length > MAX_LEN) return `${id}: ${t.length} chars (max ${MAX_LEN})`;
  if (t.endsWith("...")) return `${id}: trailing ellipsis`;
  for (const ban of BANNED) {
    if (ban.test(t)) return `${id}: banned phrase in "${t}"`;
  }
  const origPlaceholders = [...original.matchAll(/\$\{[^}]+\}/g)].map((x) => x[0]).sort();
  const newPlaceholders = [...t.matchAll(/\$\{[^}]+\}/g)].map((x) => x[0]).sort();
  if (JSON.stringify(origPlaceholders) !== JSON.stringify(newPlaceholders)) {
    return `${id}: placeholder mismatch`;
  }
  return null;
}

async function callOpenRouter(apiKey, batch) {
  const userPayload = batch.map(({ id, value }) => ({ id, original: value }));
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca/neo-pulse/",
      "X-Title": "NEO Pulse Web App",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Shorten each original string. Return JSON { "items": [ { "id", "short" } ] }.\n\n${JSON.stringify(userPayload, null, 2)}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenRouter response");
  const parsed = JSON.parse(content);
  const items = parsed.items ?? parsed;
  if (!Array.isArray(items)) throw new Error("Expected items array in JSON");
  return items;
}

function escapeForTs(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

async function applyReplacements(file, replacements) {
  let source = await readFile(file, "utf8");
  for (const [id, short] of replacements) {
    const re = new RegExp(`(export const ${id} = ")(?:[^"\\\\]|\\\\.)*(";)`);
    if (!re.test(source)) {
      console.warn(`Skip missing ${id} in ${file}`);
      continue;
    }
    source = source.replace(re, `$1${escapeForTs(short)}$2`);
  }
  if (!DRY_RUN) await writeFile(file, source);
}

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!apiKey) {
  console.error("Set OPENROUTER_API_KEY in the environment.");
  process.exit(1);
}

const files = (await readdir(NOTIFY_DIR)).filter((f) => f.endsWith(".ts") && f !== "index.ts");
const all = [];
for (const f of files) {
  const path = join(NOTIFY_DIR, f);
  const source = await readFile(path, "utf8");
  all.push(...extractConstants(source, f));
}

const needsWork = all.filter(({ value }) => {
  if (value.length <= MAX_LEN && !BANNED.some((b) => b.test(value)) && !value.endsWith("...")) {
    return false;
  }
  return true;
});

console.log(`Total constants: ${all.length}, to shorten: ${needsWork.length}, dry-run: ${DRY_RUN}`);

const byFile = new Map();
let failed = 0;

for (let i = 0; i < needsWork.length; i += BATCH_SIZE) {
  const batch = needsWork.slice(i, i + BATCH_SIZE);
  console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} strings...`);
  const results = await callOpenRouter(apiKey, batch);
  const resultMap = new Map(results.map((r) => [r.id, r.short]));

  for (const item of batch) {
    const short = resultMap.get(item.id);
    const err = validateShort(item.id, item.value, short ?? "");
    if (err) {
      console.error(`FAIL ${err} (was: ${item.value.slice(0, 70)})`);
      failed++;
      continue;
    }
    const filePath = join(NOTIFY_DIR, item.file);
    if (!byFile.has(filePath)) byFile.set(filePath, []);
    byFile.get(filePath).push([item.id, short.trim()]);
    console.log(`OK ${item.id}: ${item.value.length} -> ${short.trim().length} | ${short.trim()}`);
  }
}

for (const [filePath, replacements] of byFile) {
  await applyReplacements(filePath, replacements);
  console.log(`Updated ${replacements.length} in ${filePath.replace(/\\/g, "/").slice(ROOT.length + 1)}`);
}

if (failed > 0) {
  console.error(`${failed} string(s) failed validation`);
  process.exit(1);
}

console.log("Done.");
