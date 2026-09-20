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

async function peek(rel) {
  try {
    const rows = await sftp.list(rel);
    console.log(rel, rows.length, rows.slice(0, 8).map((r) => r.type + r.name).join(" "));
  } catch (err) {
    console.log(rel, "ERR", err.message.slice(0, 80));
  }
}

await peek("./wp-content/cache");
await peek("./wp-content/nitropack");
await peek("./wp-content/plugins/nitropack");
await peek("./");
await sftp.end();
