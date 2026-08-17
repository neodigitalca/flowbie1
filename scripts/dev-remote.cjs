#!/usr/bin/env node
const { spawnSync } = require("child_process");
const { PRODUCTION_API_TARGET } = require("./resolve-dev-api-target.cjs");

process.env.VITE_LOCAL_API_TARGET = PRODUCTION_API_TARGET;
process.env.VITE_MCP_API_BASE = process.env.VITE_MCP_API_BASE || "/api/mcp";

spawnSync("vite", [], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
