/**
 * Pull neodigital.ca theme functions and leftover one-shot plugin files.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
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

const outDir = join(import.meta.dirname, "neodigital-fatal");
mkdirSync(outDir, { recursive: true });

const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});

const themes = await sftp.list("./wp-content/themes");
console.log("THEMES");
for (const e of themes) console.log((e.type || "?") + " " + e.name);

for (const name of ["ygency", "ygency-child"]) {
  const p = `./wp-content/themes/${name}/functions.php`;
  if (await sftp.exists(p)) {
    const buf = await sftp.get(p);
    writeFileSync(join(outDir, `${name}-functions.php`), buf);
    console.log("got", name, buf.length);
  }
}

const plugins = await sftp.list("./wp-content/plugins");
for (const e of plugins) {
  if (e.type === "-" && e.name.startsWith("nd-") && e.name.endsWith(".php")) {
    await sftp.delete(`./wp-content/plugins/${e.name}`);
    console.log("deleted leftover", e.name);
  }
}

await sftp.end();
