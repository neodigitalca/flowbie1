import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(__dirname, "..");
export const exportScript = path.join(repoRoot, "scripts", "research", "local-dominator", "export-grid.mjs");
export const jobsDir = process.env.LOCAL_DOMINATOR_JOBS_DIR || path.join(os.tmpdir(), "flowbie-ld-jobs");

/** @type {Map<string, { child: import("node:child_process").ChildProcess | null, progressPath: string }>} */
const activeJobs = new Map();

/** Keep last terminal payload so a second poll after cleanup does not return "Job not found." */
/** @type {Map<string, Record<string, unknown>>} */
const terminalJobs = new Map();

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
    if (data.type === "done") {
      status = "done";
      result = data;
    }
    if (data.type === "error") {
      status = "error";
      error = data.message || "Local Dominator export failed.";
      label = error;
    }
  }

  return { status, label, screenshotBase64, result, error };
}

function ensureJobsDir() {
  fs.mkdirSync(jobsDir, { recursive: true });
}

const LEGACY_TEMPLATE_KEYWORD = "blinds near me";
const LEGACY_TEMPLATE_BUSINESS = "advance blinds & drapery";

function resolveExportKeyword(businessName, keyword) {
  const trimmed = String(keyword ?? "").trim();
  if (trimmed.toLowerCase() === "auto") return "";
  if (
    trimmed.toLowerCase() === LEGACY_TEMPLATE_KEYWORD
    && String(businessName ?? "").trim().toLowerCase() !== LEGACY_TEMPLATE_BUSINESS
  ) {
    return "";
  }
  return trimmed;
}

