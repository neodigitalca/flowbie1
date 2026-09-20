import { readFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const flowbie = catalog.rows.find((r) => r.site === "flowbie.ca" && !r.isStaging);
const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
  ],
};
const sftp = new SftpClient();
await sftp.connect({
  host: flowbie.host,
  port: flowbie.port,
  username: flowbie.username,
  password: flowbie.password,
  readyTimeout: 20000,
  algorithms: ALGOS,
});
for (const p of [
  "./wp-content/plugins/phoenix-restore-state.json",
  "./wp-content/plugins/phoenix-restore-error.json",
]) {
  try {
    await sftp.delete(p);
    console.log("deleted", p);
  } catch (e) {
    console.log("skip", p, e.message);
  }
}
await sftp.end();
