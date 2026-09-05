const SEARCH_ENGINE_HOSTS = [
  "google.com",
  "google.ca",
  "google.co.uk",
  "bing.com",
  "duckduckgo.com",
  "yahoo.com",
];

const PROXY_FIRST_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "gemini.google.com",
  "semrush.com",
  "ahrefs.com",
  "moz.com",
  "yelp.com",
  "yellowpages.com",
  "bbb.org",
  "facebook.com",
  "linkedin.com",
  "accounts.google.com",
];

const SEARCH_INSTRUCTION_PATTERN =
  /\b(search|google|look up|find|query)\b.{0,40}\b(for|about|on)\b/i;

function canonicalHost(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostMatchesList(host, list) {
  if (!host) return false;
  return list.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function classifyHost(host) {
  if (hostMatchesList(host, SEARCH_ENGINE_HOSTS)) return "search_engine";
  if (hostMatchesList(host, PROXY_FIRST_HOSTS)) {
    if (/chatgpt|openai|gemini/.test(host)) return "ai_platform";
    if (/semrush|ahrefs|moz/.test(host)) return "seo_tool";
    return "citation";
  }
  return "unknown";
}

function instructionsImplySearch(instructionsText) {
  return SEARCH_INSTRUCTION_PATTERN.test(String(instructionsText ?? ""));
}

function pickOpenRouterKey(env) {
  return String(
    env.OPENROUTER_API_KEY ??
      env.NEO_PULSE_APP_OPENROUTER_API_KEY ??
      env.OPEN_ROUTER_API_KEY ??
      "",
  ).trim();
}

function pickPlannerModel(env) {
  return String(
    env.BROWSER_AUTOMATION_PLANNER_MODEL ??
      env.OPENROUTER_MODEL ??
      env.NEO_PULSE_APP_OPENROUTER_MODEL ??
      "google/gemini-2.5-flash",
  ).trim();
}

/**
 * @param {string} instructionsText
 * @param {Record<string, string>} env
 */
async function extractSearchIntentOpenRouter(instructionsText, env) {
  const apiKey = pickOpenRouterKey(env);
  if (!apiKey) return null;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca",
      "X-Title": "Flowbie Browse Policy",
    },
    body: JSON.stringify({
      model: pickPlannerModel(env),
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract browse routing from user browser automation instructions. " +
            "Return JSON: { \"needsWebSearch\": boolean, \"searchQuery\": string, \"locationHint\": string, \"rationale\": string }. " +
            "needsWebSearch is true when the user wants Google/Bing/web search results. " +
            "searchQuery is the keyword phrase only (no site names). locationHint is optional city/region.",
        },
        { role: "user", content: instructionsText },
      ],
    }),
  });
  if (!res.ok) return null;

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.needsWebSearch) return null;
    const searchQuery = String(parsed.searchQuery ?? "").trim();
    if (!searchQuery) return null;
    return {
      searchQuery,
      locationHint: String(parsed.locationHint ?? "").trim() || undefined,
      rationale: String(parsed.rationale ?? "OpenRouter search intent").trim(),
    };
  } catch {
    return null;
  }
}

/**
 * @param {{ targetUrl: string, instructionsText: string, env?: Record<string, string> }} input
 */
export async function planBrowsePolicy(input) {
  const targetUrl = String(input.targetUrl ?? "").trim();
  const instructionsText = String(input.instructionsText ?? "").trim();
  const host = canonicalHost(targetUrl);
  const hostCategory = classifyHost(host);
  const env = input.env ?? {};

  let searchQuery;
  let locationHint;
  let searchRationale;

  if (hostCategory === "search_engine" && instructionsImplySearch(instructionsText)) {
    const llm = await extractSearchIntentOpenRouter(instructionsText, env);
    if (llm) {
      searchQuery = llm.searchQuery;
      locationHint = llm.locationHint;
      searchRationale = llm.rationale;
    } else {
      const quoted = instructionsText.match(/["']([^"']{3,120})["']/);
      searchQuery = quoted?.[1]?.trim() || instructionsText.replace(/.*\bfor\b/i, "").trim().slice(0, 120);
      searchRationale = "Search engine host + search instructions (rule match)";
    }
  } else if (instructionsImplySearch(instructionsText)) {
    const llm = await extractSearchIntentOpenRouter(instructionsText, env);
    if (llm) {
      searchQuery = llm.searchQuery;
      locationHint = llm.locationHint;
      searchRationale = llm.rationale;
    }
  }

  if (searchQuery) {
    return {
      route: "serp_api",
      searchQuery,
      locationHint,
      hostCategory: hostCategory === "search_engine" ? "search_engine" : "unknown",
      rationale: searchRationale || "Web search intent detected; route to DataForSEO SERP API",
    };
  }

  if (hostMatchesList(host, PROXY_FIRST_HOSTS)) {
    return {
      route: "browser_proxy",
      hostCategory,
      rationale: `Known bot-sensitive host (${host}); start with residential proxy`,
    };
  }

  return {
    route: "browser_direct",
    hostCategory: hostCategory === "unknown" ? "client_web" : hostCategory,
    rationale: "Default direct browse; preflight probe decides proxy escalation",
  };
}
