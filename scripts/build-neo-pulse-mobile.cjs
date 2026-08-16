#!/usr/bin/env node
require("./load-root-openrouter-env.cjs");
process.env.VITE_BASE_PATH = "/mobile/";
process.env.VITE_MOBILE_APP = "1";
process.env.VITE_NEO_PULSE = "1";
process.env.VITE_MCP_API_BASE = "https://neodigital.ca/api/mcp";

const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

const root = join(__dirname, "..");
const pkg = require(join(root, "package.json"));
process.env.VITE_APP_VERSION = pkg.version;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("node", ["scripts/stamp-build.cjs"]);
run("node", ["scripts/build-pulse-assist-catalog.cjs"]);
run("npx", ["vite", "build"]);

const { copyFileSync, existsSync } = require("node:fs");
const mobileHtml = join(root, "dist", "mobile.html");
const indexHtml = join(root, "dist", "index.html");
if (existsSync(mobileHtml)) {
  copyFileSync(mobileHtml, indexHtml);
}

run("node", ["scripts/write-build-info.cjs"]);
