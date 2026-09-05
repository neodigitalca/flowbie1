/**
 * Download In The Shade plugins and themes by top-level folder (downloadDir).
 * Faster than recursive list+get. Resumable enough: re-run overwrites.
 */
import { mkdirSync, existsSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  (await import("fs")).readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "intheshadeflorida.com" && !r.isStaging);
const DEST = join(process.env.USERPROFILE || "C:/Users/Sean Craig", "wp-local", "intheshade");
const LOG = join(DEST, "pull.log");
const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
  ],
};
const SKIP_PLUGINS = new Set(["autoupdater", "wpe-configuration"]);

function log(msg) {
  console.log(msg);
  mkdirSync(DEST, { recursive: true });
  appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`);
}

async function connect() {
  const sftp = new SftpClient();
  await sftp.connect({
    host: site.host,
    port: site.port,
    username: site.username,
    password: site.password,
    readyTimeout: 45000,
    algorithms: ALGOS,
  });
  return sftp;
}

const sftp = await connect();
try {
  log("connected for folder download");
  for (const kind of ["plugins", "themes"]) {
    const remoteRoot = `./wp-content/${kind}`;
    const localRoot = join(DEST, "wp-content", kind);
    mkdirSync(localRoot, { recursive: true });
    const entries = await sftp.list(remoteRoot);
    const dirs = entries.filter((e) => e.type === "d" && !SKIP_PLUGINS.has(e.name));
    log(`${kind} folders=${dirs.length}`);
    for (const dir of dirs) {
      const remote = `${remoteRoot}/${dir.name}`;
      const local = join(localRoot, dir.name);
      mkdirSync(local, { recursive: true });
      log(`downloadDir ${kind}/${dir.name}`);
      await sftp.downloadDir(remote, local);
      log(`ok ${kind}/${dir.name}`);
    }
    const files = entries.filter((e) => e.type === "-" && e.name !== "flowbie-wp.zip");
    for (const file of files) {
      const local = join(localRoot, file.name);
      log(`get ${kind}/${file.name}`);
      await sftp.fastGet(`${remoteRoot}/${file.name}`, local);
    }
  }
  writeFileSync(join(DEST, "plugins-themes.done"), new Date().toISOString());
  log("plugins+themes done");
} finally {
  await sftp.end();
}
