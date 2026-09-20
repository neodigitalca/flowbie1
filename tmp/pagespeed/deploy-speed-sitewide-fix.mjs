/**
 * Push Speed cache-flush / exclude fixes to neodigital.ca.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import SftpClient from "ssh2-sftp-client";
import { neodigitalCatalogRow } from "../../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const site = neodigitalCatalogRow();
const root = join(import.meta.dirname, "../../wordpress-plugins/neo-pulse-wp");
const files = [
  "includes/class-neo-pulse-wp-cache-flush.php",
  "includes/class-neo-pulse-wp-speed.php",
  "includes/class-neo-pulse-wp-speed-excludes.php",
];

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
      "diffie-hellman-group14-sha1",
    ],
  },
});
for (const rel of files) {
  const local = join(root, rel);
  const remote = `./wp-content/plugins/neo-pulse-wp/${rel}`;
  await sftp.put(local, remote);
  const remoteText = (await sftp.get(remote)).toString("utf8");
  const localText = readFileSync(local, "utf8");
  if (remoteText !== localText) {
    throw new Error(`verify failed ${rel}`);
  }
  console.log("put", rel, localText.split("\n").length, "lines");
}
await sftp.end();
console.log("deployed", files.length);
