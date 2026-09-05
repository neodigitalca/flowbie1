const HTML_AUDIT_MODEL = "google/gemini-2.5-flash";
const MAX_HTML_CHARS = 16_000;

function pickOpenRouterKey(env) {
  return String(
    env?.OPENROUTER_API_KEY ??
      env?.NEO_PULSE_APP_OPENROUTER_API_KEY ??
      env?.OPEN_ROUTER_API_KEY ??
      "",
  ).trim();
}

function pickAuditModel(env) {
  return String(
    env?.BROWSER_AUTOMATION_AUDIT_MODEL ??
      env?.BROWSER_AUTOMATION_VISION_MODEL ??
      env?.OPENROUTER_MODEL ??
      HTML_AUDIT_MODEL,
  ).trim();
}

/** @param {import("puppeteer").Page} page */
export async function collectHtmlAuditSignals(page) {
  const html = await page.content();
  const signals = await page.evaluate(() => {
    const meta = (name) =>
      document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute("content") ?? "";
    const canonical =
      document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "";
    const h1s = [...document.querySelectorAll("h1")].map((el) => (el.textContent ?? "").trim()).filter(Boolean);
    const bodyText = (document.body?.innerText ?? "").trim();
    return {
      title: document.title ?? "",
      h1: h1s[0] ?? "",
      h1Count: h1s.length,
      metaDescription: meta("description") || meta("og:description"),
      canonical,
      lang: document.documentElement.getAttribute("lang") ?? "",
      bodyTextLength: bodyText.length,
      scriptCount: document.querySelectorAll("script").length,
      iframeCount: document.querySelectorAll("iframe").length,
    };
  });
  return {
    html: html.slice(0, MAX_HTML_CHARS),
    signals,
  };
}

function parseAuditJson(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** @param {Record<string, unknown>} signals @param {number} httpStatus @param {boolean} httpOk */
export function auditHtmlFromSignals(signals, httpStatus, httpOk) {
  const issues = [];
  if (!httpOk || httpStatus < 200 || httpStatus >= 400) {
    issues.push({
      category: "http_error",
      severity: "high",
      location: "server",
      htmlSnippet: String(signals.title ?? ""),
      fixRecommendation: `Resolve HTTP ${httpStatus || "error"} for this URL.`,
    });
  }
  if (!String(signals.title ?? "").trim()) {
    issues.push({
      category: "missing_title",
      severity: "high",
      location: "head",
      htmlSnippet: "",
      fixRecommendation: "Add a unique page title.",
    });
  }
  if (!String(signals.h1 ?? "").trim()) {
    issues.push({
      category: "missing_h1",
      severity: "medium",
      location: "body",
      htmlSnippet: "",
      fixRecommendation: "Add one clear H1 heading.",
    });
  }
  if (Number(signals.h1Count ?? 0) > 1) {
    issues.push({
      category: "multiple_h1",
      severity: "medium",
      location: "body",
      htmlSnippet: String(signals.h1 ?? ""),
      fixRecommendation: "Use a single H1 per page.",
    });
  }
  if (!String(signals.metaDescription ?? "").trim()) {
    issues.push({
      category: "missing_meta_description",
      severity: "medium",
      location: "head",
      htmlSnippet: "",
      fixRecommendation: "Add a meta description.",
    });
  }
  if (Number(signals.bodyTextLength ?? 0) < 80) {
    issues.push({
      category: "thin_content",
      severity: "low",
      location: "body",
      htmlSnippet: "",
      fixRecommendation: "Add more visible page content.",
    });
  }

  const htmlOk = issues.filter((issue) => issue.category !== "http_error").length === 0 && httpOk;
  return {
    htmlOk,
    httpOk,
    issues,
    fixPlan: issues.map((issue, index) => `${index + 1}. ${issue.fixRecommendation}`).join("\n"),
    summary:
      issues.length === 0
        ? "Page passed signal-based HTML and HTTP checks."
        : `Found ${issues.length} HTML or HTTP issue(s) via signal-based audit.`,
  };
}

async function requestHtmlAuditJson(input, model, apiKey) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca",
      "X-Title": "Flowbie Browser HTML Audit",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 2500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You audit HTML for basic SEO and markup quality. Return JSON with keys: " +
            "htmlOk (boolean), httpOk (boolean), issues (array), fixPlan (string), summary (string). " +
            "Each issue: category, severity (high|medium|low), location, htmlSnippet, fixRecommendation.",
        },
        {
          role: "user",
          content: JSON.stringify({
            url: input.url,
            httpStatus: input.httpStatus,
            httpOk: input.httpOk,
            signals: input.signals,
            htmlPreview: input.html,
          }),
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenRouter HTML audit failed (${res.status}): ${detail.slice(0, 400)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/**
 * @param {{ html: string, signals: Record<string, unknown>, url: string, httpStatus: number, httpOk: boolean, env: Record<string, string> }} input
 */
export async function auditHtmlWithOpenRouter(input) {
  const apiKey = pickOpenRouterKey(input.env);
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY for HTML audit.");
  }
  const model = pickAuditModel(input.env);

  let content = "";
  try {
    content = await requestHtmlAuditJson(input, model, apiKey);
  } catch {
    return auditHtmlFromSignals(input.signals, input.httpStatus, input.httpOk);
  }

  let parsed = parseAuditJson(content);
  if (!parsed) {
    try {
      content = await requestHtmlAuditJson(input, model, apiKey);
      parsed = parseAuditJson(content);
    } catch {
      parsed = null;
    }
  }

  if (!parsed) {
    return auditHtmlFromSignals(input.signals, input.httpStatus, input.httpOk);
  }

  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  return {
    htmlOk: Boolean(parsed.htmlOk),
    httpOk: Boolean(parsed.httpOk ?? input.httpOk),
    issues,
    fixPlan: String(parsed.fixPlan ?? ""),
    summary: String(parsed.summary ?? ""),
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** @param {{ issues: Array<Record<string, unknown>>, url: string, httpStatus: number }} input */
export function issuesToCsv(input) {
  const header = [
    "url",
    "http_status",
    "audit_passed",
    "issue_id",
    "category",
    "severity",
    "location",
    "html_snippet",
    "fix_recommendation",
  ].join(",");
  const rows = input.issues.map((issue, index) =>
    [
      input.url,
      input.httpStatus,
      "false",
      index + 1,
      issue.category,
      issue.severity,
      issue.location,
      issue.htmlSnippet,
      issue.fixRecommendation,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header, ...rows].join("\n");
}

/** @param {{ summary: string, fixPlan: string, url: string, httpStatus: number, passed: boolean }} input */
export function buildFixPlanMarkdown(input) {
  const status = input.passed ? "PASSED" : "FAILED";
  return [
    `# HTML audit ${status}`,
    "",
    `URL: ${input.url}`,
    `HTTP status: ${input.httpStatus}`,
    "",
    "## Summary",
    input.summary,
    "",
    "## Fix plan",
    input.fixPlan || "No fixes required.",
  ].join("\n");
}

export function urlSlugFromString(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host.replace(/[^a-zA-Z0-9.-]+/g, "-").toLowerCase() || "page";
  } catch {
    return "page";
  }
}
