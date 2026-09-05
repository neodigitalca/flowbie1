import { loadEnv as loadRootEnv } from "../chatgpt-audit/lib.mjs";
import { repoRoot } from "../residential-proxy/lib.mjs";

function loadDataForSeoAuth() {
  const env = {
    ...loadRootEnv(`${repoRoot}/.env`),
    ...loadRootEnv(`${repoRoot}/.env.local`),
    ...loadRootEnv(`${repoRoot}/.env.development`),
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (value && !(key in env)) env[key] = value;
  }
  const login = String(env.DATAFORSEO_API_LOGIN ?? env.DATAFORSEO_LOGIN ?? "").trim();
  const pass = String(env.DATAFORSEO_API_PASSWORD ?? env.DATAFORSEO_PASSWORD ?? "").trim();
  if (!login || !pass) return null;
  return Buffer.from(`${login}:${pass}`).toString("base64");
}

function compactOrganic(items) {
  const list = Array.isArray(items) ? items : [];
  return list.slice(0, 10).map((item) => ({
    title: String(item?.title ?? "").trim(),
    url: String(item?.url ?? "").trim(),
    snippet: String(item?.description ?? item?.snippet ?? "").trim(),
  })).filter((row) => row.title || row.url);
}

/**
 * @param {{ query: string, location?: string }} input
 */
export async function fetchSerpOrganic(input) {
  const query = String(input.query ?? "").trim();
  if (!query) throw new Error("search_serp requires query");

  const auth = loadDataForSeoAuth();
  if (!auth) {
    throw new Error("Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD for search_serp.");
  }

  const location = String(input.location ?? "Canada").trim() || "Canada";
  const res = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        keyword: query,
        location_name: location,
        language_code: "en",
        depth: 10,
        people_also_ask_click_depth: 2,
      },
    ]),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`DataForSEO SERP failed (${res.status}): ${detail.slice(0, 400)}`);
  }

  const data = await res.json();
  const task = data?.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(`DataForSEO SERP task error: ${task.status_message ?? task.status_code}`);
  }

  const result = task?.result?.[0] ?? {};
  const organic = compactOrganic(result?.items?.filter((i) => i?.type === "organic") ?? result?.items);
  const paa = (result?.items ?? [])
    .filter((i) => i?.type === "people_also_ask")
    .flatMap((i) => i?.items ?? [])
    .slice(0, 5)
    .map((row) => String(row?.title ?? row?.question ?? "").trim())
    .filter(Boolean);

  return {
    query,
    location,
    organic,
    peopleAlsoAsk: paa,
    related: [],
    fetchedAt: new Date().toISOString(),
  };
}
