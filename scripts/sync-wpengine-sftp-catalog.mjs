#!/usr/bin/env node
/**
 * Sync Customer List CSV SFTP credentials to neodigital.ca server catalog.
 *
 * Usage: npm run sync:wpengine-catalog
 * Prefers SFTP upload (same as deploy). Falls back to authenticated API if SFTP config missing.
 */

import { existsSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import SftpClient from "ssh2-sftp-client";
import {
  buildWpEngineCatalogPayload,
  defaultWpEngineCsvPath,
} from "../wordpress-plugins/deploy/lib/wpengine-catalog-payload.js";

const dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(dir, "..");
const csvPath = defaultWpEngineCsvPath(repoRoot);
const deployDir = join(repoRoot, "wordpress-plugins/.deploy");

const apiBase = (process.env.NEO_PULSE_API_BASE || "https://neodigital.ca").replace(/\/$/, "");
const token = (process.env.NEO_PULSE_SESSION_TOKEN || "").trim();

const configPaths = [
  process.env.NEO_PULSE_WPENGINE_CONFIG,
  join(repoRoot, "wordpress-plugins/neo-pulse-wpengine.config.json"),
  join(repoRoot, "wordpress-plugins/flowbie-wpengine.config.json"),
].filter(Boolean);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function loadSiteFromWpEngineConfig() {
  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue;
    const raw = JSON.parse(readFileSync(configPath, "utf8"));
    const siteUrl = String(raw.site ?? "").trim();
    const site = siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (site !== "neodigital.ca" || !raw.host || !raw.username || !(raw.password || raw.passwordPath)) continue;
    return {
      site,
      host: raw.host,
      port: Number(raw.port) || 2222,
      username: raw.username,
      password: raw.password ?? "",
    };
  }
  return null;
}

async function uploadViaSftp(siteRow, payload) {
  const sftp = new SftpClient();
  await sftp.connect({
    host: siteRow.host,
    port: siteRow.port,
    username: siteRow.username,
    password: siteRow.password,
    readyTimeout: 30000,
  });
  try {
    await sftp.mkdir("./wp-content/uploads/neo-pulse-data", true);
    const remotePath = "./wp-content/uploads/neo-pulse-data/wpengine-sftp-catalog.json";
    await sftp.put(Buffer.from(JSON.stringify(payload, null, 2), "utf8"), remotePath);
  } finally {
    await sftp.end();
  }
}

async function uploadViaApi(payload) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${apiBase}/api/wpengine/catalog/sync`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ rows: payload.rows }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    fail(data.error || `HTTP ${res.status}`);
  }
  return data;
}

if (!existsSync(csvPath)) {
  fail(`CSV not found: ${csvPath}`);
}

const payload = buildWpEngineCatalogPayload(csvPath);
const localJson = join(deployDir, "wpengine-sftp-catalog.json");
writeFileSync(localJson, JSON.stringify(payload, null, 2), "utf8");

const siteRow = loadSiteFromWpEngineConfig();
if (siteRow?.password) {
  await uploadViaSftp(siteRow, payload);
  console.log(`Synced ${payload.count} SFTP rows via SFTP to neodigital`);
} else {
  const data = await uploadViaApi(payload);
  console.log(`Synced ${data.count ?? payload.count} SFTP rows to ${apiBase}`);
}

if (payload.updatedAt) {
  console.log(`Updated: ${payload.updatedAt}`);
}
