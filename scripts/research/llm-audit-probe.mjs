/**
 * Probe DataForSEO LLM Responses Live for SERP brief platforms (parallel).
 * Usage:
 *   node scripts/research/llm-audit-probe.mjs \
 *     --keyword "Sidelight Window Blinds Near Plum Coulee, MB" \
 *     --site "https://advanceblindsanddrapery.com/" \
 *     --location "Plum Coulee, MB"
 *   node scripts/research/llm-audit-probe.mjs \
 *     --article-url "https://example.com/my-post/" \
 *     --keyword "how to measure for shades" \
 *     --site-name "Example Site"
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "test-output");

const PLATFORM_CONFIG = [
  { platform: "chat_gpt", label: "ChatGPT", path: "ai_optimization/chat_gpt/llm_responses/live", model_name: "o4-mini", force_web_search: false, web_search_country_iso_code: true, web_search_city: true },
  { platform: "gemini", label: "Gemini", path: "ai_optimization/gemini/llm_responses/live", model_name: "gemini-2.5-flash", force_web_search: false, web_search_country_iso_code: false, web_search_city: false },
  { platform: "perplexity", label: "Perplexity", path: "ai_optimization/perplexity/llm_responses/live", model_name: "sonar", force_web_search: false, web_search_country_iso_code: false, web_search_city: false },
];

const SERP_SYSTEM_MESSAGE =
  "You are a local resident and AISEO researcher in this market. Use web search. Return bullet facts only someone who lives here would know. Forbidden: census or population stats, km/mile distances, blog outlines, SEO advice, any business or brand names. Each bullet: one specific resident-level detail plus https source (verification only, not for the post).";

const SCORECARD_CATEGORIES = [
  "Search intent match",
  "Accuracy and usefulness",
  "Readability",
  "Structure and organization",
  "Originality",
  "E-E-A-T",
  "SEO optimization",
  "Visual support",
  "Conversion without being pushy",
  "Overall quality",
];

const ARTICLE_AUDIT_SYSTEM =
  "You are an expert content editor grading an existing web article. Use web search to read the live page. Required sections: 10-point scorecard table, letter grade, what it does well, what keeps it from a 10, how to make it a 10 (checklist bullets only).";

function loadDotEnv() {
  const out = {};
  try {
    for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[k] = v;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function parseArgs(argv) {
  const out = {
    keyword: "Sidelight Window Blinds Near Plum Coulee, MB",
    site: "https://advanceblindsanddrapery.com/",
    location: "Plum Coulee, MB",
    articleUrl: "",
    siteName: "",
    mode: "serp",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keyword" && argv[i + 1]) out.keyword = argv[++i];
    else if (a === "--site" && argv[i + 1]) out.site = argv[++i];
    else if (a === "--location" && argv[i + 1]) out.location = argv[++i];
    else if (a === "--article-url" && argv[i + 1]) {
      out.articleUrl = argv[++i];
      out.mode = "article";
    } else if (a === "--site-name" && argv[i + 1]) out.siteName = argv[++i];
  }
  return out;
}

function clip(s, max = 500) {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const ARTICLE_AUDIT_SYSTEM_CORE = `You are an expert content editor grading an existing web article. Use web search to read the live page at the given URL.

Required output (markdown): 10-point scorecard table, letter grade, what it does well, what keeps it from 10, how to make it a 10 (inline checklist only, no PDFs).

Categories: ${SCORECARD_CATEGORIES.join(", ")}. Be specific to page content.`;

function buildArticleSystemMessage() {
  return clip(ARTICLE_AUDIT_SYSTEM_CORE);
}

function buildArticleUserPrompt({
  platformLabel,
  keyword,
  articleUrl,
  siteName,
  auditQuestions,
  seoResearchBrief,
}) {
  const headerLines = [
    `For ${platformLabel}: audit this article.`,
    `URL: ${articleUrl}`,
    `Focus keyword: ${keyword}`,
    siteName ? `Site: ${siteName}` : "",
    "Grade on the ten scorecard categories. Use web search to read the live page.",
  ].filter(Boolean);
  const header = headerLines.join("\n");
  const contextLines = [];
  const brief = String(seoResearchBrief ?? "").trim();
  if (brief) contextLines.push(`SEO research: ${brief}`);
  const questions = Array.isArray(auditQuestions)
    ? auditQuestions.map((q) => String(q ?? "").trim()).filter(Boolean)
    : [];
  for (const q of questions) contextLines.push(q);
  if (questions.length === 0) {
    contextLines.push(
      "Give this article a letter grade on a ten-point scorecard and list concrete edits to reach a perfect ten.",
    );
  }
  const context = contextLines.join("\n");
  if (!context) return clip(header);
  const combined = `${header}\n${context}`;
  if (combined.length <= 500) return combined;
  const contextBudget = 500 - header.length - 1;
  if (contextBudget <= 0) return clip(header);
  return `${header}\n${clip(context, contextBudget)}`;
}

function buildUserPrompt({ platformLabel, keyword, location, articleUrl, siteName, mode, auditQuestions, seoResearchBrief }) {
  if (mode === "article" && articleUrl) {
    return buildArticleUserPrompt({
      platformLabel,
      keyword,
      articleUrl,
      siteName,
      auditQuestions,
      seoResearchBrief,
    });
  }
  return clip(
    `For ${platformLabel}: '${keyword}' in ${location}. List 12 hyper-local AREA facts only (no businesses): how locals refer to places, Main Street rhythm, typical home/entry styles, seasonal habits, prairie sun-wind-frost at front doors, events, nearby towns locals name. No wiki census. Bullets + https (verify only).`,
  );
}

function webSearchCountryIso(location) {
  const upper = location.toUpperCase();
  if (/\b(CANADA|,\s*MB\b|,\s*ON\b|,\s*BC\b|,\s*AB\b|,\s*SK\b|,\s*QC\b)/.test(upper)) return "CA";
  if (/\b(USA|,\s*US\b)/.test(upper)) return "US";
  return undefined;
}

function webSearchCity(location) {
  return location.split(",")[0]?.trim() || undefined;
}

function buildTask(cfg, input) {
  const task = {
    model_name: cfg.model_name,
    user_prompt: buildUserPrompt({
      platformLabel: cfg.label,
      keyword: input.keyword,
      location: input.location,
      articleUrl: input.articleUrl,
      siteName: input.siteName,
      mode: input.mode,
      auditQuestions: input.auditQuestions,
      seoResearchBrief: input.seoResearchBrief,
    }),
    system_message:
      input.mode === "article" ? buildArticleSystemMessage() : clip(SERP_SYSTEM_MESSAGE),
    web_search: true,
    max_output_tokens: input.mode === "article" ? 4096 : 2048,
  };
  if (cfg.force_web_search) task.force_web_search = true;
  const iso = webSearchCountryIso(input.location);
  const city = webSearchCity(input.location);
  if (cfg.web_search_country_iso_code !== false && iso) task.web_search_country_iso_code = iso;
  if (cfg.web_search_city !== false && city) task.web_search_city = city;
  return task;
}

function extractResult(platform, label, model_name, dfsJson) {
  const base = { platform, label, model_name, status: "error" };
  const task = dfsJson?.tasks?.[0];
  if (!task) return { ...base, error: dfsJson?.status_message || "No task" };
  if (task.status_code !== 20000) return { ...base, error: task.status_message || `Status ${task.status_code}` };

  const result0 = task.result?.[0];
  if (!result0) return { ...base, error: "No result" };

  const textParts = [];
  const annotations = [];
  for (const item of result0.items ?? []) {
    if (item?.type === "message" && Array.isArray(item.sections)) {
      for (const sec of item.sections) {
        if (sec?.type === "text" && sec.text?.trim()) textParts.push(sec.text.trim());
      }
    }
    for (const ann of item?.annotations ?? []) {
      if (ann?.url) annotations.push({ title: ann.title, url: ann.url });
    }
  }

  const responseText = textParts.join("\n\n").trim();
  const liveLinks = [
    ...new Set([
      ...annotations.map((a) => a.url).filter(Boolean),
      ...(responseText.match(/https:\/\/[^\s)\]"'<>]+/gi) ?? []).map((u) => u.replace(/[.,;:!?)]+$/, "")),
    ]),
  ];

  return {
    platform,
    label,
    model_name: result0.model_name || model_name,
    status: responseText ? "ok" : "error",
    webSearchUsed: result0.web_search === true || annotations.length > 0 || liveLinks.length > 0,
    responseText: responseText || undefined,
    annotations: annotations.length ? annotations : undefined,
    liveLinks: liveLinks.length ? liveLinks : undefined,
    input_tokens: result0.input_tokens,
    output_tokens: result0.output_tokens,
    cost: task.cost,
    error: responseText ? undefined : "No message text",
  };
}

async function callPlatform(auth, cfg, input) {
  const started = Date.now();
  const task = buildTask(cfg, input);
  const res = await fetch(`https://api.dataforseo.com/v3/${cfg.path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([task]),
  });
  const dfsJson = await res.json().catch(() => ({}));
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const extracted = extractResult(cfg.platform, cfg.label, cfg.model_name, dfsJson);
  return { elapsedSec: elapsed, httpStatus: res.status, task, raw: dfsJson, extracted };
}

const env = loadDotEnv();
const login = env.DATAFORSEO_API_LOGIN || env.DATAFORSEO_LOGIN || "";
const pass = env.DATAFORSEO_API_PASSWORD || env.DATAFORSEO_PASSWORD || "";
if (!login || !pass) {
  console.error("Missing DATAFORSEO_API_LOGIN / DATAFORSEO_API_PASSWORD in .env");
  process.exit(1);
}

const args = parseArgs(process.argv);
const auth = Buffer.from(`${login}:${pass}`).toString("base64");

console.log("=== LLM Audit Probe ===");
console.log("Mode:", args.mode);
console.log("Keyword:", args.keyword);
if (args.articleUrl) console.log("Article URL:", args.articleUrl);
console.log("Site:", args.site);
console.log("Location:", args.location);
console.log("");

const results = await Promise.all(
  PLATFORM_CONFIG.map((cfg) => callPlatform(auth, cfg, args)),
);

for (const r of results) {
  const e = r.extracted;
  console.log(`--- ${e.label} (${e.platform}) ---`);
  console.log(`HTTP ${r.httpStatus} | ${r.elapsedSec}s | status: ${e.status} | webSearchUsed: ${e.webSearchUsed}`);
  if (e.error) console.log("Error:", e.error);
  if (e.liveLinks?.length) {
    console.log("liveLinks:", e.liveLinks.length);
    for (const u of e.liveLinks) console.log(" ", u);
  }
  console.log("");
  console.log(e.responseText || "(no response text)");
  console.log("\n");
}

mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "llm-audit-probe.json");
writeFileSync(
  outPath,
  JSON.stringify(
    {
      args,
      results: results.map((r) => ({
        ...r,
        raw: r.raw,
      })),
    },
    null,
    2,
  ),
);
console.log("Wrote:", outPath);
