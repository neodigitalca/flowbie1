import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRequestBody, sendJson } from "./local-dominator-export-jobs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "..");
export const entryScript = path.join(repoRoot, "scripts", "post-creator-server-entry.ts");
export const jobsDir =
  process.env.POST_CREATOR_SERVER_JOBS_DIR || path.join(os.tmpdir(), "flowbie-post-creator-jobs");

/** @type {Map<string, { child: import("node:child_process").ChildProcess | null, exitCode: number | null, progressPath: string }>} */
const activeJobs = new Map();

function ensureJobsDir() {
  fs.mkdirSync(jobsDir, { recursive: true });
}

function appendProgress(progressPath, data) {
  fs.appendFileSync(progressPath, `${JSON.stringify(data)}\n`, "utf8");
}

function parseProgressFile(progressPath) {
  if (!fs.existsSync(progressPath)) {
    return { status: "running", label: "Starting" };
  }

  const lines = fs.readFileSync(progressPath, "utf8").split(/\r?\n/).filter(Boolean);
  let label = "Starting";
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
    if (data.type === "done") {
      status = "done";
      result = data.result ?? null;
    }
    if (data.type === "error") {
      status = "error";
      error = data.message || "Post creator server job failed.";
      label = error;
    }
  }

  return { status, label, result, error };
}

export function startJob(input) {
  if (!fs.existsSync(entryScript)) {
    return {
      ok: false,
      error: "Post creator server entry script is missing in the repo.",
      code: "POST_CREATOR_SERVER_EXEC_BLOCKED",
    };
  }

  ensureJobsDir();
  const jobId = crypto.randomUUID();
  const progressPath = path.join(jobsDir, `${jobId}.jsonl`);
  fs.writeFileSync(progressPath, "", "utf8");

  const env = {
    ...process.env,
    JOB_PAYLOAD: JSON.stringify(input),
  };

  const child = spawn(process.execPath, ["--import", "tsx", entryScript], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  activeJobs.set(jobId, { child, exitCode: null, progressPath });

  child.stdout?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) appendProgress(progressPath, { type: "step", label: text.slice(0, 200) });
  });

  child.stderr?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) appendProgress(progressPath, { type: "step", label: text.slice(0, 4000) });
  });

  child.on("exit", (code) => {
    const entry = activeJobs.get(jobId);
    if (!entry) return;
    entry.exitCode = code ?? 1;
    entry.child = null;
    const parsed = parseProgressFile(progressPath);
    if (parsed.status === "running") {
      if (code === 0) {
        appendProgress(progressPath, { type: "done", result: { ok: true } });
      } else {
        const detail = parsed.label && parsed.label !== "Post creator server job started"
          ? parsed.label
          : "Post creator server process exited unexpectedly.";
        appendProgress(progressPath, {
          type: "error",
          message: detail,
        });
      }
    }
  });

  appendProgress(progressPath, { type: "step", label: "Post creator server job started" });

  return { ok: true, jobId };
}

export function readJobProgress(jobId) {
  const entry = activeJobs.get(jobId);
  const progressPath = entry?.progressPath ?? path.join(jobsDir, `${jobId}.jsonl`);
  if (!fs.existsSync(progressPath)) {
    return { ok: false, error: "Job not found." };
  }

  const parsed = parseProgressFile(progressPath);
  if (parsed.status === "done") {
    activeJobs.delete(jobId);
    return { ok: true, status: "done", label: parsed.label, result: parsed.result };
  }
  if (parsed.status === "error") {
    activeJobs.delete(jobId);
    return {
      ok: true,
      status: "error",
      label: parsed.label,
      error: parsed.error || parsed.label,
    };
  }

  const exitCode = entry?.exitCode ?? entry?.child?.exitCode ?? null;
  const running = Boolean(entry?.child && entry.child.exitCode === null);
  if (!running && entry && exitCode != null && exitCode !== 0) {
    activeJobs.delete(jobId);
    const detail =
      parsed.label && parsed.label !== "Post creator server job started"
        ? parsed.label
        : parsed.error || "Post creator server process exited unexpectedly.";
    return {
      ok: true,
      status: "error",
      label: detail,
      error: detail,
    };
  }

  return { ok: true, status: "running", label: parsed.label };
}

export function checkWorkerAuth(req) {
  const expected = (process.env.LD_WORKER_AUTH_TOKEN || "").trim();
  if (!expected) return true;
  const header = String(req.headers.authorization || "").trim();
  if (header === `Bearer ${expected}`) return true;
  const alt = String(req.headers["x-post-creator-worker-token"] || req.headers["x-ld-worker-token"] || "").trim();
  return alt === expected;
}

export async function handlePostCreatorServerRequest(req, res, pathname) {
  const url = pathname.replace(/\/+$/, "");
  const method = req.method ?? "GET";

  const jobMatch = url.match(/^\/post-creator\/jobs\/([a-f0-9-]{8,64})$/i);
  if (method === "GET" && jobMatch) {
    if (!checkWorkerAuth(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized." });
      return true;
    }
    sendJson(res, 200, readJobProgress(jobMatch[1].toLowerCase()));
    return true;
  }

  if (method === "POST" && url === "/post-creator/jobs") {
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

    if (!body.teamId || !body.runId || !body.site || !body.bearerToken || !body.apiBase) {
      sendJson(res, 400, {
        ok: false,
        error: "Missing required fields: teamId, runId, site, bearerToken, apiBase",
      });
      return true;
    }

    sendJson(res, 200, startJob(body));
    return true;
  }

  return false;
}
