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
const root = join(import.meta.dirname, "..", "neo-pulse-app");
const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});
const dir = "./wp-content/plugins/neo-pulse-app/includes/agentmail";
if (!(await sftp.exists(dir))) {
  await sftp.mkdir(dir, true);
}
const files = [
  "includes/agentmail/class-agentmail-api.php",
  "includes/agentmail/class-agentmail-inbound-store.php",
  "includes/webhook/class-agentmail-webhook.php",
];
for (const rel of files) {
  const remote = `./wp-content/plugins/neo-pulse-app/${rel}`;
  await sftp.put(join(root, rel), remote);
  console.log("put", remote);
}
await sftp.end();
console.log("agentmail ok");
