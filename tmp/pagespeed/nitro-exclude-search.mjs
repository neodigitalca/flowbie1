import { readFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../wordpress-plugins/.deploy/wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
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

const files = [
  "./wp-content/plugins/nitropack/helpers.php",
  "./wp-content/plugins/nitropack/constants.php",
  "./wp-content/plugins/nitropack/functions.php",
];
for (const f of files) {
  const body = (await sftp.get(f)).toString("utf8");
  const needles = ["exclude", "nitro-exclude", "data-nitro", "font", "webfont"];
  for (const n of needles) {
    let idx = 0;
    let hits = 0;
    const lower = body.toLowerCase();
    while (hits < 3) {
      const found = lower.indexOf(n, idx);
      if (found < 0) break;
      console.log(f, n, JSON.stringify(body.slice(Math.max(0, found - 40), found + 80).replace(/\s+/g, " ")));
      idx = found + n.length;
      hits += 1;
    }
  }
}
await sftp.end();
