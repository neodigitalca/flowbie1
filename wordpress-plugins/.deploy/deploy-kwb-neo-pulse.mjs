/**
 * Deploy current neo-pulse-wp to kwbllp.com, copy the app OpenRouter key, activate Neo Pulse.
 *
 * Usage: node wordpress-plugins/.deploy/deploy-kwb-neo-pulse.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { randomBytes } from "crypto";
import SftpClient from "ssh2-sftp-client";
import { buildPluginZip } from "../deploy/lib/build-zip.js";
import { uploadZipAndInstall } from "../deploy/lib/deploy-zip.js";
import { loadProductionSites } from "../deploy/lib/csv-sites.js";

const dir = join(import.meta.dirname, "..");
const repoRoot = join(dir, "..");
const zipPath = join(dir, "neo-pulse-wp.zip");
const pluginDir = join(dir, "neo-pulse-wp");
const catalogPath = join(dir, ".deploy", "wpengine-sftp-catalog.json");
const onceSrc = join(repoRoot, ".cursor-kwb-patch", "kwb-neo-pulse-sync-once.php");
const envPath = join(pluginDir, ".env");
const generatedDir = join(dir, ".deploy");

const SFTP_OPTS = {
  readyTimeout: 30000,
  algorithms: {
    serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
    kex: [
      "curve25519-sha256",
      "ecdh-sha2-nistp256",
      "diffie-hellman-group14-sha256",
      "diffie-hellman-group-exchange-sha256",
      "diffie-hellman-group14-sha1",
    ],
  },
};

function catalogRow(site, { staging = false } = {}) {
  const csvPath = join(dir, "Customer List", "SFTP Users_Clients List.csv");
  if (existsSync(csvPath)) {
    const csv = loadProductionSites(csvPath).find((r) => r.site === site);
    if (csv) {
      return {
        site: csv.site,
        label: csv.label || csv.site,
        host: csv.host,
        port: csv.port,
        username: csv.username,
        password: csv.password,
      };
    }
  }
  const parsed = JSON.parse(readFileSync(catalogPath, "utf8"));
  const rows = parsed.rows || parsed.sites || [];
  const row = rows.find((r) => r.site === site && Boolean(r.isStaging) === staging);
  if (!row) {
    throw new Error(`No catalog row for ${site}`);
  }
  return {
    site: row.site,
    label: row.site,
    host: row.host,
    port: row.port,
    username: row.username,
    password: row.password,
  };
}

function parseEnv(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}

function pickKey(env) {
  for (const k of [
    "NEO_PULSE_WP_OPENROUTER_API_KEY",
    "FLOWBIE_WP_OPENROUTER_API_KEY",
    "OPEN_ROUTER_API_KEY",
    "OPENROUTER_API_KEY",
  ]) {
    if (typeof env[k] === "string" && env[k].trim() !== "") {
      return env[k].trim();
    }
  }
  return "";
}

function keyMeta(key) {
  if (!key) return "missing";
  return `len=${key.length} prefix=${key.slice(0, 6)}`;
}

async function connect(site) {
  const sftp = new SftpClient();
  await sftp.connect({
    host: site.host,
    port: site.port,
    username: site.username,
    password: site.password,
    readyTimeout: 30000,
  });
  return sftp;
}

async function resolvePluginsRoot(site) {
  const sftp = await connect(site);
  try {
    for (const candidate of ["./wp-content/plugins", "./wp-content/plugins"]) {
      try {
        await sftp.stat(candidate);
        return candidate;
      } catch {
        /* try next */
      }
    }
    throw new Error("Could not find wp-content/plugins on " + site.host);
  } finally {
    await sftp.end();
  }
}

async function listPluginDirs(site, pluginsRoot) {
  const sftp = await connect(site);
  try {
    const list = await sftp.list(pluginsRoot);
    return list.filter((e) => e.type === "d").map((e) => e.name).sort();
  } finally {
    await sftp.end();
  }
}

async function readRemoteEnv(site, pluginsRoot, pluginFolder) {
  const sftp = await connect(site);
  try {
    const buf = await sftp.get(`${pluginsRoot}/${pluginFolder}/.env`);
    return buf.toString("utf8");
  } catch {
    return "";
  } finally {
    await sftp.end();
  }
}

async function putFile(site, localPath, remotePath) {
  const sftp = await connect(site);
  try {
    await sftp.put(localPath, remotePath);
  } finally {
    await sftp.end();
  }
}

function ensureLocalEnv(openRouterKey) {
  const existing = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {};
  const key = openRouterKey || pickKey(existing);
  if (!key) {
    throw new Error("OpenRouter key not found in repo .env, plugin .env, or Blind Magic");
  }
  const lines = [
    "# Generated for KWB Neo Pulse deploy — do not commit",
    "",
    `NEO_PULSE_WP_OPENROUTER_API_KEY=${key}`,
    `OPENROUTER_API_KEY=${key}`,
    "",
  ];
  writeFileSync(envPath, lines.join("\n"), "utf8");
  return key;
}

const kwb = catalogRow("kwbllp.com");
const blind = catalogRow("blindmagic.com");

