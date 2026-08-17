#!/usr/bin/env node
/**
 * Append Local Dominator Render worker constants to production neo-pulse-app-secrets.php via SFTP.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import SftpClient from "ssh2-sftp-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "wordpress-plugins", "flowbie-wpengine.config.json");

function loadConfig() {
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return {
    host: raw.host,
    port: Number(raw.port) || 2222,
    username: raw.username,
    password: raw.password,
    remoteSecrets: "./wp-content/plugins/neo-pulse-app/includes/neo-pulse-app-secrets.php",
  };
}

async function loadApiKey() {
  const downloads = path.join(process.env.USERPROFILE || process.env.HOME || "", "Downloads", "RENDER API KEY.txt");
  if (fs.existsSync(downloads)) return fs.readFileSync(downloads, "utf8").trim();
  return (process.env.RENDER_API_KEY || "").trim();
}

async function getWorkerToken() {
  const fromEnv = (process.env.LD_WORKER_AUTH_TOKEN || "").trim();
  if (fromEnv) return fromEnv;
  const key = await loadApiKey();
  if (!key) throw new Error("Missing RENDER_API_KEY for worker token lookup.");
  const res = await fetch("https://api.render.com/v1/services/srv-da1j10dbedkc73d2tneg/env-vars?limit=100", {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  const rows = await res.json();
  const list = Array.isArray(rows) ? rows.map((row) => row.envVar ?? row) : [];
  const hit = list.find((item) => item.key === "LD_WORKER_AUTH_TOKEN");
  return hit?.value ? String(hit.value).trim() : "";
}

function buildBlock(workerUrl, workerAuth) {
  return [
    "",
    "if ( ! defined( 'NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_URL' ) ) {",
    `\tdefine( 'NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_URL', '${workerUrl}' );`,
    "}",
    "if ( ! defined( 'NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_AUTH' ) ) {",
    `\tdefine( 'NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_AUTH', '${workerAuth}' );`,
    "}",
    "",
  ].join("\n");
}

async function main() {
  const workerUrl =
    (process.env.NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_URL || "").trim() ||
    "https://flowbie-prod-worker.onrender.com";
  const workerAuth = await getWorkerToken();
  if (!workerAuth) throw new Error("LD_WORKER_AUTH_TOKEN not found on Render prod worker.");

  const cfg = loadConfig();
  const sftp = new SftpClient();
  await sftp.connect(cfg);
  const remote = cfg.remoteSecrets;
  let content = "";
  try {
    content = (await sftp.get(remote)).toString("utf8");
  } catch {
    throw new Error(`Missing remote secrets file: ${remote}`);
  }

  if (content.includes("NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_URL")) {
    console.log("[skip] worker constants already present in production secrets.");
    await sftp.end();
    return;
  }

  const next = `${content.replace(/\s*$/, "")}${buildBlock(workerUrl, workerAuth)}`;
  await sftp.put(Buffer.from(next, "utf8"), remote);
  await sftp.end();
  console.log("[ok] appended worker URL + auth to production neo-pulse-app-secrets.php");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
