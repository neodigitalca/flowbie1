/**
 * End-to-end verify: create agent run + resolve editorial_month counts.
 * Usage: node scripts/verify-content-gap-agent-run.mjs
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:8080/api";
const loginPath = path.join(process.cwd(), ".cursor-tmp-login.json");
const sitesPath = path.join(process.cwd(), ".cursor-tmp-flowbie-sites.json");
const SITE_ID = "wp-1785273894795-0";

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function api(pathname, { method = "GET", token, body } = {}) {
  const url = `${BASE}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Non-JSON ${res.status} from ${url}: ${raw.slice(0, 200)}`);
  }
  return { res, data };
}

function monthBounds(monthKey) {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const monthIndex = Number.parseInt(monthRaw, 10) - 1;
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const endExclusive = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  return { after: start.toISOString(), before: endExclusive.toISOString() };
}

async function main() {
  const { email, password } = readJson(loginPath);
  const login = await api("/auth/login", {
    method: "POST",
    body: { username: email, email, password },
  });
  if (!login.data.ok) {
    throw new Error(`Login failed: ${login.data.error ?? login.res.status}`);
  }
  const token = login.data.sessionToken;
  if (!token) throw new Error("Login succeeded but no sessionToken");

  const me = await api(`/auth/me?_=${Date.now()}`, { token });
  const teamId = me.data.activeTeam?.id ?? me.data.teams?.[0]?.id;
  if (!teamId) throw new Error("No team id from auth/me");

  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const create = await api("/agent-runs", {
    method: "POST",
    token,
    body: {
      teamId,
      source: "workflow",
      recipeKey: "content_gap_check",
      title: "Content gap check verify",
      context: { siteId: SITE_ID },
      plan: {
        executionKind: "content_gap_check",
        executionPayload: {
          contentGapSitemapSource: "posts",
          contentGapCountMode: "editorial_month",
          contentGapCountMonth: monthKey,
          contentGapTargetCount: 4,
        },
      },
    },
  });

  if (!create.data.ok || !create.data.run?.id) {
    throw new Error(
      `Create agent run failed (${create.res.status}): ${create.data.error ?? JSON.stringify(create.data)}`,
    );
  }

  const sitesPayload = readJson(sitesPath);
  const site = sitesPayload.sites?.find((item) => item.id === SITE_ID);
  if (!site) throw new Error(`Site ${SITE_ID} not found in flowbie sites json`);

  const bounds = monthBounds(monthKey);
  const counts = await api("/wordpress/get-quarter-editorial-counts", {
    method: "POST",
    token,
    body: {
      siteUrl: site.siteUrl,
      username: site.username,
      appPassword: site.appPassword,
      after: bounds.after,
      before: bounds.before,
      entitySitemapUrl: site.entitySitemapUrl,
    },
  });
  if (!counts.data.ok) {
    throw new Error(`Editorial counts failed: ${counts.data.error ?? JSON.stringify(counts.data)}`);
  }

  const scheduled = counts.data.postsScheduled;
  const published = counts.data.postsPublished;
  if (typeof scheduled !== "number" || typeof published !== "number") {
    throw new Error(`Post counts unavailable: ${JSON.stringify(counts.data)}`);
  }
  const currentCount = scheduled + published;
  const targetCount = 4;
  const gapCount = Math.max(0, targetCount - currentCount);
  const goalMet = gapCount === 0;

  console.log(
    JSON.stringify(
      {
        ok: true,
        teamId,
        runId: create.data.run.id,
        recipeKey: create.data.run.recipeKey,
        status: create.data.run.status,
        monthKey,
        scheduled,
        published,
        currentCount,
        targetCount,
        gapCount,
        goalMet,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }, null, 2));
  process.exit(1);
});
