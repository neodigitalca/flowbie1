import { readFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
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
const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});
const base = "./wp-content/plugins/neo-pulse-app/includes";
const list = await sftp.list(base);
console.log("includes", list.map((x) => x.name).join(","));
const am = `${base}/agentmail`;
console.log("agentmail_exists", await sftp.exists(am));
if (await sftp.exists(am)) {
  const files = await sftp.list(am);
  console.log("agentmail_files", files.map((x) => x.name + ":" + x.size).join(","));
}
await sftp.end();
