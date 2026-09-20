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
const t0 = Date.now();
const mark = (m) => console.log(`${Date.now() - t0}ms ${m}`);
await sftp.connect({
  host: flowbie.host,
  port: flowbie.port,
  username: flowbie.username,
  password: flowbie.password,
  readyTimeout: 20000,
  algorithms: ALGOS,
});
mark("connected");
const dir = "./wp-content/plugins/_phoenix_mkdir_probe";
await sftp.mkdir(dir, true);
mark("mkdir");
await sftp.put(Buffer.from("x"), `${dir}/t.txt`);
mark("put");
await sftp.delete(`${dir}/t.txt`);
await sftp.rmdir(dir);
mark("cleanup");
await sftp.end();
mark("end");
