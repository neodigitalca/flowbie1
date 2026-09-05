#!/usr/bin/env node
/**
 * Residential proxy setup for browser automation (Oxylabs).
 *
 * Usage:
 *   node scripts/setup-residential-proxy.mjs
 *   node scripts/setup-residential-proxy.mjs --test
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isProxyConfigured, probeResidentialProxy } from "./research/residential-proxy/lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const envExample = path.join(repoRoot, ".env.residential-proxy.example");
const envFile = path.join(repoRoot, ".env.residential-proxy");
const runTest = process.argv.includes("--test");

function log(step, detail = "") {
  console.log(`${step}${detail ? ` ${detail}` : ""}`);
}

function ensureEnvFile() {
  if (fs.existsSync(envFile)) {
    log("OK", ".env.residential-proxy exists");
    return;
  }
  if (!fs.existsSync(envExample)) {
    throw new Error("Missing .env.residential-proxy.example");
  }
  fs.copyFileSync(envExample, envFile);
  log("Created", ".env.residential-proxy from example (add your Oxylabs credentials)");
}

async function main() {
  ensureEnvFile();
  if (!isProxyConfigured()) {
    log("WARN", "Proxy credentials missing in .env.residential-proxy");
    process.exitCode = 1;
    return;
  }
  log("OK", "Residential proxy env vars present");
  if (runTest) {
    const probe = await probeResidentialProxy();
    if (!probe.ok) {
      throw new Error(probe.error || "Residential proxy test failed.");
    }
    log("OK", `Proxy test passed${probe.ip ? ` (ip ${probe.ip})` : ""}`);
  } else {
    console.log("Optional: node scripts/setup-residential-proxy.mjs --test");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
