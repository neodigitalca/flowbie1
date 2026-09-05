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
const dir = "./wp-content/plugins/neo-pulse-app/includes/agentmail";
await sftp.chmod(dir, 0o755);
await sftp.chmod(`${dir}/class-agentmail-api.php`, 0o644);
await sftp.chmod(`${dir}/class-agentmail-inbound-store.php`, 0o644);
await sftp.chmod("./wp-content/plugins/neo-pulse-app/includes/webhook/class-agentmail-webhook.php", 0o644);
await sftp.end();
console.log("chmod ok");
