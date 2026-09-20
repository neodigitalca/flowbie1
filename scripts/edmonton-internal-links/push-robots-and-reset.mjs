import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import SftpClient from "ssh2-sftp-client";
import { neodigitalCatalogRow, uploadNeodigitalPhp } from "./sftp-oneshot.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const site = neodigitalCatalogRow();
const local = join(dir, "../../wordpress-plugins/neo-pulse-wp/includes/class-neo-pulse-wp-robots-txt.php");
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
await sftp.put(local, "./wp-content/plugins/neo-pulse-wp/includes/class-neo-pulse-wp-robots-txt.php");
await sftp.end();
console.log("uploaded robots class");

const php = readFileSync(join(dir, "run-oneshot-robots-reset.php"), "utf8");
const { url } = await uploadNeodigitalPhp(php, "oneshot-robots-reset");
const res = await fetch(url, { cache: "no-store" });
console.log("reset", res.status, await res.text());
