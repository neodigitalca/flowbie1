import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveEnv } from "./research/chatgpt-audit/lib.mjs";
import { isProxyConfigured, resolveResidentialProxyEnv } from "./research/residential-proxy/lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(__dirname, "..");
export const sessionScript = path.join(repoRoot, "scripts", "research", "chatgpt-audit", "run-session.mjs");
export const jobsDir = process.env.CHATGPT_AUDIT_JOBS_DIR || path.join(os.tmpdir(), "flowbie-chatgpt-audit-jobs");

/** @type {Map<string, { child: import("node:child_process").ChildProcess | null, exitCode: number | null, progressPath: string, queriesPath: string, controlPath: string }>} */
const activeJobs = new Map();

export function parseProgressFile(progressPath) {
  if (!fs.existsSync(progressPath)) {
    return { status: "running", label: "Starting", responses: [], sessionReady: false };
  }

  const lines = fs.readFileSync(progressPath, "utf8").split(/\r?\n/).filter(Boolean);
  let label = "Starting";
  let screenshotBase64 = null;
  let screenshotCapturedAt = null;
  let newChatReady = false;
  let newChatUrl = "";
  let result = null;
  let error = null;
  let status = "running";
  let sessionReady = false;
  /** @type {Array<Record<string, unknown>>} */
  const responses = [];

  for (const line of lines) {
    let data;
    try {
      data = JSON.parse(line);
    } catch {
      continue;
    }
    if (!data?.type) continue;
    if (data.type === "step" && data.label) label = data.label;
    if (data.type === "screenshot") {
      if (data.label) label = data.label;
      if (data.pngBase64) screenshotBase64 = data.pngBase64;
      if (data.capturedAt) screenshotCapturedAt = data.capturedAt;
    }
    if (data.type === "session_ready") sessionReady = true;
    if (data.type === "new_chat_ready") {
      newChatReady = true;
      newChatUrl = String(data.clientUrl ?? "").trim();
    }
    if (data.type === "query_response") {
      responses.push(data);
      label = `Reply saved (${responses.length})`;
    }
    if (data.type === "session_done") {
      status = "done";
      label = "Session complete";
      result = data.summary ?? data;
    }
    if (data.type === "done") {
      status = "done";
      label = "Session complete";
      result = data.summary ?? data;
    }
    if (data.type === "error") {
      status = "error";
      error = data.message || "ChatGPT audit session failed.";
      label = error;
    }
  }

  return {
    status,
    label,
    screenshotBase64,
    screenshotCapturedAt,
    newChatReady,
    newChatUrl,
    result,
    error,
    responses,
    sessionReady,
  };
}

function ensureJobsDir() {
  fs.mkdirSync(jobsDir, { recursive: true });
}

function jobPaths(jobId) {
  const base = path.join(jobsDir, jobId);
  return {
    progressPath: `${base}.jsonl`,
    queriesPath: `${base}-queries.jsonl`,
    controlPath: `${base}-control.json`,
    metaPath: `${base}.meta.json`,
  };
}

