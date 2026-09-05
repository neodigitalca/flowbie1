/**
 * Probe GSC outline OpenRouter path (local or production API).
 * Usage: node scripts/research/gsc-outline-probe.mjs [--base https://neopulse.local]
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "string" },
    topOpportunities: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          rank: { type: "number" },
          label: { type: "string" },
          why: { type: "string" },
          metrics: { type: "string" },
          evidence: { type: "array", maxItems: 3, items: { type: "string" } },
        },
        required: ["rank", "label", "why", "metrics"],
      },
    },
  },
  required: ["executiveSummary", "topOpportunities"],
};

const baseArg = process.argv.find((a) => a.startsWith("--base="));
const base = (baseArg?.slice("--base=".length) || "https://neopulse.local").replace(/\/+$/, "");

const system = `You are an SEO analyst. Return JSON matching the response schema exactly.`;
const user = `Site: Test Site (https://example.com)
REPORT_PERIOD: August 1, 2026 to August 31, 2026 vs July 1–31, 2026

--- FILE: Site-totals-MoM.csv ---
Period,Clicks,Impressions,CTR,Position,Search queries
August 2026,120,4500,2.67%,18.2,890
July 2026,100,4000,2.50%,17.5,820

Analyze and produce the JSON object as specified.`;

const body = {
  model: "google/gemini-2.5-flash",
  system,
  user,
  maxTokens: 2048,
  temperature: 0.2,
  responseFormat: {
    type: "json_schema",
    json_schema: { name: "gsc_reporting_outline", strict: true, schema },
  },
};

async function probe(path) {
  const url = `${base}/api/${path}${path.endsWith("/") ? "" : path.includes("?") ? "" : "/"}`;
  const normalized = `${base}/api/${path.replace(/^\/+/, "")}/`;
  console.log("\n--- POST", normalized);
  const res = await fetch(normalized, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("HTTP", res.status);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.log("Non-JSON body (first 400 chars):", text.slice(0, 400));
    return;
  }
  console.log("ok:", data.ok, "error:", data.error);
  if (typeof data.content === "string") {
    console.log("content length:", data.content.length);
    console.log("content preview:", data.content.slice(0, 300));
    try {
      JSON.parse(data.content.trim());
      console.log("content JSON.parse: OK");
    } catch (e) {
      console.log("content JSON.parse: FAIL", e.message);
    }
  }
  console.log("finishReason:", data.finishReason);
}

for (const path of ["openrouter/chat-completion", "gsc/reporting-chat-completion"]) {
  await probe(path);
}
