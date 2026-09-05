/**
 * Deploy neo-pulse-wp to intheshadeflorida.com (logged-in chat only).
 *
 * Usage: node wordpress-plugins/.deploy/deploy-intheshade-neo-pulse.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { randomBytes } from "crypto";
import SftpClient from "ssh2-sftp-client";
import { buildPluginZip } from "../deploy/lib/build-zip.js";
import { uploadZipAndInstall } from "../deploy/lib/deploy-zip.js";

const dir = join(import.meta.dirname, "..");
const repoRoot = join(dir, "..");
const zipPath = join(dir, "neo-pulse-wp.zip");
const pluginDir = join(dir, "neo-pulse-wp");
const catalogPath = join(dir, ".deploy", "wpengine-sftp-catalog.json");
const onceSrc = join(dir, ".deploy", "its-neo-pulse-sync-once.php");
const envPath = join(pluginDir, ".env");
const generatedDir = join(dir, ".deploy");
const kbPath = join(generatedDir, "its-kb.json");

const SFTP_OPTS = {
  readyTimeout: 45000,
  algorithms: {
    serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
    kex: [
      "curve25519-sha256",
      "ecdh-sha2-nistp256",
      "diffie-hellman-group14-sha256",
      "diffie-hellman-group-exchange-sha256",
    ],
  },
};

function catalogRow() {
  const parsed = JSON.parse(readFileSync(catalogPath, "utf8"));
  const rows = parsed.rows || parsed.sites || [];
  const row = rows.find(
    (r) => r.site === "intheshadeflorida.com" && r.username === "intheshade-neopulse" && !r.isStaging,
  );
  if (!row) {
    throw new Error("No intheshade-neopulse catalog row");
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
    ...SFTP_OPTS,
  });
  return sftp;
}

async function resolvePluginsRoot(site) {
  const sftp = await connect(site);
  try {
    for (const candidate of ["./wp-content/plugins", "wp-content/plugins"]) {
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
    return list
      .filter((e) => e.type === "d")
      .map((e) => e.name)
      .sort();
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

function phpString(value) {
  return "'" + String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

const site = catalogRow();
console.log("ITS SFTP user", site.username, site.host);

const pluginsRoot = await resolvePluginsRoot(site);
console.log("plugins root", pluginsRoot);
const plugins = await listPluginDirs(site, pluginsRoot);
console.log(
  "plugin matches:",
  plugins.filter((n) => /pulse|flowbie/i.test(n)).join(", ") || "(none)",
);

execSync("node scripts/embed-wp-secrets.mjs", { cwd: repoRoot, stdio: "inherit" });
if (!existsSync(envPath) || !pickKey(parseEnv(readFileSync(envPath, "utf8")))) {
  throw new Error("OpenRouter key missing after embed-wp-secrets");
}
console.log("OpenRouter key", keyMeta(pickKey(parseEnv(readFileSync(envPath, "utf8")))));

const localKb = join(process.env.USERPROFILE || "", "wp-local", "intheshade", "its-kb.json");
if (existsSync(localKb)) {
  mkdirSync(generatedDir, { recursive: true });
  copyFileSync(localKb, kbPath);
}
if (!existsSync(kbPath)) {
  throw new Error("its-kb.json missing");
}
const kbJson = JSON.stringify(JSON.parse(readFileSync(kbPath, "utf8")));

console.log("Building neo-pulse-wp zip...");
buildPluginZip(pluginDir, zipPath, (done, total) => {
  process.stdout.write(`\r zip ${Math.round((done / total) * 100)}%`);
});
process.stdout.write("\n");

console.log("Deploying zip to In The Shade...");
await uploadZipAndInstall(site, {
  zipPath,
  localDir: pluginDir,
  remoteZipPath: `${pluginsRoot}/neo-pulse-wp.zip`,
  installRoot: `${pluginsRoot}/neo-pulse-wp`,
  verifyRelPath: "neo-pulse-wp.php",
  onProgress: (phase, done, total) => {
    process.stdout.write(`\r ${phase} ${Math.round((done / total) * 100)}%`);
  },
});
process.stdout.write("\n");

console.log("Uploading .env...");
await putFile(site, envPath, `${pluginsRoot}/neo-pulse-wp/.env`);

const token = randomBytes(16).toString("hex");
mkdirSync(generatedDir, { recursive: true });
const generatedOnce = join(generatedDir, "its-neo-pulse-sync-once.generated.php");
let onceBody = readFileSync(onceSrc, "utf8").replace("ITS_SYNC_TOKEN", token);
onceBody = onceBody.replace("ITS_KB_JSON", phpString(kbJson));
writeFileSync(generatedOnce, onceBody, "utf8");
execSync(`php -l "${generatedOnce}"`, { stdio: "inherit" });
await putFile(site, generatedOnce, `${pluginsRoot}/neo-pulse-wp/its-neo-pulse-sync-once.php`);

const onceUrls = [
  `https://intheshadeflorida.com/wp-content/plugins/neo-pulse-wp/its-neo-pulse-sync-once.php?key=${token}`,
  `https://www.intheshadeflorida.com/wp-content/plugins/neo-pulse-wp/its-neo-pulse-sync-once.php?key=${token}`,
];
let synced = false;
let syncText = "";
for (const onceUrl of onceUrls) {
  console.log("Running sync once...");
  try {
    const res = await fetch(onceUrl, { redirect: "follow" });
    syncText = await res.text();
    console.log("sync status", res.status);
    console.log(syncText.trim().slice(0, 800));
    if (res.ok && syncText.includes("ok") && !/critical error|Fatal error|Parse error/i.test(syncText)) {
      synced = true;
      break;
    }
  } catch (err) {
    console.log("sync fetch failed", err.message);
  }
}
if (!synced) {
  console.error("Sync once did not confirm; plugin files are uploaded.");
  process.exitCode = 1;
}

const sftp = await connect(site);
try {
  const base = `${pluginsRoot}/neo-pulse-wp`;
  const main = (await sftp.get(`${base}/neo-pulse-wp.php`)).toString("utf8");
  const chatPhp = (await sftp.get(`${base}/includes/class-neo-pulse-wp-chat.php`)).toString("utf8");
  const shell = (await sftp.get(`${base}/includes/admin/trait-admin-wp-shell.php`)).toString("utf8");
  console.log("remote version", main.match(/Version:\s*([^\n]+)/)?.[1]?.trim());
  console.log("remote god mode whitelist", chatPhp.includes("current_user_email_is_neodigital"));
  console.log("remote logged_in_only gate", chatPhp.includes("logged_in_only"));
  console.log("remote admin hook matcher", shell.includes("function admin_hook_matches"));
  try {
    await sftp.stat(`${base}/its-neo-pulse-sync-once.php`);
    console.log("once.php still present");
  } catch {
    console.log("once.php self-deleted");
  }
} finally {
  await sftp.end();
}

const home = await fetch("https://intheshadeflorida.com/?neo_pulse_deploy_check=1", {
  redirect: "follow",
  headers: { "Cache-Control": "no-cache" },
});
const homeHtml = await home.text();
console.log("homepage status", home.status);
console.log("homepage critical", /There has been a critical error|Fatal error|Parse error/i.test(homeHtml) ? "YES" : "no");
console.log("homepage guest chat config", /neoPulseChatConfig|flowbieChatConfig/.test(homeHtml) ? "present" : "absent");

console.log("In The Shade Neo Pulse deploy finished");
