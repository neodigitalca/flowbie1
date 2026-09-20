/**
 * Upload pulled Phoenix plugins, themes, and uploads onto flowbie.ca
 * using per-folder uploadDir (avoids nested mkdir races).
 *
 * Usage: node wordpress-plugins/.deploy/clone-phoenix-to-flowbie-push-dirs.mjs [content|uploads|all]
 */
import { existsSync, readdirSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { readFileSync } from "fs";
import SftpClient from "ssh2-sftp-client";

const phase = (process.argv[2] || "all").toLowerCase();
const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const flowbie = catalog.rows.find((r) => r.site === "flowbie.ca" && !r.isStaging);
if (!flowbie) {
  console.error("Missing flowbie.ca catalog row");
  process.exit(1);
}

const SRC = join(process.env.USERPROFILE || "C:/Users/Sean Craig", "wp-local", "phoenix-to-flowbie");
const LOG = join(SRC, "push-dirs.log");
const CONCURRENCY = 3;
const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
  ],
};
const SKIP = new Set([
  "autoupdater",
  "wpe-configuration",
  "ShortpixelBackups",
  "nitropack-logs",
  "flowbie-snapshot",
]);

function log(msg) {
  console.log(msg);
  mkdirSync(SRC, { recursive: true });
  appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`);
}

async function connect() {
  const sftp = new SftpClient();
  await sftp.connect({
    host: flowbie.host,
    port: flowbie.port,
    username: flowbie.username,
    password: flowbie.password,
    readyTimeout: 60000,
    algorithms: ALGOS,
  });
  return sftp;
}

function jobsFrom(localRoot, remoteRoot) {
  if (!existsSync(localRoot)) return [];
  return readdirSync(localRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith("adbc_uploads_"))
    .map((e) => ({
      label: `${remoteRoot.replace("./wp-content/", "")}/${e.name}`,
      local: join(localRoot, e.name),
      remote: `${remoteRoot}/${e.name}`,
    }));
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
      const sftp = await connect();
      try {
        await sftp.uploadDir(job.local, job.remote);
        log(`w${id} ok ${job.label} ${((Date.now() - started) / 1000).toFixed(1)}s`);
      } catch (err) {
        failed += 1;
        log(`w${id} FAIL ${job.label}: ${err.message || err}`);
      } finally {
        await sftp.end().catch(() => {});
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, (_, i) => worker(i + 1)));
  if (failed) process.exit(1);
}

const jobs = [];
if (phase === "content" || phase === "all") {
  jobs.push(...jobsFrom(join(SRC, "wp-content", "plugins"), "./wp-content/plugins"));
  jobs.push(...jobsFrom(join(SRC, "wp-content", "themes"), "./wp-content/themes"));
}
if (phase === "uploads" || phase === "all") {
  jobs.push(...jobsFrom(join(SRC, "wp-content", "uploads"), "./wp-content/uploads"));
}

log(`src=${SRC} phase=${phase}`);
await runQueue(jobs);
log(`done phase=${phase}`);
