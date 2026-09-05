#!/usr/bin/env node
/**
 * Export a Local Dominator grid scan CSV.
 *
 * Usage:
 *   node scripts/research/local-dominator/export-grid.mjs --business "Advance Blinds & Drapery" --keyword "blinds near me"
 *   node scripts/research/local-dominator/export-grid.mjs --json
 *   node scripts/research/local-dominator/export-grid.mjs --json --progress-file /tmp/job.jsonl
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer";
import {
  applySessionCookies,
  buildArchiveFileName,
  createProgressWriter,
  defaultLoginUrl,
  exportLocalDominatorGridCsv,
  repoRoot,
  requireEnv,
  resolveEnv,
  saveSessionCookies,
  submitLogin,
} from "./lib.mjs";

function readArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx < 0 || idx + 1 >= process.argv.length) return "";
  return process.argv[idx + 1].trim();
}

function hasArg(name) {
  return process.argv.includes(name);
}

const LEGACY_TEMPLATE_KEYWORD = "blinds near me";
const LEGACY_TEMPLATE_BUSINESS = "advance blinds & drapery";

function normalizeExportKeyword(keyword, businessName) {
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

function resolveKeywordArg(env, businessName) {
  if (hasArg("--keyword")) {
    return normalizeExportKeyword(readArg("--keyword"), businessName);
  }
  if (hasArg("--payload")) {
    return normalizeExportKeyword(readPayloadArg("keyword"), businessName);
  }
  const envKeyword = env.LOCAL_DOMINATOR_KEYWORD?.trim();
  if (envKeyword) return normalizeExportKeyword(envKeyword, businessName);
  return "";
}

function readPayloadArg(key) {
  const raw = readArg("--payload");
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return String(parsed[key] ?? "").trim();
  } catch {
    return "";
  }
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function emitJson(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

async function main() {
  const env = resolveEnv();
  const email = requireEnv("LOCAL_DOMINATOR_EMAIL", env);
  const password = requireEnv("LOCAL_DOMINATOR_PASSWORD", env);
  const loginUrl = env.LOCAL_DOMINATOR_LOGIN_URL?.trim() || defaultLoginUrl;
  const businessName =
    readArg("--business") ||
    readPayloadArg("businessName") ||
    env.LOCAL_DOMINATOR_BUSINESS?.trim() ||
    "Advance Blinds & Drapery";
  const keyword = resolveKeywordArg(env, businessName);
  const jsonMode = hasFlag("--json");
  const headed = hasFlag("--headed");
  const saveSession = hasFlag("--save-session");
  const progressPath = readArg("--progress-file");
  const progress = createProgressWriter(progressPath);

  progress.step("Starting export");

  const browser = await puppeteer.launch({
    headless: !headed,
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  let page = null;
  try {
    page = await browser.newPage();
    await applySessionCookies(page);
    await submitLogin(page, email, password, loginUrl, progress);

    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "ld-export-"));
    const exported = await exportLocalDominatorGridCsv(page, {
      businessName,
      keyword,
      downloadDir,
      progress,
    });

    if (saveSession) {
      await saveSessionCookies(page);
    }

    await progress.screenshot(page, "Export complete");

    const fileName = buildArchiveFileName(businessName, keyword, exported.fileName);
    const payload = {
      ok: true,
      fileName,
      csvBase64: Buffer.from(exported.csvContent, "utf8").toString("base64"),
      businessName,
      keyword,
    };

    progress.done(payload);

    if (jsonMode) {
      emitJson(payload);
      return;
    }

    const outPath = path.join(repoRoot, fileName);
    fs.writeFileSync(outPath, exported.csvContent, "utf8");
    console.log(outPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (page) {
      await progress.screenshot(page, message.slice(0, 120));
    }
    progress.error(message);
    if (jsonMode) {
      emitJson({ ok: false, error: message });
    } else {
      console.error(message);
    }
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
