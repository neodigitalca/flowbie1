#!/usr/bin/env node
/**
 * Pre-commit guard: block staged secret files and known credential patterns.
 *
 * Usage:
 *   node scripts/check-no-secrets.mjs
 *   git config core.hooksPath .githooks
 */

import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

const SECRET_BASENAMES = new Set([
  "flowbie-app-secrets.php",
  "flowbie-wp-secrets.php",
  "flowbie-wp-gsc-config.php",
  ".env",
]);

const BLOCKED_PATH_PATTERNS = [
  /^wordpress-plugins\/\.deploy\/.*\.zip$/i,
  /^wordpress-plugins\/.*\.zip$/i,
  /^\.env(\.|$)/,
  /-credentials.*\.json$/i,
  /\.credentials\.json$/i,
  /flowbie-wpengine\.config\.json$/i,
  /^gsc-config\.local\.js$/i,
];

const CONTENT_PATTERNS = [
  { re: /GOCSPX-[A-Za-z0-9_-]{10,}/, label: "Google OAuth client secret (GOCSPX-)" },
  {
    re: /define\s*\(\s*['"]FLOWBIE_APP_GMB_CLIENT_SECRET['"]\s*,\s*['"][^'"]{8,}['"]/,
    label: "non-empty FLOWBIE_APP_GMB_CLIENT_SECRET",
  },
  {
    re: /define\s*\(\s*['"]FLOWBIE_WP_GMB_CLIENT_SECRET['"]\s*,\s*['"][^'"]{8,}['"]/,
    label: "non-empty FLOWBIE_WP_GMB_CLIENT_SECRET",
  },
  { re: /\bsk-or-[A-Za-z0-9_-]{20,}/, label: "OpenRouter API key (sk-or-)" },
  { re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, label: "PEM private key" },
];

function stagedFiles() {
  const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
    encoding: "utf8",
  });
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isBlockedPath(file) {
  const norm = file.replace(/\\/g, "/");
  const base = basename(norm);
  if (SECRET_BASENAMES.has(base)) return `secret filename (${base})`;
  if (base.startsWith(".env")) return "env file";
  for (const re of BLOCKED_PATH_PATTERNS) {
    if (re.test(norm)) return `blocked path pattern (${re})`;
  }
  return null;
}

function scanContent(file) {
  let stat;
  try {
    stat = statSync(file);
  } catch {
    return [];
  }
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return [];

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  if (text.includes("\0")) return [];

  const hits = [];
  for (const { re, label } of CONTENT_PATTERNS) {
    if (re.test(text)) hits.push(label);
  }
  return hits;
}

function main() {
  const files = stagedFiles();
  if (files.length === 0) process.exit(0);

  /** @type {string[]} */
  const errors = [];

  for (const file of files) {
    const pathReason = isBlockedPath(file);
    if (pathReason) {
      errors.push(`${file}: ${pathReason}`);
      continue;
    }
    const contentHits = scanContent(file);
    for (const hit of contentHits) {
      errors.push(`${file}: contains ${hit}`);
    }
  }

  if (errors.length === 0) process.exit(0);

  console.error("Commit blocked: possible secrets detected.\n");
  for (const err of errors) console.error(`  - ${err}`);
  console.error(
    "\nRemove these files from the index (git reset HEAD -- <path>) or rotate credentials if already pushed."
  );
  process.exit(1);
}

main();
