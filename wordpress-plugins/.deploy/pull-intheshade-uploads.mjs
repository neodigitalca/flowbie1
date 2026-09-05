/**
 * Pull In The Shade uploads with the new intheshade-neopulse SFTP user.
 */
import { mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const DEST = join(process.env.USERPROFILE || "C:/Users/Sean Craig", "wp-local", "intheshade");
const LOG = join(DEST, "pull.log");
const CONCURRENCY = 5;
const SKIP = new Set(["ShortpixelBackups", "nitropack-logs", "wp-migrate-db"]);
const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
  ],
};

function log(msg) {
  console.log(msg);
  mkdirSync(DEST, { recursive: true });
  appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`);
}

async function connect() {
  const sftp = new SftpClient();
  await sftp.connect({
    host: "intheshade.sftp.wpengine.com",
    port: 2222,
    username: "intheshade-neopulse",
    password: "NEOPulse2026!",
    readyTimeout: 45000,
    algorithms: ALGOS,
  });
  return sftp;
}

const probe = await connect();
const uploads = await probe.list("./wp-content/uploads");
await probe.end();
const jobs = uploads
  .filter((e) => e.type === "d" && !SKIP.has(e.name) && !e.name.startsWith("adbc_uploads_"))
  .map((e) => ({
    label: `uploads/${e.name}`,
    remote: `./wp-content/uploads/${e.name}`,
    local: join(DEST, "wp-content", "uploads", e.name),
  }));
log(`uploads jobs=${jobs.length}`);
const queue = jobs.slice();
let failed = 0;
async function worker(id) {
  while (queue.length) {
    const job = queue.shift();
    if (!job) break;
    const started = Date.now();
    log(`w${id} start ${job.label}`);
    mkdirSync(job.local, { recursive: true });
    const sftp = await connect();
    try {
      await sftp.downloadDir(job.remote, job.local);
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
log("uploads done");