export function startJob(businessName, keyword) {
  if (!fs.existsSync(exportScript)) {
    return {
      ok: false,
      error: "Local Dominator export script is missing in the repo.",
      code: "LD_EXPORT_EXEC_BLOCKED",
    };
  }

  ensureJobsDir();
  const jobId = crypto.randomUUID();
  const progressPath = path.join(jobsDir, `${jobId}.jsonl`);
  fs.writeFileSync(progressPath, "", "utf8");

  const resolvedKeyword = resolveExportKeyword(businessName, keyword);

  const child = spawn(
    process.execPath,
    [
      exportScript,
      "--json",
      "--progress-file",
      progressPath,
      "--business",
      businessName,
      "--keyword",
      resolvedKeyword,
    ],
    { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
  );

  child.stdout?.on("data", () => {});
  child.stderr?.on("data", () => {});

  activeJobs.set(jobId, { child, progressPath });

  child.on("close", () => {
    const entry = activeJobs.get(jobId);
    if (entry) {
      activeJobs.set(jobId, { child: null, progressPath: entry.progressPath });
    }
  });

  return { ok: true, jobId };
}

export function cancelJob(jobId) {
  const normalized = String(jobId ?? "").trim().toLowerCase();
  if (!normalized) {
    return { ok: false, error: "Missing job id." };
  }

  const entry = activeJobs.get(normalized);
  const progressPath = entry?.progressPath ?? path.join(jobsDir, `${normalized}.jsonl`);

  if (entry?.child && entry.child.exitCode === null) {
    try {
      entry.child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }

  activeJobs.delete(normalized);

  try {
    fs.appendFileSync(
      progressPath,
      `${JSON.stringify({ type: "error", message: "Cancelled" })}\n`,
      "utf8",
    );
  } catch {
    // ignore
  }

  return { ok: true, status: "error", error: "Cancelled" };
}

export function cancelAllJobs() {
  const jobIds = [...activeJobs.keys()];
  for (const jobId of jobIds) {
    cancelJob(jobId);
  }
  return { ok: true, cancelled: jobIds.length };
}

export function readJobProgress(jobId) {
  const cached = terminalJobs.get(jobId);
  if (cached) {
    return { ...cached };
  }

  const entry = activeJobs.get(jobId);
  const progressPath = entry?.progressPath ?? path.join(jobsDir, `${jobId}.jsonl`);
  if (!entry && !fs.existsSync(progressPath)) {
    // Prefer cached terminal payload; if both are gone, soft-miss (not a business miss).
    return { ok: false, status: "error", error: "Export worker job already cleaned up." };
  }

  const parsed = parseProgressFile(progressPath);
  if (parsed.status === "done") {
    activeJobs.delete(jobId);
    const payload = {
      ok: true,
      status: "done",
      label: parsed.label,
      screenshotBase64: parsed.screenshotBase64,
      result: parsed.result,
    };
    terminalJobs.set(jobId, payload);
    // Keep the progress file until PHP finalize cleans up so a concurrent poll
    // does not surface "Job not found" (that is the worker job id, not the business).
    return { ...payload };
  }

  if (parsed.status === "error") {
    activeJobs.delete(jobId);
    const payload = {
      ok: true,
      status: "error",
      label: parsed.label,
      screenshotBase64: parsed.screenshotBase64,
      error: parsed.error,
    };
    terminalJobs.set(jobId, payload);
    return { ...payload };
  }

  const running = Boolean(entry?.child && entry.child.exitCode === null);
  if (!running && entry && entry.child?.exitCode !== 0 && entry.child?.exitCode != null) {
    activeJobs.delete(jobId);
    const payload = {
      ok: true,
      status: "error",
      label: parsed.label,
      screenshotBase64: parsed.screenshotBase64,
      error: parsed.error || "Local Dominator export process exited unexpectedly.",
    };
    terminalJobs.set(jobId, payload);
    return { ...payload };
  }

  return {
    ok: true,
    status: "running",
    label: parsed.label,
    screenshotBase64: parsed.screenshotBase64,
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
  const expected = (process.env.LD_WORKER_AUTH_TOKEN || "").trim();
  if (!expected) return true;
  const header = String(req.headers.authorization || "").trim();
  if (header === `Bearer ${expected}`) return true;
  const alt = String(req.headers["x-ld-worker-token"] || "").trim();
  return alt === expected;
}

export async function handleLocalDominatorExportRequest(req, res, pathname) {
  const url = pathname.replace(/\/+$/, "");
  const method = req.method ?? "GET";

  const jobMatch = url.match(/^\/local-dominator\/export-grid\/jobs\/([a-f0-9-]{8,64})$/i);
  if (method === "GET" && jobMatch) {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }
    sendJson(res, 200, readJobProgress(jobMatch[1].toLowerCase()));
    return true;
  }

  const cancelJobMatch = url.match(/^\/local-dominator\/export-grid\/jobs\/([a-f0-9-]{8,64})\/cancel$/i);
  if (method === "POST" && cancelJobMatch) {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }
    sendJson(res, 200, cancelJob(cancelJobMatch[1].toLowerCase()));
    return true;
  }

  if (method === "POST" && url === "/local-dominator/export-grid/jobs/cancel-all") {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }
    sendJson(res, 200, cancelAllJobs());
    return true;
  }

  if (method === "POST" && url === "/local-dominator/export-grid/jobs") {
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

    const businessName = String(body.businessName ?? "").trim();
    if (!businessName) {
      sendJson(res, 400, { ok: false, error: "Missing required field: businessName" });
      return true;
    }

    const started = startJob(businessName, body.keyword);
    sendJson(res, started.ok ? 200 : 500, started);
    return true;
  }

  if (method === "POST" && url === "/local-dominator/export-grid") {
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

    const businessName = String(body.businessName ?? "").trim();
    if (!businessName) {
      sendJson(res, 400, { ok: false, error: "Missing required field: businessName" });
      return true;
    }

    const started = startJob(businessName, body.keyword);
    if (!started.ok || !started.jobId) {
      sendJson(res, 500, started);
      return true;
    }

    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const progress = readJobProgress(started.jobId);
      if (progress.status === "done" && progress.result) {
        sendJson(res, 200, progress.result);
        return true;
      }
      if (progress.status === "error") {
        sendJson(res, 500, {
          ok: false,
          error: progress.error || "Local Dominator export failed.",
          code: "LD_EXPORT_EXEC_BLOCKED",
        });
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    sendJson(res, 500, {
      ok: false,
      error: "Local Dominator export timed out.",
      code: "LD_EXPORT_EXEC_BLOCKED",
    });
    return true;
  }

  return false;
}