export function startJob(input) {
  if (!fs.existsSync(sessionScript)) {
    return {
      ok: false,
      error: "ChatGPT audit script is missing in the repo.",
      code: "CHATGPT_AUDIT_EXEC_BLOCKED",
    };
  }

  ensureJobsDir();
  const env = { ...resolveResidentialProxyEnv(), ...resolveEnv() };
  if (!isProxyConfigured(env)) {
    return {
      ok: false,
      error:
        "Residential proxy is required for ChatGPT audit. Configure OXYLABS_PROXY_USERNAME and OXYLABS_PROXY_PASSWORD in .env.residential-proxy.",
      code: "CHATGPT_AUDIT_PROXY_REQUIRED",
    };
  }

  const jobId = crypto.randomUUID();
  const paths = jobPaths(jobId);
  fs.writeFileSync(paths.progressPath, "", "utf8");
  fs.writeFileSync(paths.queriesPath, "", "utf8");
  fs.writeFileSync(
    paths.metaPath,
    JSON.stringify({
      jobId,
      clientName: input.clientName ?? "",
      clientUrl: input.clientUrl ?? "",
      startedAt: new Date().toISOString(),
    }),
  );

  const args = [
    sessionScript,
    "--json",
    "--progress-file",
    paths.progressPath,
    "--queries-file",
    paths.queriesPath,
    "--control-file",
    paths.controlPath,
    "--client-name",
    input.clientName ?? "",
    "--client-url",
    input.clientUrl ?? "",
  ];

  if (input.agentmailInbox) {
    args.push("--agentmail-inbox", input.agentmailInbox);
  }
  if (input.email) {
    args.push("--email", input.email);
  }

  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
  });

  activeJobs.set(jobId, {
    child,
    exitCode: null,
    progressPath: paths.progressPath,
    queriesPath: paths.queriesPath,
    controlPath: paths.controlPath,
  });

  child.on("close", (code) => {
    const entry = activeJobs.get(jobId);
    if (entry) {
      activeJobs.set(jobId, { ...entry, child: null, exitCode: code ?? 1 });
    }
  });

  return { ok: true, jobId };
}

export function appendQuery(jobId, text, clientUrl = "") {
  const entry = activeJobs.get(jobId);
  const paths = jobPaths(jobId);
  const queriesPath = entry?.queriesPath ?? paths.queriesPath;
  if (!fs.existsSync(queriesPath) && !entry) {
    return { ok: false, error: "Job not found." };
  }
  const id = crypto.randomUUID();
  fs.appendFileSync(
    queriesPath,
    `${JSON.stringify({
      id,
      text: String(text ?? "").trim(),
      clientUrl: String(clientUrl ?? "").trim(),
      enqueuedAt: new Date().toISOString(),
    })}\n`,
  );
  return { ok: true, queryId: id };
}

export function writeControl(jobId, action, extra = {}) {
  const entry = activeJobs.get(jobId);
  const paths = jobPaths(jobId);
  const controlPath = entry?.controlPath ?? paths.controlPath;
  if (!fs.existsSync(controlPath) && !entry && !fs.existsSync(paths.progressPath)) {
    return { ok: false, error: "Job not found." };
  }
  fs.writeFileSync(
    controlPath,
    JSON.stringify({ action, at: new Date().toISOString(), ...extra }),
    "utf8",
  );
  return { ok: true };
}

export function readJobProgress(jobId) {
  const entry = activeJobs.get(jobId);
  const paths = jobPaths(jobId);
  const progressPath = entry?.progressPath ?? paths.progressPath;
  if (!entry && !fs.existsSync(progressPath)) {
    return { ok: false, status: "error", error: "Job not found." };
  }

  const parsed = parseProgressFile(progressPath);
  if (parsed.status === "done") {
    activeJobs.delete(jobId);
    return {
      ok: true,
      status: "done",
      label: parsed.label,
      screenshotBase64: parsed.screenshotBase64,
      screenshotCapturedAt: parsed.screenshotCapturedAt,
      newChatReady: parsed.newChatReady,
      newChatUrl: parsed.newChatUrl,
      result: parsed.result,
      responses: parsed.responses,
      sessionReady: parsed.sessionReady,
    };
  }

  if (parsed.status === "error") {
    activeJobs.delete(jobId);
    return {
      ok: true,
      status: "error",
      label: parsed.label,
      screenshotBase64: parsed.screenshotBase64,
      screenshotCapturedAt: parsed.screenshotCapturedAt,
      newChatReady: parsed.newChatReady,
      newChatUrl: parsed.newChatUrl,
      error: parsed.error,
      responses: parsed.responses,
      sessionReady: parsed.sessionReady,
    };
  }

  const exitCode = entry?.exitCode ?? entry?.child?.exitCode ?? null;
  const running = Boolean(entry?.child && entry.child.exitCode === null);
  if (!running && entry && exitCode != null && exitCode !== 0) {
    activeJobs.delete(jobId);
    return {
      ok: true,
      status: "error",
      label: parsed.label,
      screenshotBase64: parsed.screenshotBase64,
      screenshotCapturedAt: parsed.screenshotCapturedAt,
      newChatReady: parsed.newChatReady,
      newChatUrl: parsed.newChatUrl,
      error: parsed.error || "ChatGPT audit process exited unexpectedly.",
      responses: parsed.responses,
      sessionReady: parsed.sessionReady,
    };
  }

  return {
    ok: true,
    status: "running",
    label: parsed.label,
    screenshotBase64: parsed.screenshotBase64,
    screenshotCapturedAt: parsed.screenshotCapturedAt,
    newChatReady: parsed.newChatReady,
    newChatUrl: parsed.newChatUrl,
    responses: parsed.responses,
    sessionReady: parsed.sessionReady,
  };
}

