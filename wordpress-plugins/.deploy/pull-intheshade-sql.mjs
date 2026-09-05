/**
 * Download only mysql.sql + wp-config.php so Docker can import while the
 * full plugin/theme pull continues.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { readFileSync } from "fs";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "intheshadeflorida.com" && !r.isStaging);
const DEST = join(process.env.USERPROFILE || "C:/Users/Sean Craig", "wp-local", "intheshade");
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
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});
try {
  for (const remote of ["./wp-content/mysql.sql", "./wp-config.php", "./.htaccess"]) {
    const dest = join(DEST, ...remote.replace(/^\.\//, "").split("/"));
    mkdirSync(dirname(dest), { recursive: true });
    console.log(`get ${remote}`);
    await sftp.fastGet(remote, dest);
    console.log(`ok ${remote}`);
  }
  const cfg = readFileSync(join(DEST, "wp-config.php"), "utf8");
  const prefixMatch = cfg.match(/\$table_prefix\s*=\s*'([^']+)'/);
  const prefix = prefixMatch ? prefixMatch[1] : "wp_";
  writeFileSync(join(DEST, "table-prefix.txt"), prefix);
  console.log(`table prefix=${prefix}`);
} finally {
  await sftp.end();
}
