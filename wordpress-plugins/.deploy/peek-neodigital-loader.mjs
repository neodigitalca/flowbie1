import { readFileSync, writeFileSync } from "fs";
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
const remote = "./wp-content/plugins/neo-pulse-app/includes/class-neo-pulse-app-loader.php";
const buf = await sftp.get(remote);
const text = buf.toString("utf8");
writeFileSync(join(import.meta.dirname, "neodigital-title-sync", "live-loader.php"), text);
console.log("bytes", buf.length);
console.log("has_agentmail", text.includes("agentmail"));
console.log("line79", text.split(/\r?\n/)[78] ?? "");
await sftp.end();
