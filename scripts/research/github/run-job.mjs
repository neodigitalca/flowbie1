#!/usr/bin/env node
/**
 * Run a registered research browser job (GitHub Actions entry).
 *
 * Env:
 *   RESEARCH_JOB_KEY
 *   RESEARCH_JOB_PAYLOAD (JSON)
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getResearchJob } from "../registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..", "..");
const resultPath = process.env.RESEARCH_JOB_RESULT_PATH || path.join(repoRoot, ".research-job-result.json");

function parsePayload() {
  const raw = process.env.RESEARCH_JOB_PAYLOAD?.trim() || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("RESEARCH_JOB_PAYLOAD is not valid JSON.");
  }
}

function parseExportStdout(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // keep scanning
    }
  }
  return null;
}

function buildScriptArgs(job, payload) {
  const args = [...(job.jsonArgs ?? []), "--payload", JSON.stringify(payload)];
  if (payload.businessName) {
    args.push("--business", String(payload.businessName));
  }
  if (payload.keyword) {
    args.push("--keyword", String(payload.keyword));
  }
  return args;
}

function main() {
  const jobKey = process.env.RESEARCH_JOB_KEY?.trim();
  if (!jobKey) {
    throw new Error("RESEARCH_JOB_KEY is required.");
  }

  const job = getResearchJob(jobKey);
  for (const name of job.requiredEnv) {
    if (!process.env[name]?.trim()) {
      throw new Error(`Missing required env var: ${name}`);
    }
  }
  if (!fs.existsSync(job.script)) {
    throw new Error(`Research script not found: ${job.script}`);
  }

  const payload = parsePayload();
  const args = buildScriptArgs(job, payload);
  const result = spawnSync(process.execPath, [job.script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });

  const parsed = parseExportStdout(result.stdout ?? "");
  const output = parsed ?? {
    ok: false,
    error: (result.stderr ?? "").trim() || (result.stdout ?? "").trim() || "Research job failed.",
  };

  fs.writeFileSync(
    resultPath,
    `${JSON.stringify({ jobKey, payload, result: output }, null, 2)}\n`,
    "utf8",
  );

  if (result.status !== 0 || !output.ok) {
    console.error(output.error || "Research job failed.");
    process.exit(1);
  }

  console.log(`Research job ${jobKey} completed (${output.fileName ?? "ok"}).`);
}

main();
