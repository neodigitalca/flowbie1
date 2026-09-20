/**
 * Deploy neo-pulse-wp to neodigital.ca (God Mode / Backend Assist).
 *
 * Usage: node wordpress-plugins/.deploy/deploy-neodigital-neo-pulse-wp.mjs
 */
import { readFileSync } from "fs";
import { join } from "path";
import { buildPluginZip } from "../deploy/lib/build-zip.js";
import { uploadZipAndInstall } from "../deploy/lib/deploy-zip.js";
import SftpClient from "ssh2-sftp-client";

const dir = join(import.meta.dirname, "..");
const zipPath = join(dir, "neo-pulse-wp.zip");
const pluginDir = join(dir, "neo-pulse-wp");
const catalogPath = join(dir, ".deploy", "wpengine-sftp-catalog.json");

function catalogRow() {
  const parsed = JSON.parse(readFileSync(catalogPath, "utf8"));
  const rows = parsed.rows || parsed.sites || [];
  const row = rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
  if (!row) {
    throw new Error("No neodigital.ca production catalog row");
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

async function connect(site) {
  const sftp = new SftpClient();
  await sftp.connect({
    host: site.host,
    port: site.port,
    username: site.username,
    password: site.password,
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
  });
  return sftp;
}

const site = catalogRow();
console.log("Neo SFTP user", site.username, site.host);

console.log("Building neo-pulse-wp zip...");
buildPluginZip(pluginDir, zipPath, (done, total) => {
  process.stdout.write(`\r zip ${Math.round((done / total) * 100)}%`);
});
process.stdout.write("\n");

console.log("Deploying zip to neodigital.ca...");
await uploadZipAndInstall(site, {
  zipPath,
  localDir: pluginDir,
  remoteZipPath: "./wp-content/plugins/neo-pulse-wp.zip",
  installRoot: "./wp-content/plugins/neo-pulse-wp",
  verifyRelPath: "neo-pulse-wp.php",
  onProgress: (phase, done, total) => {
    process.stdout.write(`\r ${phase} ${Math.round((done / total) * 100)}%`);
  },
});
process.stdout.write("\n");

const sftp = await connect(site);
try {
  const base = "./wp-content/plugins/neo-pulse-wp";
  const main = (await sftp.get(`${base}/neo-pulse-wp.php`)).toString("utf8");
  const expand = (await sftp.get(`${base}/includes/backend-assist/class-neo-pulse-wp-backend-assist-workflow-expand.php`)).toString("utf8");
  const widget = (await sftp.get(`${base}/assets/frontend/neo-pulse-chat-widget.js`)).toString("utf8");
  const harness = (await sftp.get(`${base}/assets/shared/neo-pulse-build-harness.js`)).toString("utf8");
  console.log("remote version", main.match(/Version:\s*([^\n]+)/)?.[1]?.trim());
  console.log("remote per_h2_triplets", expand.includes("compose_prompt_for_h2"));
  console.log("remote backendAssistStepUrl", widget.includes("backendAssistStepUrl"));
  console.log("remote walkPlan", harness.includes("function walkPlan"));
} finally {
  await sftp.end();
}

console.log("neodigital.ca neo-pulse-wp deploy finished");
