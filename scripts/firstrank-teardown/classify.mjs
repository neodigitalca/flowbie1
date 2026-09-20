/**
 * OpenRouter classifies public URLs. Writes gitignored JSON.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeGitignoredJson } from "./lib.mjs";

const require = createRequire(import.meta.url);
const { openRouterKey } = require("../load-root-openrouter-env.cjs");

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const inventoryPath = join(root, "test-output", "firstrank-inventory.json");
const dest = join(root, "test-output", "firstrank-classified.json");

export const ROLES = ["city-seo", "ads-city", "edmonton-spoke", "authority-hub", "other"];

export const SYSTEM = `You classify public URLs for a competitor teardown.

Return JSON only:
{"items":[{"link":"https://example.com/path/","role":"city-seo","cluster":"edmonton","edmonton_relevant":true,"reason":"short"}]}

role must be one of: city-seo | ads-city | edmonton-spoke | authority-hub | other
city-seo = a city SEO service lander (not Google Ads).
ads-city = a Google Ads / PPC city lander.
edmonton-spoke = an Edmonton supporting article pointing at Edmonton SEO.
authority-hub = a national or educational guide (local SEO guide, technical SEO, GEO, AEO).
other = careers, legal, thank-you, booking, unrelated.

cluster is the city or topic in lowercase, or "none".
edmonton_relevant is true only when the page is about Edmonton SEO or Edmonton local search.`;

function loadKey() {
  const key =
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPEN_ROUTER_API_KEY?.trim() ||
    process.env.VITE_OPENROUTER_API_KEY?.trim() ||
    (typeof openRouterKey === "string" ? openRouterKey.trim() : "");
  if (!key) throw new Error("OPENROUTER_API_KEY is required");
  return key;
}

function normLink(link) {
  return String(link || "").replace(/\/+$/, "");
}

export function validateClassified(payload, expectedLinks) {
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error("Classify output missing items array");
  }
  const byLink = new Map();
  for (const item of payload.items) {
    if (!ROLES.includes(item.role)) throw new Error("Classify output has invalid role");
    if (typeof item.edmonton_relevant !== "boolean") {
      throw new Error("Classify output missing edmonton_relevant");
    }
    if (typeof item.reason !== "string" || !item.reason.trim()) {
      throw new Error("Classify output missing reason");
    }
    byLink.set(normLink(item.link), { ...item, link: item.link });
  }
  const items = [];
  for (const link of expectedLinks) {
    const hit = byLink.get(normLink(link));
    if (!hit) throw new Error("Classify output missing a required link");
    items.push({ ...hit, link });
  }
  return { items };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function classifyBatch(apiKey, model, batch) {
  const user = JSON.stringify({
    goal: "Classify each public URL.",
    urls: batch.map((r) => ({
      link: r.link,
      title: r.title,
      slug: r.slug,
      type: r.type,
    })),
  });
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
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
  return JSON.parse(content);
}

export async function runClassify() {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const rows = [...(inventory.pages || []), ...(inventory.posts || [])];
  const apiKey = loadKey();
  const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const items = [];
  for (const batch of chunk(rows, 35)) {
    const out = await classifyBatch(apiKey, model, batch);
    const checked = validateClassified(out, batch.map((r) => r.link));
    items.push(...checked.items);
  }
  const payload = { items };
  writeGitignoredJson(dest, payload);
  return { dest, count: items.length };
}

const invoked = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("firstrank-teardown/classify.mjs");
if (invoked) {
  runClassify()
    .then((r) => {
      process.stdout.write(`${r.count} urls\n`);
    })
    .catch((err) => {
      process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
      process.exit(1);
    });
}
