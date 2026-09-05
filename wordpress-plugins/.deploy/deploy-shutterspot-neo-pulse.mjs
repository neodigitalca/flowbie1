/**
 * Deploy untrained neo-pulse-wp to shutterspot.com.
 * Chat: administrators only. Chekkit off.
 *
 * Usage: node wordpress-plugins/.deploy/deploy-shutterspot-neo-pulse.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { randomBytes } from "crypto";
import SftpClient from "ssh2-sftp-client";
import { buildPluginZip } from "../deploy/lib/build-zip.js";
import { deployZip } from "../deploy/lib/deploy-zip.js";
import { loadProductionSites } from "../deploy/lib/csv-sites.js";

const dir = join(import.meta.dirname, "..");
const repoRoot = join(dir, "..");
const csvPath = join(dir, "Customer List", "SFTP Users_Clients List.csv");
const zipPath = join(dir, "neo-pulse-wp.zip");
const pluginDir = join(dir, "neo-pulse-wp");
const envPath = join(pluginDir, ".env");
const onceSrc = join(dir, ".deploy", "shutterspot-neo-pulse-sync-once.php");
const generatedDir = join(dir, ".deploy");

const SFTP_OPTS = {
  readyTimeout: 45000,
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

async function putFile(site, localPath, remotePath) {
  const sftp = await connect(site);
  try {
    await sftp.put(localPath, remotePath);
  } finally {
    await sftp.end();
  }
}

async function copyEnvFromKwb(kwb) {
  const sftp = await connect(kwb);
  try {
    const buf = await sftp.get("./wp-content/plugins/neo-pulse-wp/.env");
    return buf.toString("utf8");
  } catch {
    return "";
  } finally {
    await sftp.end();
  }
}

const sites = loadProductionSites(csvPath);
const site = sites.find((row) => row.site === "shutterspot.com");
const kwb = sites.find((row) => row.site === "kwbllp.com");
if (!site) {
  console.error("shutterspot.com not found in production CSV");
  process.exit(1);
}

execSync("node scripts/embed-wp-secrets.mjs", { cwd: repoRoot, stdio: "inherit" });

let orKey = existsSync(envPath) ? pickKey(parseEnv(readFileSync(envPath, "utf8"))) : "";
if (!orKey && kwb) {
  console.log("Local OpenRouter key missing; copying from KWB plugin .env");
  orKey = pickKey(parseEnv(await copyEnvFromKwb(kwb)));
  if (orKey) {
    writeFileSync(
      envPath,
      `# Generated for Shutter Spot Neo Pulse deploy — do not commit\n\nNEO_PULSE_WP_OPENROUTER_API_KEY=${orKey}\nOPENROUTER_API_KEY=${orKey}\n`,
      "utf8",
    );
  }
}
if (!orKey) {
  throw new Error("OpenRouter key missing");
}
console.log("OpenRouter key", keyMeta(orKey));

console.log("Building neo-pulse-wp zip...");
buildPluginZip(pluginDir, zipPath, (done, total) => {
  process.stdout.write(`\r zip ${Math.round((done / total) * 100)}%`);
});
process.stdout.write("\n");

console.log("Deploying to", site.label, site.host);
const result = await deployZip(site, zipPath, pluginDir, (phase, done, total) => {
  process.stdout.write(`\r ${phase} ${Math.round((done / total) * 100)}%`);
});
process.stdout.write("\n");
if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}

console.log("Uploading .env...");
await putFile(site, envPath, "./wp-content/plugins/neo-pulse-wp/.env");

const token = randomBytes(16).toString("hex");
mkdirSync(generatedDir, { recursive: true });
const generatedOnce = join(generatedDir, "shutterspot-neo-pulse-sync-once.generated.php");
writeFileSync(generatedOnce, readFileSync(onceSrc, "utf8").replace("SHUTTER_SYNC_TOKEN", token), "utf8");
execSync(`php -l "${generatedOnce}"`, { stdio: "inherit" });
await putFile(site, generatedOnce, "./wp-content/plugins/neo-pulse-wp/shutterspot-neo-pulse-sync-once.php");

const onceUrls = [
  `https://shutterspot.com/wp-content/plugins/neo-pulse-wp/shutterspot-neo-pulse-sync-once.php?key=${token}`,
  `https://www.shutterspot.com/wp-content/plugins/neo-pulse-wp/shutterspot-neo-pulse-sync-once.php?key=${token}`,
];
let synced = false;
for (const onceUrl of onceUrls) {
  console.log("Running sync once...");
  try {
    const res = await fetch(onceUrl, { redirect: "follow" });
    const text = await res.text();
    console.log("sync status", res.status);
    console.log(text.trim().slice(0, 800));
    if (res.ok && text.includes("ok") && !/critical error|Fatal error|Parse error/i.test(text)) {
      synced = true;
      break;
    }
  } catch (err) {
    console.log("sync fetch failed", err.message);
  }
}
if (!synced) {
  console.error("Sync once did not confirm; plugin files are uploaded.");
  process.exit(1);
}

const sftp = await connect(site);
try {
  const base = "./wp-content/plugins/neo-pulse-wp";
  const main = (await sftp.get(`${base}/neo-pulse-wp.php`)).toString("utf8");
  const chatPhp = (await sftp.get(`${base}/includes/class-neo-pulse-wp-chat.php`)).toString("utf8");
  const widgetJs = (await sftp.get(`${base}/assets/frontend/neo-pulse-chat-widget.js`)).toString("utf8");
  console.log("remote version", main.match(/Version:\s*([^\n]+)/)?.[1]?.trim());
  console.log("remote admin_only gate", chatPhp.includes("admin_only"));
  console.log("remote chekkit flag gate", widgetJs.includes("function cfgFlagOn"));
  try {
    await sftp.stat(`${base}/shutterspot-neo-pulse-sync-once.php`);
    console.log("once.php still present");
  } catch {
    console.log("once.php self-deleted");
  }
} finally {
  await sftp.end();
}

const home = await fetch("https://shutterspot.com/", {
  redirect: "follow",
  headers: { "Cache-Control": "no-cache" },
});
const homeHtml = await home.text();
console.log("homepage status", home.status);
console.log("homepage critical", /There has been a critical error|Fatal error|Parse error/i.test(homeHtml) ? "YES" : "no");
console.log("homepage guest chat config", /neoPulseChatConfig/.test(homeHtml) ? "present" : "absent");

console.log("Shutter Spot Neo Pulse deploy finished");