console.log("Resolving plugin paths...");
console.log("KWB SFTP user", kwb.username, kwb.host);
const kwbRoot = await resolvePluginsRoot(kwb);
const blindRoot = await resolvePluginsRoot(blind);
console.log("KWB plugins root", kwbRoot);
console.log("Blind Magic plugins root", blindRoot);

const kwbPlugins = await listPluginDirs(kwb, kwbRoot);
const blindPlugins = await listPluginDirs(blind, blindRoot);
console.log(
  "KWB plugin matches:",
  kwbPlugins.filter((n) => /pulse|flowbie/i.test(n)).join(", ") || "(none)",
);
console.log(
  "Blind Magic plugin matches:",
  blindPlugins.filter((n) => /pulse|flowbie/i.test(n)).join(", ") || "(none)",
);

execSync("node scripts/embed-wp-secrets.mjs", { cwd: repoRoot, stdio: "inherit" });

let orKey = existsSync(envPath) ? pickKey(parseEnv(readFileSync(envPath, "utf8"))) : "";
if (!orKey) {
  const rootEnv = join(repoRoot, ".env");
  if (existsSync(rootEnv)) {
    orKey = pickKey(parseEnv(readFileSync(rootEnv, "utf8")));
  }
}
if (!orKey) {
  console.log("Local OpenRouter key missing; copying from Blind Magic plugin .env");
  const remoteEnv =
    (await readRemoteEnv(blind, blindRoot, "neo-pulse-wp")) ||
    (await readRemoteEnv(blind, blindRoot, "flowbie-wp"));
  orKey = pickKey(parseEnv(remoteEnv));
}
console.log("OpenRouter key", keyMeta(orKey));
ensureLocalEnv(orKey);

console.log("Building neo-pulse-wp zip...");
buildPluginZip(pluginDir, zipPath, (done, total) => {
  process.stdout.write(`\r zip ${Math.round((done / total) * 100)}%`);
});
process.stdout.write("\n");

console.log("Deploying zip to KWB...");
await uploadZipAndInstall(kwb, {
  zipPath,
  localDir: pluginDir,
  remoteZipPath: `${kwbRoot}/neo-pulse-wp.zip`,
  installRoot: `${kwbRoot}/neo-pulse-wp`,
  verifyRelPath: "neo-pulse-wp.php",
  onProgress: (phase, done, total) => {
    process.stdout.write(`\r ${phase} ${Math.round((done / total) * 100)}%`);
  },
});
process.stdout.write("\n");

console.log("Uploading .env (zip deploy skips secrets)...");
await putFile(kwb, envPath, `${kwbRoot}/neo-pulse-wp/.env`);

const token = randomBytes(16).toString("hex");
mkdirSync(generatedDir, { recursive: true });
const generatedOnce = join(generatedDir, "kwb-neo-pulse-sync-once.generated.php");
writeFileSync(generatedOnce, readFileSync(onceSrc, "utf8").replace("KWB_SYNC_TOKEN", token), "utf8");
await putFile(kwb, generatedOnce, `${kwbRoot}/neo-pulse-wp/kwb-neo-pulse-sync-once.php`);

const onceUrls = [
  `https://kwbllp.com/wp-content/plugins/neo-pulse-wp/kwb-neo-pulse-sync-once.php?key=${token}`,
  `https://www.kwbllp.com/wp-content/plugins/neo-pulse-wp/kwb-neo-pulse-sync-once.php?key=${token}`,
];
let synced = false;
for (const onceUrl of onceUrls) {
  console.log("Running sync once...");
  try {
    const res = await fetch(onceUrl);
    const text = await res.text();
    console.log("sync status", res.status);
    console.log(text.trim().slice(0, 500));
    if (res.ok && text.includes("ok")) {
      synced = true;
      break;
    }
  } catch (err) {
    console.log("sync fetch failed", err.message);
  }
}
if (!synced) {
  console.error("Sync once did not confirm; plugin files are uploaded. Check activation.");
}

const sftp = await connect(kwb);
try {
  const base = `${kwbRoot}/neo-pulse-wp`;
  const main = (await sftp.get(`${base}/neo-pulse-wp.php`)).toString("utf8");
  const rag = (await sftp.get(`${base}/includes/class-neo-pulse-wp-chat-rag.php`)).toString("utf8");
  const agents = (await sftp.get(`${base}/includes/class-neo-pulse-wp-chat-agents.php`)).toString("utf8");
  const envRemote = (await sftp.get(`${base}/.env`)).toString("utf8");
  const chatPhp = (await sftp.get(`${base}/includes/class-neo-pulse-wp-chat.php`)).toString("utf8");
  console.log("remote version", main.match(/Version:\s*([^\n]+)/)?.[1]?.trim());
  console.log("remote chat config identifier", chatPhp.includes("'neoPulseChatConfig'") && !chatPhp.includes("neo-pulseChatConfig"));
  console.log("remote RAG window covering hardcoded", /window covering/i.test(rag));
  console.log("remote agents Hunter Douglas hardcoded", /Hunter Douglas/i.test(agents));
  console.log("remote .env OpenRouter", keyMeta(pickKey(parseEnv(envRemote))));
  try {
    await sftp.stat(`${base}/kwb-neo-pulse-sync-once.php`);
    console.log("once.php still present");
  } catch {
    console.log("once.php self-deleted");
  }
} finally {
  await sftp.end();
}

console.log("KWB Neo Pulse deploy finished");
