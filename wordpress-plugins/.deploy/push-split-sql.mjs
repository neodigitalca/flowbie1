import { createReadStream, readFileSync, statSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const flowbie = catalog.rows.find((r) => r.site === "flowbie.ca" && !r.isStaging);
const local = join(
  process.env.USERPROFILE || "C:/Users/Sean Craig",
  "wp-local",
  "phoenix-to-flowbie",
  "wp-content",
  "mysql.split.sql.gz",
);
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
console.log("put gz", statSync(local).size);
await sftp.put(createReadStream(local), "./wp-content/plugins/phoenix-restore-mysql.sql.gz");
try {
  await sftp.delete("./wp-content/plugins/phoenix-restore-mysql.sql");
  console.log("deleted old sql");
} catch {
  console.log("no old sql");
}
for (const p of [
  "./wp-content/plugins/phoenix-restore-state.json",
  "./wp-content/plugins/phoenix-restore-error.json",
]) {
  try {
    await sftp.delete(p);
  } catch {
    /* ignore */
  }
}
await sftp.end();
console.log("ready");
