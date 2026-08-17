#!/usr/bin/env node
/**
 * Export a Local Dominator grid scan CSV.
 *
 * Usage:
 *   node scripts/research/local-dominator/export-grid.mjs --business "Advance Blinds & Drapery" --keyword "blinds near me"
 *   node scripts/research/local-dominator/export-grid.mjs --json
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer";
import {
  applySessionCookies,
  buildArchiveFileName,
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
  const keyword =
    readArg("--keyword") ||
    readPayloadArg("keyword") ||
    env.LOCAL_DOMINATOR_KEYWORD?.trim() ||
    "blinds near me";
  const jsonMode = hasFlag("--json");
  const headed = hasFlag("--headed");
  const saveSession = hasFlag("--save-session");

  const browser = await puppeteer.launch({
    headless: !headed,
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();
    await applySessionCookies(page);
    await submitLogin(page, email, password, loginUrl);

    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "ld-export-"));
    const exported = await exportLocalDominatorGridCsv(page, {
      businessName,
      keyword,
      downloadDir,
    });

    if (saveSession) {
      await saveSessionCookies(page);
    }

    const fileName = buildArchiveFileName(businessName, keyword, exported.fileName);
    const payload = {
      ok: true,
      fileName,
      csvBase64: Buffer.from(exported.csvContent, "utf8").toString("base64"),
      businessName,
      keyword,
    };

    if (jsonMode) {
      emitJson(payload);
      return;
    }

    const outPath = path.join(repoRoot, fileName);
    fs.writeFileSync(outPath, exported.csvContent, "utf8");
    console.log(outPath);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (hasFlag("--json")) {
    emitJson({ ok: false, error: message });
  } else {
    console.error(message);
  }
  process.exit(1);
});
