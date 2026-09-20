/**
 * Restore neo-pulse-wp on neodigital.ca and hit the one-shot activator.
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
const outDir = join(import.meta.dirname, "neodigital-fatal");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "activate-token.txt"), token, "utf8");

const php = readFileSync(join(import.meta.dirname, "nd-activate-neo-pulse-wp-once.php"), "utf8").replace(
  "ND_ACTIVATE_TOKEN",
  token,
);

const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});

const live = "./wp-content/plugins/neo-pulse-wp";
const off = "./wp-content/plugins/neo-pulse-wp.off";
if (await sftp.exists(off)) {
  if (!(await sftp.exists(live))) {
    await sftp.rename(off, live);
    console.log("restored neo-pulse-wp");
  } else {
    console.log("live folder already present");
  }
} else if (await sftp.exists(live)) {
  console.log("neo-pulse-wp already live");
} else {
  console.error("neo-pulse-wp folder missing");
  await sftp.end();
  process.exit(1);
}

const remote = "./wp-content/plugins/nd-activate-neo-pulse-wp-once.php";
await sftp.put(Buffer.from(php, "utf8"), remote);
await sftp.end();

const url = `https://neodigital.ca/wp-content/plugins/nd-activate-neo-pulse-wp-once.php?key=${token}`;
console.log("hitting activator");
const res = await fetch(url);
const body = await res.text();
console.log("status", res.status);
console.log(body);
