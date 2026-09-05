#!/usr/bin/env node
/**
 * Game Copilot setup: deps, env check, optional smoke, open panel on display 2.
 *
 * Usage:
 *   node scripts/setup-game-copilot.mjs
 *   node scripts/setup-game-copilot.mjs --smoke
 *   npm run setup:game-copilot
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const appDir = path.join(repoRoot, "apps", "game-copilot");
const require = createRequire(import.meta.url);

const args = new Set(process.argv.slice(2));
const smoke = args.has("--smoke");

function log(msg) {
  console.log(`[setup:game-copilot] ${msg}`);
}

function fail(msg) {
  console.error(`[setup:game-copilot] ERROR: ${msg}`);
  process.exit(1);
}

require(path.join(repoRoot, "scripts", "load-root-openrouter-env.cjs"));
const apiKey =
  process.env.VITE_OPENROUTER_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  process.env.OPEN_ROUTER_API_KEY ||
  "";
if (!apiKey) {
  fail("OpenRouter key missing. Set OPENROUTER_API_KEY or VITE_OPENROUTER_API_KEY in .env");
}
log("OpenRouter key found");

if (!fs.existsSync(path.join(appDir, "package.json"))) {
  fail("apps/game-copilot missing — run from Flowbie One repo root");
}

log("Installing game-copilot dependencies…");
const install = spawnSync("npm", ["install"], { cwd: appDir, stdio: "inherit", shell: true });
if (install.status !== 0) fail("npm install failed in apps/game-copilot");

const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
if (ffmpeg.status !== 0) {
  log("ffmpeg not found — voice capture may fail. Install ffmpeg and add to PATH.");
} else {
  log("ffmpeg OK");
}

const sessionRoot = path.join(process.env.USERPROFILE || "", "AppData", "Local", "GameCopilot", "sessions");
fs.mkdirSync(sessionRoot, { recursive: true });
log(`Session dir: ${sessionRoot}`);

function openPanelOnSecondDisplay() {
  const url = "http://localhost:3847";
  const ps = `Start-Process msedge -ArgumentList '--new-window','${url}','--window-position=3440,0','--window-size=1720,1392'`;
  const fallback = `Start-Process chrome -ArgumentList '--new-window','${url}','--window-position=3440,0','--window-size=1720,1392'`;
  let r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    spawnSync("powershell", ["-NoProfile", "-Command", fallback], { stdio: "inherit", shell: true });
  }
}

if (smoke) {
  log("Running smoke verify…");
  const verify = spawnSync("node", [path.join(repoRoot, "scripts", "verify-game-copilot.mjs")], {
    stdio: "inherit",
    cwd: repoRoot,
    shell: true,
  });
  if (verify.status !== 0) fail("Smoke verify failed");
  log("Smoke passed");
} else {
  log("Start with: npm run game-copilot:start");
  log("Panel: http://localhost:3847");
  openPanelOnSecondDisplay();
}

log("Done");
