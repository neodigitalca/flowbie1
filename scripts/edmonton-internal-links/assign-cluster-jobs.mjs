/**
 * Assign six existing neodigital.ca URLs to FirstRank-style spoke jobs.
 * No new slugs. Writes test-output/edmonton-seo-cluster-jobs.json
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normPath } from "./link-map-rules.mjs";

const require = createRequire(import.meta.url);
const { openRouterKey } = require("../load-root-openrouter-env.cjs");

export const CLUSTER_JOBS = ["gbp", "citations", "links", "content", "tips", "smb"];

const PREFERRED = {
  gbp: ["/local-seo"],
  content: ["/aiseo", "/aiseo/generative-engine-optimization"],
  smb: ["/blog/edmonton-seo-partner"],
};

const SYSTEM = `You assign existing Neo Digital URLs to six Edmonton SEO cluster jobs.

Jobs (use each exactly once):
- gbp: Google Business Profile and local pack
- citations: citations and NAP
- links: link building
- content: AI search / content clusters
- tips: local SEO how-to
- smb: small-business / partner

Rules:
- Pick only paths from the candidate list. Never invent a slug.
- Each job gets one unique path and unique id.
- Prefer the preferredPath hints when that path is in the candidate list.
- Do not pick /edmonton-seo (the money page).
- Do not pick street-level window-treatment or "near 170 Street" style URLs.
- A page or post titled exactly "Edmonton SEO" may only be used if needsRetitle is true (it cannibalizes the money page).
- If no candidate fits a job, still pick the closest existing candidate. Do not output a new path.

Return JSON only:
{"jobs":[{"job":"gbp","path":"/local-seo","id":10439,"reason":"short","needsRetitle":false}]}`;

export function isStreetSap(item) {
  const blob = `${item.slug || ""} ${item.title || ""} ${item.path || ""}`.toLowerCase();
  if (/\bnear\b/.test(blob) && /\b(\d+|street|st\b|avenue|ave\b|bridge)\b/.test(blob)) return true;
  if (/window[- ]treatment/.test(blob) && /\b\d{2,3}\b/.test(blob)) return true;
  return false;
}

export function isExactHeadTerm(item) {
  return String(item.title || "").trim().toLowerCase() === "edmonton seo";
}

export function candidateItems(inventory, classified) {
  const items = inventory.items || [];
  const included = new Set((classified.posts || []).filter((p) => p.include).map((p) => p.id));
  const pageAllow = new Set(
    [
      "/local-seo",
      "/aiseo",
      "/aiseo/what-is-aiseo",
      "/aiseo/ai-content-optimization",
      "/aiseo/generative-engine-optimization",
      "/aiseo/ai-seo-audit",
      "/neo-pulse-platform",
      "/blog/edmonton-seo-partner",
    ].map(normPath),
  );
  return items.filter((item) => {
    const path = normPath(item.path);
    if (!path || path === "/" || path === "/edmonton-seo") return false;
    if (isStreetSap(item)) return false;
    if (item.type === "page" && pageAllow.has(path)) return true;
    if (item.type === "post" && included.has(item.id)) return true;
    if (item.type === "post" && /edmonton-seo-partner|seo-partner|local-seo/.test(item.slug || "")) return true;
    if (item.type === "post" && isExactHeadTerm(item)) return true;
    return false;
  });
}

export function validateJobs(jobs, inventory) {
  if (!Array.isArray(jobs) || jobs.length !== CLUSTER_JOBS.length) {
    throw new Error(`assigner must return ${CLUSTER_JOBS.length} jobs`);
  }
  const byPath = new Map((inventory.items || []).map((i) => [normPath(i.path), i]));
  const seenJobs = new Set();
  const seenPaths = new Set();
  const seenIds = new Set();
  const out = [];
  for (const row of jobs) {
    if (!CLUSTER_JOBS.includes(row.job)) throw new Error(`invalid job ${row.job}`);
    if (seenJobs.has(row.job)) throw new Error(`duplicate job ${row.job}`);
    seenJobs.add(row.job);
    const path = normPath(row.path);
    if (!path) throw new Error(`empty path for ${row.job}`);
    if (path === "/edmonton-seo") throw new Error("money page cannot be a cluster job");
    if (seenPaths.has(path)) throw new Error(`duplicate path ${path}`);
    seenPaths.add(path);
    const item = byPath.get(path);
    if (!item) throw new Error(`unknown path ${path}`);
    if (Number(row.id) !== Number(item.id)) throw new Error(`id mismatch for ${path}`);
    if (seenIds.has(item.id)) throw new Error(`duplicate id ${item.id}`);
    seenIds.add(item.id);
    if (isStreetSap(item)) throw new Error(`street SAP not allowed ${path}`);
    const needsRetitle = Boolean(row.needsRetitle) || isExactHeadTerm(item);
    if (isExactHeadTerm(item) && !needsRetitle) {
      throw new Error(`exact head-term title on ${path} requires needsRetitle`);
    }
    if (typeof row.reason !== "string" || !row.reason.trim()) throw new Error(`reason required for ${row.job}`);
    out.push({
      job: row.job,
      path,
      id: item.id,
      reason: row.reason.trim(),
      needsRetitle,
      title: item.title,
      type: item.type,
    });
  }
  for (const job of CLUSTER_JOBS) {
    if (!seenJobs.has(job)) throw new Error(`missing job ${job}`);
  }
  return out;
}

function loadKey() {
  const key =
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPEN_ROUTER_API_KEY?.trim() ||
    process.env.VITE_OPENROUTER_API_KEY?.trim() ||
    (typeof openRouterKey === "string" ? openRouterKey.trim() : "");
  if (!key) throw new Error("OPENROUTER_API_KEY is required");
  return key;
}

async function assignWithOpenRouter(apiKey, model, candidates) {
  const user = JSON.stringify({
    preferred: PREFERRED,
    candidates: candidates.map((c) => ({
      id: c.id,
      path: normPath(c.path),
      title: c.title,
      slug: c.slug,
      type: c.type,
      exactHeadTerm: isExactHeadTerm(c),
    })),
  });
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca/neo-pulse/",
      "X-Title": "NEO Pulse edmonton-cluster-jobs",
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
  if (typeof content !== "string" || !content.trim()) throw new Error("OpenRouter returned empty content");
  const json = JSON.parse(content);
  if (!Array.isArray(json.jobs)) throw new Error("OpenRouter JSON missing jobs[]");
  return json.jobs;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const outDir = join(root, "test-output");
  const inventory = JSON.parse(readFileSync(join(outDir, "edmonton-seo-inventory.json"), "utf8"));
  const classified = JSON.parse(readFileSync(join(outDir, "edmonton-seo-classified-posts.json"), "utf8"));
  const candidates = candidateItems(inventory, classified);
  if (candidates.length < CLUSTER_JOBS.length) {
    throw new Error(`Need ${CLUSTER_JOBS.length} candidates, got ${candidates.length}`);
  }
  const apiKey = loadKey();
  const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const raw = await assignWithOpenRouter(apiKey, model, candidates);
  const jobs = validateJobs(raw, inventory);
  mkdirSync(outDir, { recursive: true });
  const dest = join(outDir, "edmonton-seo-cluster-jobs.json");
  const payload = { ok: true, model, jobs };
  writeFileSync(dest, JSON.stringify(payload, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, dest, jobs }, null, 2));
}
