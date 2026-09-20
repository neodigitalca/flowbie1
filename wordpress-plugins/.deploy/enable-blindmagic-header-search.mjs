/**
 * Enable Design option: Header search icon opens sidebar on blindmagic.com.
 */
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import SftpClient from "ssh2-sftp-client";
import { loadProductionSites } from "../deploy/lib/csv-sites.js";

const dir = join(import.meta.dirname, "..");
const csvPath = join(dir, "Customer List", "SFTP Users_Clients List.csv");
const onceSrc = join(dir, ".deploy", "blindmagic-enable-header-search-once.php");

const site = loadProductionSites(csvPath).find((s) => s.site === "blindmagic.com");
if (!site) {
  console.error("blindmagic.com not found");
  process.exit(1);
}

const token = randomBytes(16).toString("hex");
const generated = join(dir, ".deploy", "blindmagic-enable-header-search-once.generated.php");
writeFileSync(generated, readFileSync(onceSrc, "utf8").replace("BLINDMAGIC_HEADER_SEARCH_TOKEN", token), "utf8");

const remoteOnce = "./wp-content/plugins/neo-pulse-wp-enable-header-search-once.php";
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
try {
  await sftp.put(generated, remoteOnce);
} finally {
  await sftp.end();
  unlinkSync(generated);
}

const onceUrl = `https://blindmagic.com/wp-content/plugins/neo-pulse-wp-enable-header-search-once.php?key=${token}`;
const res = await fetch(onceUrl, { redirect: "follow" });
const text = await res.text();
let payload;
try {
  payload = JSON.parse(text);
} catch {
  console.error("enable once returned non-JSON", res.status, text.slice(0, 400));
  process.exit(1);
}
if (!payload.ok) {
  console.error(payload);
  process.exit(1);
}
console.log("header_search_opens_sidebar enabled");
