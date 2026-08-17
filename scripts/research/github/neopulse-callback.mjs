#!/usr/bin/env node
/**
 * POST research job results to Neo Pulse API (GitHub Actions step).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..", "..");
const resultPath = process.env.RESEARCH_JOB_RESULT_PATH || path.join(repoRoot, ".research-job-result.json");

function parsePayloadFromEnv() {
  const raw = process.env.RESEARCH_JOB_PAYLOAD?.trim() || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function readJobResult() {
  if (fs.existsSync(resultPath)) {
    return JSON.parse(fs.readFileSync(resultPath, "utf8"));
  }

  const payload = parsePayloadFromEnv();
  const jobKey = process.env.RESEARCH_JOB_KEY?.trim() || "local_dominator_export";
  const succeeded = process.env.RESEARCH_JOB_SUCCEEDED === "true";
  const error = succeeded
    ? undefined
    : "Research browser job failed before a result file was written.";

  return {
    jobKey,
    payload,
    result: {
      ok: succeeded,
      error,
    },
  };
}

function safeFileName(name) {
  const trimmed = String(name ?? "").trim().replace(/[/\\?%*:|"<>]/g, "-");
  return trimmed.endsWith(".csv") ? trimmed : `${trimmed || "research-export"}.csv`;
}

function buildArchiveFiles(exportResult) {
  if (!exportResult.csvBase64 || !exportResult.fileName) return [];
  return [
    {
      fileName: safeFileName(exportResult.fileName),
      mime: "text/csv",
      dataBase64: String(exportResult.csvBase64),
    },
  ];
}

async function main() {
  const apiBase = (process.env.NEOPULSE_API_BASE || "https://neodigital.ca").replace(/\/+$/, "");
  const secret = process.env.NEOPULSE_RESEARCH_CALLBACK_SECRET?.trim();
  if (!secret) {
    throw new Error("NEOPULSE_RESEARCH_CALLBACK_SECRET is required.");
  }

  const job = readJobResult();
  const payload = job.payload ?? parsePayloadFromEnv();
  const exportResult = job.result ?? {};
  const succeeded = process.env.RESEARCH_JOB_SUCCEEDED === "true";
  const teamId = Number(payload.teamId ?? 0);
  const executionId = Number(payload.executionId ?? 0);
  const agentRunId = Number(payload.agentRunId ?? 0);

  if (!teamId || !executionId) {
    throw new Error("Job payload must include teamId and executionId.");
  }

  const ok = succeeded && Boolean(exportResult.ok);
  const error =
    typeof exportResult.error === "string" && exportResult.error.trim()
      ? exportResult.error.trim()
      : ok
        ? undefined
        : "Research browser job failed.";

  const body = {
    jobKey: job.jobKey || process.env.RESEARCH_JOB_KEY?.trim() || "local_dominator_export",
    teamId,
    executionId,
    agentRunId: agentRunId || undefined,
    ok,
    error,
    agentRunIdForArchive: agentRunId || undefined,
    result: ok
      ? {
          businessName: exportResult.businessName,
          keyword: exportResult.keyword,
          fileName: exportResult.fileName,
          siteId: payload.siteId,
        }
      : undefined,
    archiveFiles: ok ? buildArchiveFiles(exportResult) : undefined,
  };

  const rawBody = JSON.stringify(body);
  const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const res = await fetch(`${apiBase}/api/research-jobs/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Neo-Pulse-Research-Signature": `sha256=${signature}`,
    },
    body: rawBody,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Callback returned non-JSON (${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Callback failed (HTTP ${res.status})`);
  }

  console.log("Neo Pulse callback succeeded.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
