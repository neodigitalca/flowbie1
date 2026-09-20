/**
 * OpenRouter classifies published posts for the Edmonton/SEO hub set.
 * Writes test-output/edmonton-seo-classified-posts.json
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { openRouterKey } = require("../load-root-openrouter-env.cjs");

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = join(root, "test-output");
const inventoryPath = join(outDir, "edmonton-seo-inventory.json");
const dest = join(outDir, "edmonton-seo-classified-posts.json");

const SPOKES = ["edmonton-seo", "aiseo", "geo", "audit", "content", "website-design", "skip"];

const SYSTEM = `You classify Neo Digital (neodigital.ca) blog posts for a site-wide internal-link hub.

Include a post only when the actual topic is Edmonton SEO, Alberta local SEO, or AI SEO this agency would use as a spoke to /edmonton-seo/.

Judge from slug + excerpt + title together. This site sometimes has a title that does not match the slug. If they conflict, trust slug + excerpt. Do not include a post because the title mentions Edmonton if the slug is about Elementor, social media, dental, or a generic national tip.

Exclude: window-coverings product or lead-gen posts that are not local-search articles; Elementor/WordPress how-tos; national SEO vs ads explainers; social media; careers; unrelated news. When unsure, include false.

Return JSON only:
{"posts":[{"id":123,"include":true,"reason":"short","suggested_anchor":"3-7 words unique job language","spoke":"edmonton-seo"}]}

spoke must be one of: edmonton-seo | aiseo | geo | audit | content | website-design | skip
If include is false, spoke must be skip.
suggested_anchor must not be the exact string "Edmonton SEO". Each suggested_anchor in a batch must be different.`;

function loadKey() {
  const key =
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPEN_ROUTER_API_KEY?.trim() ||
    process.env.VITE_OPENROUTER_API_KEY?.trim() ||
    (typeof openRouterKey === "string" ? openRouterKey.trim() : "");
  if (!key) throw new Error("OPENROUTER_API_KEY is required");
  return key;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function classifyBatch(apiKey, model, batch) {
  const user = JSON.stringify({
    goal: "Mark which posts belong on the Edmonton/SEO hub.",
    posts: batch.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt || p.text.slice(0, 400),
    })),
  });
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca/neo-pulse/",
      "X-Title": "NEO Pulse edmonton-internal-links",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 400)}`);
  const parsed = JSON.parse(body);
  const content = parsed?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter returned empty content");
  }
  const json = JSON.parse(content);
  if (!Array.isArray(json.posts)) throw new Error("OpenRouter JSON missing posts[]");
  return json.posts;
}

function validateRow(row, allowedIds) {
  if (!allowedIds.has(row.id)) throw new Error(`Unknown classified id ${row.id}`);
  if (typeof row.include !== "boolean") throw new Error(`id ${row.id}: include must be boolean`);
  if (typeof row.reason !== "string" || !row.reason.trim()) throw new Error(`id ${row.id}: reason required`);
  if (!SPOKES.includes(row.spoke)) throw new Error(`id ${row.id}: invalid spoke`);
  if (row.include && row.spoke === "skip") throw new Error(`id ${row.id}: include true cannot speak skip`);
  if (!row.include && row.spoke !== "skip") throw new Error(`id ${row.id}: include false must spoke skip`);
  if (row.include && (typeof row.suggested_anchor !== "string" || !row.suggested_anchor.trim())) {
    throw new Error(`id ${row.id}: suggested_anchor required`);
  }
  return {
    id: row.id,
    include: row.include,
    reason: row.reason.trim(),
    suggested_anchor: row.include ? row.suggested_anchor.trim() : "",
    spoke: row.spoke,
  };
}

const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const posts = inventory.items.filter((i) => i.type === "post");
if (posts.length === 0) throw new Error("Inventory has no posts");

const apiKey = loadKey();
const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
const allowedIds = new Set(posts.map((p) => p.id));
const classified = [];

for (const batch of chunk(posts, 20)) {
  const rows = await classifyBatch(apiKey, model, batch);
  for (const row of rows) classified.push(validateRow(row, allowedIds));
}

const missing = posts.filter((p) => !classified.some((c) => c.id === p.id));
if (missing.length) throw new Error(`Classifier skipped ids: ${missing.map((m) => m.id).join(",")}`);

mkdirSync(outDir, { recursive: true });
const payload = {
  ok: true,
  model,
  count: classified.length,
  included: classified.filter((c) => c.include).length,
  posts: classified,
};
writeFileSync(dest, JSON.stringify(payload, null, 2), "utf8");
console.log(JSON.stringify({ ok: true, count: payload.count, included: payload.included, dest }, null, 2));
