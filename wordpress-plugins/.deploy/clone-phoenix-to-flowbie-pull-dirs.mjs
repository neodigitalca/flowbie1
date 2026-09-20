/**
 * Pull Phoenix plugins, themes, and uploads via per-folder downloadDir.
 * SQL dumps are pulled separately by clone-phoenix-to-flowbie-pull.mjs.
 *
 * Usage: node wordpress-plugins/.deploy/clone-phoenix-to-flowbie-pull-dirs.mjs [content|uploads|all]
 */
import { mkdirSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import { readFileSync } from "fs";
import SftpClient from "ssh2-sftp-client";

const phase = (process.argv[2] || "all").toLowerCase();
const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const phoenix = catalog.rows.find((r) => r.site === "phoenixpainting.ca" && !r.isStaging);
if (!phoenix) {
  console.error("Missing phoenixpainting.ca catalog row");
  process.exit(1);
}

const DEST = join(process.env.USERPROFILE || "C:/Users/Sean Craig", "wp-local", "phoenix-to-flowbie");
const LOG = join(DEST, "pull-dirs.log");
const CONCURRENCY = 4;
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
const SKIP_UPLOAD_DIRS = new Set(["ShortpixelBackups", "nitropack-logs"]);

function log(msg) {
  console.log(msg);
  mkdirSync(DEST, { recursive: true });
  appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`);
}

async function connect() {
  const sftp = new SftpClient();
  await sftp.connect({
    host: phoenix.host,
    port: phoenix.port,
    username: phoenix.username,
    password: phoenix.password,
    readyTimeout: 60000,
    algorithms: ALGOS,
  });
  return sftp;
}

async function downloadDir(remote, local) {
  mkdirSync(local, { recursive: true });
  const sftp = await connect();
  try {
    await sftp.downloadDir(remote, local);
  } finally {
    await sftp.end().catch(() => {});
  }
}

async function runQueue(jobs) {
  log(`jobs=${jobs.length} concurrency=${CONCURRENCY}`);
  const queue = jobs.slice();
  let failed = 0;
  async function worker(id) {
    while (queue.length) {
      const job = queue.shift();
      if (!job) break;
      const started = Date.now();
      log(`w${id} start ${job.label}`);
      try {
        await downloadDir(job.remote, job.local);
        log(`w${id} ok ${job.label} ${((Date.now() - started) / 1000).toFixed(1)}s`);
      } catch (err) {
        failed += 1;
        log(`w${id} FAIL ${job.label}: ${err.message || err}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, (_, i) => worker(i + 1)));
  if (failed) process.exit(1);
}

const sftp = await connect();
const jobs = [];
try {
  if (phase === "content" || phase === "all") {
    const plugins = await sftp.list("./wp-content/plugins");
    for (const e of plugins.filter((x) => x.type === "d")) {
      if (SKIP_PLUGINS.has(e.name) || e.name.startsWith("wpe-")) continue;
      jobs.push({
        label: `plugins/${e.name}`,
        remote: `./wp-content/plugins/${e.name}`,
        local: join(DEST, "wp-content", "plugins", e.name),
      });
    }
    const themes = await sftp.list("./wp-content/themes");
    for (const e of themes.filter((x) => x.type === "d")) {
      jobs.push({
        label: `themes/${e.name}`,
        remote: `./wp-content/themes/${e.name}`,
        local: join(DEST, "wp-content", "themes", e.name),
      });
    }
  }
  if (phase === "uploads" || phase === "all") {
    const uploads = await sftp.list("./wp-content/uploads");
    for (const e of uploads.filter((x) => x.type === "d")) {
      if (SKIP_UPLOAD_DIRS.has(e.name) || e.name.startsWith("adbc_uploads_")) continue;
      jobs.push({
        label: `uploads/${e.name}`,
        remote: `./wp-content/uploads/${e.name}`,
        local: join(DEST, "wp-content", "uploads", e.name),
      });
    }
  }
} finally {
  await sftp.end().catch(() => {});
}

log(`phase=${phase} queued=${jobs.length}`);
await runQueue(jobs);
log(`done phase=${phase}`);
