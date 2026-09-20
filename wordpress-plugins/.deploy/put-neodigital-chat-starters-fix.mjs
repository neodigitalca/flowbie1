/**
 * Upload the chat-starters TypeError fix to neodigital.ca and re-check wp-admin.
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

const local = join(
  import.meta.dirname,
  "..",
  "neo-pulse-wp",
  "includes",
  "class-neo-pulse-wp-chat-starters.php",
);
const remote = "./wp-content/plugins/neo-pulse-wp/includes/class-neo-pulse-wp-chat-starters.php";

const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});
await sftp.put(local, remote);
console.log("uploaded starters fix");

const token = randomBytes(16).toString("hex");
const outDir = join(import.meta.dirname, "neodigital-fatal");
mkdirSync(outDir, { recursive: true });
const php = readFileSync(join(import.meta.dirname, "nd-full-admin-once.php"), "utf8").replace(
  "ND_FULL_ADMIN_TOKEN",
  token,
);
await sftp.put(Buffer.from(php, "utf8"), "./wp-content/plugins/nd-full-admin-once.php");
await sftp.end();

const url = `https://neodigital.ca/wp-content/plugins/nd-full-admin-once.php?key=${token}`;
const res = await fetch(url);
const body = await res.text();
console.log("status", res.status);
const cut = body.indexOf("<!DOCTYPE");
const head = cut === -1 ? body : body.slice(0, Math.min(cut, 800));
console.log(head);
writeFileSync(join(outDir, "full-admin-after.html"), body, "utf8");
console.log("has_critical", body.includes("critical error") ? "yes" : "no");
console.log("has_typeerror", body.includes("TypeError") ? "yes" : "no");
