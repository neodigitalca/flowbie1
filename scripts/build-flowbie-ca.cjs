#!/usr/bin/env node
process.env.VITE_BASE_PATH = "/flowbie/";
process.env.VITE_FLOWBIE_CA = "1";
// Same-origin flowbie-app plugin; do not bake Render URL from .env.production
process.env.VITE_MCP_API_BASE = "/api/mcp";

const { spawnSync } = require("node:child_process");
const { cpSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const marketingSrc = join(root, "marketing", "instagram-ads");
const marketingDest = join(root, "public", "marketing", "instagram-ads");
mkdirSync(marketingDest, { recursive: true });
cpSync(marketingSrc, marketingDest, { recursive: true, force: true });

run("node", ["scripts/stamp-build.cjs"]);
run("npx", ["vite", "build"]);
run("node", ["scripts/write-build-info.cjs"]);
