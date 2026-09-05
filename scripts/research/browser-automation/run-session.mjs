#!/usr/bin/env node
/**
 * Smart browser automation session (direct/proxy auto-routing + DFS search).
 *
 * Usage:
 *   node scripts/research/browser-automation/run-session.mjs --json --progress-file /tmp/job.jsonl --url https://example.com --instructions-file /tmp/instructions.html
 */

import fs from "node:fs";
import { createProgressWriter, resolveEnv } from "../chatgpt-audit/lib.mjs";
import { resolveResidentialProxyEnv } from "../residential-proxy/lib.mjs";
import { runSmartBrowseSession } from "./session-manager.mjs";
import { htmlInstructionsToText } from "./tools.mjs";

function readArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx < 0 || idx + 1 >= process.argv.length) return "";
  return process.argv[idx + 1].trim();
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const progressPath = readArg("--progress-file");
  const instructionsPath = readArg("--instructions-file");
  const targetUrl = readArg("--url");
  const headed = hasFlag("--headed");
  const progress = createProgressWriter(progressPath);

  const instructionsHtml = instructionsPath && fs.existsSync(instructionsPath)
    ? fs.readFileSync(instructionsPath, "utf8")
    : readArg("--instructions-html");
  const instructionsText = htmlInstructionsToText(instructionsHtml);

  if (!targetUrl) {
    progress.error("Missing required --url.");
    process.exitCode = 1;
    return;
  }
  if (!instructionsText) {
    progress.error("Missing browser instructions.");
    process.exitCode = 1;
    return;
  }

  const env = {
    ...resolveEnv(),
    ...resolveResidentialProxyEnv(),
  };

  try {
    const result = await runSmartBrowseSession({
      targetUrl,
      instructionsText,
      env,
      headed,
      progress,
    });

    progress.done({
      ok: result.success,
      summary: {
        success: result.success,
        summary: result.summary,
        notes: result.notes,
        targetUrl,
        finalUrl: result.finalUrl,
        actionLog: result.actionLog,
        browsePolicy: result.browsePolicy,
        proxyModeTimeline: result.proxyModeTimeline,
        serpUsed: result.serpUsed,
        blockEvents: result.blockEvents,
        directRounds: result.directRounds,
        finalProxyMode: result.finalProxyMode,
        preflightStatus: result.preflightStatus ?? null,
        deliverables: result.deliverables ?? [],
        capturedAt: new Date().toISOString(),
      },
    });
    if (!result.success) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Browser automation failed.";
    progress.error(message);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
