/**
 * E2E verify: open workflow editor, click Test, poll until GSC + Then + RAG outputs exist.
 *
 * Usage:
 *   WORKFLOW_ID=123 node scripts/verify-workflow-test-run.mjs
 *   WORKFLOW_NAME_MATCH="Advance Blinds" node scripts/verify-workflow-test-run.mjs
 *
 * Requires: localhost:8080, .cursor-tmp-login.json
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const APP_BASE = process.env.VERIFY_APP_BASE ?? "http://localhost:8080";
const API_BASE = `${APP_BASE.replace(/\/+$/, "")}/api`;
const loginPath = path.join(process.cwd(), ".cursor-tmp-login.json");
const POLL_MS = 5_000;
const TIMEOUT_MS = Number(process.env.VERIFY_WORKFLOW_TIMEOUT_MS ?? 10 * 60 * 1000);
const WORKFLOW_ID = Number(process.env.WORKFLOW_ID ?? 0);
const WORKFLOW_NAME_MATCH = (process.env.WORKFLOW_NAME_MATCH ?? "").trim().toLowerCase();

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(pathname, { method = "GET", token, body } = {}) {
  const url = `${API_BASE}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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

function isExecutableNode(kind) {
  return kind === "action_agent" || kind === "then_google_drive" || kind === "rag_archive"
    || kind === "then_local" || kind === "then_email" || kind === "then_scheduled" || kind === "then_draft";
}

async function resolveWorkflowId(teamId, token) {
  if (WORKFLOW_ID > 0) return WORKFLOW_ID;
  const list = await api(`/teams/${teamId}/workflows`, { token });
  const workflows = list.data.workflows ?? [];
  if (!WORKFLOW_NAME_MATCH) {
    throw new Error("Set WORKFLOW_ID or WORKFLOW_NAME_MATCH");
  }
  const match = workflows.find((item) =>
    String(item.name ?? "").toLowerCase().includes(WORKFLOW_NAME_MATCH),
  );
  if (!match?.id) {
    throw new Error(`No workflow matching WORKFLOW_NAME_MATCH=${WORKFLOW_NAME_MATCH}`);
  }
  return match.id;
}

async function login() {
  const { email, password } = readJson(loginPath);
  const loginRes = await api("/auth/login", {
    method: "POST",
    body: { username: email, email, password },
  });
  if (!loginRes.data.ok) {
    throw new Error(`Login failed: ${loginRes.data.error ?? loginRes.res.status}`);
  }
  const token = loginRes.data.sessionToken;
  if (!token) throw new Error("Login succeeded but no sessionToken");
  const me = await api(`/auth/me?_=${Date.now()}`, { token });
  const teamId = me.data.activeTeam?.id ?? me.data.teams?.[0]?.id;
  if (!teamId) throw new Error("No team id from auth/me");
  return { token, teamId, email, password };
}

async function clickWorkflowTest(workflowId, auth) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${APP_BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.evaluate(
      ({ token, email, password }) => {
        sessionStorage.setItem("neo_pulse_session_token", token);
        localStorage.setItem(
          "neo-pulse_device_auth",
          JSON.stringify({ email, password, sessionToken: token }),
        );
      },
      auth,
    );
    const hashUrl = `${APP_BASE}/#/pulse-forge/workflows/${workflowId}`;
    await page.goto(hashUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll("button"));
        return buttons.some((btn) => btn.textContent?.trim() === "Test");
      },
      { timeout: 120_000 },
    );

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const test = buttons.find((btn) => btn.textContent?.trim() === "Test");
      if (!test) throw new Error("Test button missing");
      test.click();
    });

    await sleep(5_000);
  } finally {
    await browser.close();
  }
}

async function fetchLatestWorkflowRun(teamId, workflowId, token, sinceMs) {
  const res = await api(`/teams/${teamId}/workflows/${workflowId}/runs`, { token });
  const runs = (res.data.runs ?? []).filter((run) => {
    const created = Date.parse(String(run.createdAt ?? ""));
    return Number.isFinite(created) && created >= sinceMs - 5_000;
  });
  runs.sort((a, b) => Date.parse(String(b.createdAt ?? "")) - Date.parse(String(a.createdAt ?? "")));
  return runs[0] ?? null;
}

async function pollPipeline(teamId, workflowId, workflow, token, workflowRunId) {
  const requiredNodeIds = workflow.nodes.filter((node) => isExecutableNode(node.kind)).map((node) => node.id);
  const deadline = Date.now() + TIMEOUT_MS;
  let lastRunStatus = "";
  let lastOutputCount = 0;

  while (Date.now() < deadline) {
    const runRes = await api(`/teams/${teamId}/workflows/${workflowId}/runs/${workflowRunId}`, { token });
    const run = runRes.data.run;
    lastRunStatus = String(run?.status ?? "");

    const outputsRes = await api(
      `/teams/${teamId}/workflows/${workflowId}/runs/${workflowRunId}/outputs`,
      { token },
    );
    const outputs = outputsRes.data.outputs ?? [];
    lastOutputCount = outputs.length;
    const outputNodeIds = new Set(outputs.filter((item) => item.scope === "run").map((item) => item.nodeId));
    const missing = requiredNodeIds.filter((nodeId) => !outputNodeIds.has(nodeId));

    const agentRunsRes = await api(`/agent-runs?teamId=${teamId}`, { token });
    const agentRunList = Array.isArray(agentRunsRes.data.runs) ? agentRunsRes.data.runs : [];
    const workflowAgents = agentRunList.filter((item) => {
      const ctx = item.context ?? {};
      const plan = item.plan ?? {};
      return (
        item.source === "workflow"
        && Number(ctx.workflowRunId ?? plan.workflowRunId ?? 0) === workflowRunId
      );
    });

    if (missing.length === 0 && lastRunStatus === "done") {
      return {
        ok: true,
        runStatus: lastRunStatus,
        outputCount: outputs.length,
        agentRunCount: workflowAgents.length,
        agentRuns: workflowAgents.map((item) => ({ id: item.id, status: item.status, recipeKey: item.recipeKey })),
      };
    }

    if (lastRunStatus === "failed") {
      return {
        ok: false,
        stage: "workflow_run_failed",
        error: run?.errorMessage ?? "Workflow run failed",
        missingNodeIds: missing,
        outputCount: outputs.length,
      };
    }

    await sleep(POLL_MS);
  }

  return {
    ok: false,
    stage: "timeout",
    error: `Timed out after ${TIMEOUT_MS}ms (run=${lastRunStatus}, outputs=${lastOutputCount})`,
  };
}

async function main() {
  const startedAt = Date.now();
  const auth = await login();
  const workflowId = await resolveWorkflowId(auth.teamId, auth.token);
  const workflowRes = await api(`/teams/${auth.teamId}/workflows/${workflowId}`, { token: auth.token });
  const workflow = workflowRes.data.workflow;
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const hasAgent = workflow.nodes.some((node) => node.kind === "action_agent");
  const hasThen = workflow.nodes.some((node) => String(node.kind).startsWith("then_"));
  const hasRag = workflow.nodes.some((node) => node.kind === "rag_archive");
  if (!hasAgent || !hasThen || !hasRag) {
    throw new Error("Workflow must include action_agent, Then, and rag_archive steps");
  }

  console.log(`[verify] workflow ${workflowId} "${workflow.name}" — clicking Test in browser`);
  await clickWorkflowTest(workflowId, auth);

  let workflowRun = null;
  const runDeadline = Date.now() + 60_000;
  while (Date.now() < runDeadline) {
    workflowRun = await fetchLatestWorkflowRun(auth.teamId, workflowId, auth.token, startedAt);
    if (workflowRun?.id) break;
    await sleep(2_000);
  }
  if (!workflowRun?.id) {
    throw new Error("No workflow run created after clicking Test");
  }

  console.log(`[verify] workflow run ${workflowRun.id} status=${workflowRun.status}`);
  const result = await pollPipeline(auth.teamId, workflowId, workflow, auth.token, workflowRun.id);
  const summary = {
    ok: result.ok,
    workflowId,
    workflowRunId: workflowRun.id,
    elapsedMs: Date.now() - startedAt,
    ...result,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`[verify] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