export function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export function checkWorkerAuth(req) {
  const expected = (process.env.CHATGPT_AUDIT_WORKER_AUTH_TOKEN || process.env.LD_WORKER_AUTH_TOKEN || "").trim();
  if (!expected) return true;
  const header = String(req.headers.authorization || "").trim();
  if (header === `Bearer ${expected}`) return true;
  const alt = String(req.headers["x-chatgpt-audit-worker-token"] || req.headers["x-ld-worker-token"] || "").trim();
  return alt === expected;
}

export async function handleChatGptAuditRequest(req, res, pathname) {
  const url = pathname.replace(/\/+$/, "");
  const method = req.method ?? "GET";

  const jobMatch = url.match(/^\/chatgpt-audit\/jobs\/([a-f0-9-]{8,64})$/i);
  if (method === "GET" && jobMatch) {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }
    sendJson(res, 200, readJobProgress(jobMatch[1].toLowerCase()));
    return true;
  }

  const queryMatch = url.match(/^\/chatgpt-audit\/jobs\/([a-f0-9-]{8,64})\/queries$/i);
  if (method === "POST" && queryMatch) {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }
    let body = {};
    try {
      const raw = await readRequestBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
      return true;
    }
    const text = String(body.text ?? "").trim();
    if (!text) {
      sendJson(res, 400, { ok: false, error: "Missing required field: text" });
      return true;
    }
    sendJson(res, 200, appendQuery(queryMatch[1].toLowerCase(), text, String(body.clientUrl ?? "").trim()));
    return true;
  }

  const finishMatch = url.match(/^\/chatgpt-audit\/jobs\/([a-f0-9-]{8,64})\/finish$/i);
  if (method === "POST" && finishMatch) {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }
    sendJson(res, 200, writeControl(finishMatch[1].toLowerCase(), "finish"));
    return true;
  }

  const newChatMatch = url.match(/^\/chatgpt-audit\/jobs\/([a-f0-9-]{8,64})\/new-chat$/i);
  if (method === "POST" && newChatMatch) {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }
    let body = {};
    try {
      const raw = await readRequestBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
      return true;
    }
    const clientUrl = String(body.clientUrl ?? "").trim();
    if (!clientUrl) {
      sendJson(res, 400, { ok: false, error: "Missing required field: clientUrl" });
      return true;
    }
    sendJson(res, 200, writeControl(newChatMatch[1].toLowerCase(), "new_chat", { clientUrl }));
    return true;
  }

  const cancelMatch = url.match(/^\/chatgpt-audit\/jobs\/([a-f0-9-]{8,64})\/cancel$/i);
  if (method === "POST" && cancelMatch) {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }
    sendJson(res, 200, writeControl(cancelMatch[1].toLowerCase(), "cancel"));
    return true;
  }

  if (method === "POST" && url === "/chatgpt-audit/jobs") {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }

    let body = {};
    try {
      const raw = await readRequestBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
      return true;
    }

    const started = startJob({
      clientName: String(body.clientName ?? "").trim(),
      clientUrl: String(body.clientUrl ?? "").trim(),
      agentmailInbox: String(body.agentmailInbox ?? "").trim(),
      email: String(body.email ?? "").trim(),
    });
    sendJson(res, started.ok ? 200 : 500, started);
    return true;
  }

  return false;
}
