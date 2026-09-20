/**
 * Pull neodigital.ca PHP / WP Engine logs and confirm plugin folders.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
if (!site) {
  console.error("No neodigital.ca catalog row");
  process.exit(1);
}

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

async function ls(p) {
  try {
    const items = await sftp.list(p);
    console.log("DIR", p);
    for (const e of items) {
      console.log(`${e.type || "?"} ${e.name} ${e.size || 0} ${e.modifyTime || ""}`);
    }
    return items;
  } catch (e) {
    console.log("NO", p, e.message);
    return [];
  }
}

await ls("./wp-content/plugins");
await ls("./wp-content/.logs");
await ls("./_wpeprivate");
await ls("./wp-content/mu-plugins");

const candidates = [
  "wp-content/debug.log",
  "wp-content/.logs/php-errors.log",
  "wp-content/.logs/error.log",
  "wp-content/.logs/php.log",
  "_wpeprivate/error_log",
  "error_log",
  "wp-content/uploads/wc-logs",
];

for (const p of candidates) {
  try {
    if (await sftp.exists("./" + p)) {
      const buf = await sftp.get("./" + p);
      writeFileSync(join(outDir, p.replaceAll("/", "__")), buf);
      console.log("GOT", p, buf.length);
    }
  } catch (e) {
    console.log("ERR", p, e.message);
  }
}

const logDir = "./wp-content/.logs";
if (await sftp.exists(logDir)) {
  const items = await sftp.list(logDir);
  for (const e of items) {
    if (e.type !== "-" || e.size < 1) continue;
    try {
      const buf = await sftp.get(`${logDir}/${e.name}`);
      writeFileSync(join(outDir, `logs__${e.name}`), buf);
      console.log("GOTLOG", e.name, buf.length);
    } catch (err) {
      console.log("ERRLOG", e.name, err.message);
    }
  }
}

console.log("wp", await sftp.exists("./wp-content/plugins/neo-pulse-wp/neo-pulse-wp.php"));
console.log("app", await sftp.exists("./wp-content/plugins/neo-pulse-app/neo-pulse-app.php"));
await sftp.end();
