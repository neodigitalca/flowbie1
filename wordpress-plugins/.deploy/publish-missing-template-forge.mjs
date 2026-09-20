/**
 * Upload and run the Missing template Full AISEO Forge publisher on neodigital.ca.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
if (!site) {
  console.error("No neodigital.ca catalog row");
  process.exit(1);
}

const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
    "diffie-hellman-group14-sha1",
  ],
};

const token = randomBytes(16).toString("hex");
const outDir = join(import.meta.dirname, "neodigital-forge-missing-template");
mkdirSync(outDir, { recursive: true });

const php = readFileSync(
  join(import.meta.dirname, "nd-publish-missing-template-forge-once.php"),
  "utf8",
).replaceAll("ND_FORGE_TOKEN", token);

const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});

const remote = "./wp-content/plugins/nd-publish-missing-template-forge-once.php";
await sftp.put(Buffer.from(php, "utf8"), remote);
await sftp.end();

const url = `https://neodigital.ca/wp-content/plugins/nd-publish-missing-template-forge-once.php?key=${token}`;
const res = await fetch(url);
const body = await res.text();
writeFileSync(join(outDir, "publish-result.json"), body, "utf8");
console.log("status", res.status);
console.log(body);
if (!res.ok) process.exit(1);
const parsed = JSON.parse(body);
if (!parsed.ok) process.exit(1);
