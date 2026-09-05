import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveEnv } from "./research/chatgpt-audit/lib.mjs";
import {
  isProxyConfigured,
  probeResidentialProxy,
  proxyConfigFromEnv,
  resolveResidentialProxyEnv,
} from "./research/residential-proxy/lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(__dirname, "..");
export const sessionScript = path.join(repoRoot, "scripts", "research", "browser-automation", "run-session.mjs");
export const jobsDir = process.env.BROWSER_AUTOMATION_JOBS_DIR || path.join(os.tmpdir(), "flowbie-browser-automation-jobs");

/** @type {Map<string, { child: import("node:child_process").ChildProcess | null, exitCode: number | null, progressPath: string, controlPath: string }>} */
const activeJobs = new Map();

export function parseProgressFile(progressPath) {
  if (!fs.existsSync(progressPath)) {
    return { status: "running", label: "Starting" };
  }

  const lines = fs.readFileSync(progressPath, "utf8").split(/\r?\n/).filter(Boolean);
  let label = "Starting";
  let screenshotBase64 = null;
  let result = null;
  let error = null;
  let status = "running";
  /** @type {Record<string, unknown> | null} */
  let deliverable = null;

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
    }
    if (data.type === "deliverable") {
      deliverable = {
        filename: data.filename,
        label: data.label,
        mime: data.mime,
        kind: data.kind,
        content: data.content,
        base64: data.base64,
        url: data.url,
        rowIndex: data.rowIndex,
        rowTotal: data.rowTotal,
      };
    }
    if (data.type === "done") {
      status = "done";
      result = data.summary ?? data;
    }
    if (data.type === "error") {
      status = "error";
      error = data.message || "Browser automation failed.";
      label = error;
    }
  }

  return { status, label, screenshotBase64, result, error, deliverable };
}

function ensureJobsDir() {
  fs.mkdirSync(jobsDir, { recursive: true });
}

function jobPaths(jobId) {
  const base = path.join(jobsDir, jobId);
  return {
    progressPath: `${base}.jsonl`,
    instructionsPath: `${base}-instructions.html`,
    controlPath: `${base}-control.json`,
    metaPath: `${base}.meta.json`,
  };
}

export function startJob(input) {
  if (!fs.existsSync(sessionScript)) {
    return {
      ok: false,
      error: "Browser automation script is missing in the repo.",
      code: "BROWSER_AUTOMATION_EXEC_BLOCKED",
    };
  }

  ensureJobsDir();
  const jobId = crypto.randomUUID();
  const paths = jobPaths(jobId);
  fs.writeFileSync(paths.progressPath, "", "utf8");
  fs.writeFileSync(paths.instructionsPath, String(input.browserInstructionsHtml ?? ""), "utf8");
  fs.writeFileSync(
    paths.metaPath,
    JSON.stringify({
      jobId,
      targetUrl: input.targetUrl ?? "",
      startedAt: new Date().toISOString(),
    }),
  );

  const args = [
    sessionScript,
    "--json",
    "--progress-file",
    paths.progressPath,
    "--url",
    input.targetUrl ?? "",
    "--instructions-file",
    paths.instructionsPath,
  ];

  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env: { ...process.env, ...resolveEnv(), ...resolveResidentialProxyEnv() },
  });

  activeJobs.set(jobId, {
    child,
    exitCode: null,
    progressPath: paths.progressPath,
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

export function writeControl(jobId, action) {
  const entry = activeJobs.get(jobId);
  const paths = jobPaths(jobId);
  const controlPath = entry?.controlPath ?? paths.controlPath;
  if (!entry && !fs.existsSync(paths.progressPath)) {
    return { ok: false, error: "Job not found." };
  }
  fs.writeFileSync(controlPath, JSON.stringify({ action, at: new Date().toISOString() }), "utf8");
  if (action === "cancel" && entry?.child) {
    entry.child.kill("SIGTERM");
  }
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
      result: parsed.result,
      deliverable: parsed.deliverable,
    };
  }

  if (parsed.status === "error") {
    activeJobs.delete(jobId);
    return {
      ok: true,
      status: "error",
      label: parsed.label,
      screenshotBase64: parsed.screenshotBase64,
      error: parsed.error,
      deliverable: parsed.deliverable,
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
      error: parsed.error || "Browser automation process exited unexpectedly.",
    };
  }

  return {
    ok: true,
    status: "running",
    label: parsed.label,
    screenshotBase64: parsed.screenshotBase64,
    deliverable: parsed.deliverable,
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
  const expected = (process.env.BROWSER_AUTOMATION_WORKER_AUTH_TOKEN || process.env.LD_WORKER_AUTH_TOKEN || "").trim();
  if (!expected) return true;
  const header = String(req.headers.authorization || "").trim();
  if (header === `Bearer ${expected}`) return true;
  const alt = String(req.headers["x-browser-automation-worker-token"] || req.headers["x-ld-worker-token"] || "").trim();
  return alt === expected;
}

export async function handleResidentialProxyStatusRequest(req, res, pathname) {
  if ((req.method ?? "GET") !== "GET" || pathname.replace(/\/+$/, "") !== "/residential-proxy/status") {
    return false;
  }
  if (!checkWorkerAuth(req)) {
    sendJson(res, 401, { ok: false, error: "Unauthorized." });
    return true;
  }
  const env = resolveResidentialProxyEnv();
  const config = proxyConfigFromEnv(env);
  if (!isProxyConfigured(env)) {
    sendJson(res, 200, {
      ok: false,
      configured: false,
      host: config.host,
      port: config.port,
    });
    return true;
  }
  if (req.headers["x-probe"] === "1") {
    sendJson(res, 200, await probeResidentialProxy({ env }));
    return true;
  }
  sendJson(res, 200, {
    ok: true,
    configured: true,
    host: config.host,
    port: config.port,
    username: config.username.replace(/(.{2}).+/, "$1***"),
  });
  return true;
}

export async function handleBrowserAutomationRequest(req, res, pathname) {
  const url = pathname.replace(/\/+$/, "");
  const method = req.method ?? "GET";

  const jobMatch = url.match(/^\/browser-automation\/jobs\/([a-f0-9-]{8,64})$/i);
  if (method === "GET" && jobMatch) {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }
    sendJson(res, 200, readJobProgress(jobMatch[1].toLowerCase()));
    return true;
  }

  const cancelMatch = url.match(/^\/browser-automation\/jobs\/([a-f0-9-]{8,64})\/cancel$/i);
  if (method === "POST" && cancelMatch) {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }
    sendJson(res, 200, writeControl(cancelMatch[1].toLowerCase(), "cancel"));
    return true;
  }

  if (method === "POST" && url === "/browser-automation/jobs") {
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

    const targetUrl = String(body.targetUrl ?? "").trim();
    const browserInstructionsHtml = String(body.browserInstructionsHtml ?? "").trim();
    if (!targetUrl) {
      sendJson(res, 400, { ok: false, error: "Missing required field: targetUrl" });
      return true;
    }
    if (!browserInstructionsHtml) {
      sendJson(res, 400, { ok: false, error: "Missing required field: browserInstructionsHtml" });
      return true;
    }

    const started = startJob({ targetUrl, browserInstructionsHtml });
    sendJson(res, started.ok ? 200 : 500, started);
    return true;
  }

  return false;
}
