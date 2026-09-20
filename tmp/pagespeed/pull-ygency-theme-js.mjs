import { mkdirSync, writeFileSync, readFileSync } from "fs";
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
const out = join(import.meta.dirname, "ygency-js");
mkdirSync(out, { recursive: true });
for (const name of ["theme.js", "theme.min.js"]) {
  const body = await sftp.get("./wp-content/themes/ygency/assets/js/" + name);
  writeFileSync(join(out, name), body);
  console.log(name, body.length);
}
try {
  const rows = await sftp.list("./wp-content/themes/ygency/assets/js/components");
  console.log("components", rows.map((r) => r.name).join(" "));
} catch (err) {
  console.log("no components", err.message.slice(0, 60));
}
await sftp.end();
