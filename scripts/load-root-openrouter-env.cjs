#!/usr/bin/env node
/**
 * Sets process.env.VITE_OPENROUTER_API_KEY from repo root .env for Vite builds.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");

function loadDotEnv(filePath) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function pick(env, ...keys) {
  for (const key of keys) {
    const val = env[key];
    if (typeof val === "string" && val.trim() !== "") {
      return val.trim();
    }
  }
  return "";
}

const dotenv = loadDotEnv(envPath);
const openRouterKey = pick(
  { ...dotenv, ...process.env },
  "VITE_OPENROUTER_API_KEY",
  "OPEN_ROUTER_API_KEY",
  "OPENROUTER_API_KEY",
);

if (openRouterKey && !process.env.VITE_OPENROUTER_API_KEY) {
  process.env.VITE_OPENROUTER_API_KEY = openRouterKey;
}

module.exports = { openRouterKey };
