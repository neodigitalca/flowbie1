/**
 * End-to-end verify: post creator worker reaches ideation via Vite :8080 only.
 * Usage: node scripts/verify-post-creator-worker.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = "http://localhost:8080/api";
const VITE_ORIGIN = "http://localhost:8080";
const loginPath = path.join(process.cwd(), ".cursor-tmp-login.json");
const SITE_ID = "wp-1770232833963-7";
const POLL_MS = 2000;
const MAX_TICKS = 90;

const IDEATION_LABEL_RE =
  /GSC|ideation|Senior SEO|Loading GSC|Loading content bucket|OpenRouter returned|blog ideas|Creating \d+ posts?/i;
const FETCH_FAILED_RE =
  /fetch failed|Post creator API fetch failed|Failed to parse URL from \/api\/|OpenRouter returned 0\/\d+ blog ideas/i;
const TRANSPORT_OK_FAILURE_RE =
  /OpenRouter returned|blog ideas|GSC|ideation|cannibalization|DataForSEO|WordPress credentials/i;

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function assertViteUp() {
  try {
    const res = await fetch(VITE_ORIGIN, { method: "GET" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Vite is not reachable at ${VITE_ORIGIN}: ${detail}`);
  }
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
  return { res, data, url };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkpointPhase(run) {
  const server = run?.result?.checkpoint?.server;
  return typeof server?.phase === "string" ? server.phase : "";
}

function stepLabel(run) {
  return typeof run?.step?.label === "string" ? run.step.label : "";
}

function readJobStderr(jobId) {
  const jobsDir = path.join(os.tmpdir(), "flowbie-post-creator-jobs");
  const progressPath = path.join(jobsDir, `${jobId}.jsonl`);
  if (!fs.existsSync(progressPath)) {
    return "";
  }
  const lines = fs.readFileSync(progressPath, "utf8").trim().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const row = JSON.parse(lines[i]);
      if (row.type === "error" && row.error) return String(row.error);
      if (row.type === "step" && FETCH_FAILED_RE.test(String(row.label ?? ""))) {
        return String(row.label);
      }
    } catch {
      // skip malformed lines
    }
  }
  return lines.slice(-5).join("\n");
}

const BLOG_IDEAS_MISMATCH_RE = /OpenRouter returned \d+\/(\d+) blog ideas/i;
const CONTRACT_POST_COUNT = 1;

function assertBlogIdeasCountMatchesContract(message) {
  const match = BLOG_IDEAS_MISMATCH_RE.exec(message ?? "");
  if (!match) return;
  const asked = Number(match[1]);
  if (Number.isFinite(asked) && asked !== CONTRACT_POST_COUNT) {
    throw new Error(
      `Ideation asked for ${asked} ideas but contract postCount is ${CONTRACT_POST_COUNT}.`,
    );
  }
}

function reachedIdeation(run) {
  const label = stepLabel(run);
  const phase = checkpointPhase(run);
  const errorMessage = typeof run?.errorMessage === "string" ? run.errorMessage : "";
  if (IDEATION_LABEL_RE.test(label)) return true;
  if (phase === "ideation" || phase === "bulk") return true;
  if (run.status === "done") return true;
  if (
    run.status === "failed" &&
    (TRANSPORT_OK_FAILURE_RE.test(errorMessage) || TRANSPORT_OK_FAILURE_RE.test(label))
  ) {
    return true;
  }
  return false;
}

async function main() {
  await assertViteUp();

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

  const create = await api("/agent-runs", {
    method: "POST",
    token,
    body: {
      teamId,
      source: "workflow",
      recipeKey: "post_creator",
      title: "Post creator worker verify",
      context: { siteId: SITE_ID },
      plan: {
        executionMode: "server",
        executionPayload: {
          siteId: SITE_ID,
          keywordSource: "gsc",
          postCount: 1,
        },
      },
    },
  });

  if (!create.data.ok || !create.data.run?.id) {
    throw new Error(
      `Create agent run failed (${create.res.status}): ${create.data.error ?? JSON.stringify(create.data)}`,
    );
  }

  const runId = create.data.run.id;
  let run = create.data.run;
  let workerJobId = "";

  for (let tick = 0; tick < MAX_TICKS; tick += 1) {
    const processed = await api(`/agent-runs/${runId}/process`, {
      method: "POST",
      token,
      body: { teamId },
    });
    if (!processed.data.ok || !processed.data.run) {
      throw new Error(
        `Process tick failed (${processed.res.status}): ${processed.data.error ?? JSON.stringify(processed.data)}`,
      );
    }
    run = processed.data.run;

    const label = stepLabel(run);
    if (FETCH_FAILED_RE.test(label)) {
      throw new Error(label);
    }

    const phase = checkpointPhase(run);
    if (!workerJobId && run.result?.checkpoint?.server?.workerJobId) {
      workerJobId = String(run.result.checkpoint.server.workerJobId);
    }

    if (reachedIdeation(run)) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            teamId,
            runId,
            status: run.status,
            phase,
            stepLabel: label,
            workerJobId: workerJobId || undefined,
            ticks: tick + 1,
            transportVerified: true,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (run.status === "failed") {
      assertBlogIdeasCountMatchesContract(run.errorMessage || label);
      throw new Error(run.errorMessage || label || "Post creator run failed.");
    }

    if (phase === "worker_poll" || phase === "worker_dispatch" || label.includes("worker")) {
      if (workerJobId) {
        const stderr = readJobStderr(workerJobId);
        if (stderr && FETCH_FAILED_RE.test(stderr)) {
          throw new Error(stderr);
        }
      }
    }

    await sleep(POLL_MS);
  }

  const detail = workerJobId ? readJobStderr(workerJobId) : "";
  throw new Error(
    detail ||
      `Timed out after ${MAX_TICKS} ticks. Last label: "${stepLabel(run) || "none"}", phase: "${checkpointPhase(run) || "none"}".`,
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }, null, 2));
  process.exit(1);
});
