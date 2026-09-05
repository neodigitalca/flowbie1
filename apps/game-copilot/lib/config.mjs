import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const defaultsPath = path.join(__dirname, "..", "config.defaults.json");
const defaults = JSON.parse(fs.readFileSync(defaultsPath, "utf8"));

export function loadOpenRouterKey() {
  const repoRoot = path.join(__dirname, "..", "..", "..");
  const loader = require(path.join(repoRoot, "scripts", "load-root-openrouter-env.cjs"));
  const key =
    process.env.VITE_OPENROUTER_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPEN_ROUTER_API_KEY ||
    loader.openRouterKey ||
    "";
  return typeof key === "string" ? key.trim() : "";
}

export function loadConfig() {
  const sessionRoot =
    process.env.GAME_COPILOT_SESSION_DIR ||
    path.join(os.homedir(), "AppData", "Local", "GameCopilot", "sessions");

  return {
    port: Number(process.env.GAME_COPILOT_PORT || defaults.port),
    historyFrameCount: Number(
      process.env.GAME_COPILOT_HISTORY_FRAMES || defaults.historyFrameCount,
    ),
    captureIntervalSec: Number(
      process.env.GAME_COPILOT_CAPTURE_INTERVAL_SEC || defaults.captureIntervalSec,
    ),
    idlePauseMin: Number(process.env.GAME_COPILOT_IDLE_PAUSE_MIN || defaults.idlePauseMin),
    model: process.env.GAME_COPILOT_MODEL || defaults.model,
    maxTextExchanges: defaults.maxTextExchanges,
    micMaxSec: Number(process.env.GAME_COPILOT_MIC_MAX_SEC || defaults.micMaxSec),
    pttKey: process.env.GAME_COPILOT_PTT_KEY || defaults.pttKey,
    sessionRoot,
    referer: process.env.GAME_COPILOT_REFERER || "http://localhost:3847",
    appTitle: process.env.GAME_COPILOT_APP_TITLE || "Game Copilot",
  };
}
