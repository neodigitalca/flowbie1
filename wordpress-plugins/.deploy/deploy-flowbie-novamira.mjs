/**
 * Upload Novamira 1.12.2 to flowbie.ca and activate Elementor + AI abilities.
 *
 * Usage: node wordpress-plugins/.deploy/deploy-flowbie-novamira.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import SftpClient from "ssh2-sftp-client";
import { uploadZipAndInstall } from "../deploy/lib/deploy-zip.js";

const dir = join(import.meta.dirname, "..");
const catalogPath = join(dir, ".deploy", "wpengine-sftp-catalog.json");
const zipPath = "C:\\Users\\Sean Craig\\Downloads\\novamira-1.12.2.zip";
const onceSrc = join(dir, ".deploy", "flowbie-novamira-activate-once.php");
const credsPath = join(dir, ".deploy", "flowbie-novamira-creds.json");

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
  const row = rows.find((r) => r.site === "flowbie.ca" && !r.isStaging);
  if (!row?.host || !row?.username || !row?.password) {
    throw new Error("No flowbie.ca catalog row");
  }
  return {
    site: row.site,
    host: row.host,
    port: row.port || 2222,
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
    ...SFTP_OPTS,
  });
  return sftp;
}

const site = catalogRow();
if (!existsSync(zipPath)) {
  throw new Error("Novamira zip missing");
}
if (!existsSync(onceSrc)) {
  throw new Error("Activate once PHP missing");
}

const token = randomBytes(16).toString("hex");
const generatedOnce = join(dir, ".deploy", "flowbie-novamira-activate-once.generated.php");
writeFileSync(generatedOnce, readFileSync(onceSrc, "utf8").replace("FLOWBIE_NOVAMIRA_TOKEN", token), "utf8");

const remoteZip = "./wp-content/plugins/novamira-1.12.2.zip";
const remoteOnce = "./wp-content/plugins/flowbie-novamira-activate-once.php";
const localPlugin = join(dir, ".deploy", "novamira-1.12.2", "novamira");
if (!existsSync(join(localPlugin, "novamira.php"))) {
  throw new Error("Extracted Novamira plugin missing");
}

console.log("Uploading Novamira plugin files...");
await uploadZipAndInstall(site, {
  zipPath,
  localDir: localPlugin,
  remoteZipPath: remoteZip,
  installRoot: "./wp-content/plugins/novamira",
  verifyRelPath: "novamira.php",
  onProgress: (phase, done, total) => {
    if (total && done === total) {
      console.log(`${phase} ${done}/${total}`);
    }
  },
});

const sftp = await connect(site);
try {
  console.log("Uploading activate once...");
  await sftp.put(generatedOnce, remoteOnce);
} finally {
  await sftp.end();
}

const onceUrl = `https://flowbie.ca/wp-content/plugins/flowbie-novamira-activate-once.php?key=${token}`;
console.log("Running activate once...");
const res = await fetch(onceUrl, { redirect: "follow" });
const text = await res.text();
let payload;
try {
  payload = JSON.parse(text);
} catch {
  console.error("Activate once returned non-JSON", res.status, text.slice(0, 400));
  process.exit(1);
}
if (!res.ok || !payload.ok) {
  console.error("Activate once failed", res.status, payload.error || "unknown");
  process.exit(1);
}

writeFileSync(
  credsPath,
  JSON.stringify(
    {
      siteUrl: "https://flowbie.ca",
      username: payload.username,
      appPassword: payload.appPassword,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(
  JSON.stringify(
    {
      wpVersion: payload.wpVersion,
      novamiraActive: payload.novamiraActive,
      elementorActive: payload.elementorActive,
      abilitiesOn: payload.abilitiesOn,
      abilitiesDomain: payload.abilitiesDomain,
      frontPageId: payload.frontPageId,
      frontStatus: payload.frontStatus,
      mcpRoute: payload.mcpRoute,
      usernameSet: Boolean(payload.username),
      credsWritten: true,
    },
    null,
    2,
  ),
);
