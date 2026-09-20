import { readFileSync } from "node:fs";
import { join } from "node:path";
import SftpClient from "ssh2-sftp-client";
import { neodigitalCatalogRow } from "../../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const site = neodigitalCatalogRow();
const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: {
    serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
    kex: ["curve25519-sha256", "ecdh-sha2-nistp256", "diffie-hellman-group14-sha256", "diffie-hellman-group-exchange-sha256"],
  },
});
for (const rel of ["./robots.txt", "./wp-content/uploads/elementor/css"]) {
  try {
    const st = await sftp.stat(rel);
    console.log(rel, st.isFile ? "file" : "dir", st.size);
  } catch (err) {
    console.log(rel, "missing", String(err.message).slice(0, 80));
  }
}
await sftp.end();
const res = await fetch("https://neodigital.ca/robots.txt", { cache: "no-store" });
console.log("robots_http", res.status);
console.log(await res.text());
