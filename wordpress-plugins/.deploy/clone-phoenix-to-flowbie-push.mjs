/**
 * Upload pulled Phoenix Painting files onto flowbie.ca.
 * Does not overwrite wp-config.php, mu-plugins, or WP Engine drop-ins.
 *
 * Usage: node wordpress-plugins/.deploy/clone-phoenix-to-flowbie-push.mjs [sql|content|uploads|all]
 */
import { existsSync, statSync, readdirSync, appendFileSync, mkdirSync, createReadStream } from "fs";
import { join, dirname } from "path";
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
const LOG = join(SRC, "push.log");
const CONCURRENCY = 5;
const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
  ],
};

const SKIP_DIRS = new Set([
  "flowbie-snapshot",
  "cache",
  "upgrade",
  "upgrade-temp-backup",
  ".logs",
  "drop-ins",
  "ShortpixelBackups",
  "nitropack-logs",
  "wpe-configuration",
  "autoupdater",
]);
const SKIP_FILES = new Set([
  "object-cache.php",
  "advanced-cache.php",
  "wp-config.php",
  "pull.log",
  "push.log",
  "table-prefix.txt",
]);

function log(msg) {
  console.log(msg);
  mkdirSync(SRC, { recursive: true });
  appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`);
}

function walkLocal(abs, files, remotePrefix) {
  if (!existsSync(abs)) return;
  const entries = readdirSync(abs, { withFileTypes: true });
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith("adbc_uploads_")) continue;
    const nextAbs = join(abs, e.name);
    const nextRemote = `${remotePrefix}/${e.name}`.replace(/\/+/g, "/");
    if (e.isDirectory()) {
      walkLocal(nextAbs, files, nextRemote);
    } else if (e.isFile()) {
      if (SKIP_FILES.has(e.name)) continue;
      files.push({ local: nextAbs, remote: nextRemote, size: statSync(nextAbs).size });
    }
  }
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

const EXISTING_DIRS = new Set([
  "./wp-content/plugins",
  "./wp-content/themes",
  "./wp-content/uploads",
]);

async function ensureDir(sftp, remoteFile) {
  const dir = dirname(remoteFile).replace(/\\/g, "/");
  if (!dir || dir === "." || EXISTING_DIRS.has(dir)) return;
  await sftp.mkdir(dir, true);
}

async function push(files) {
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  log(`queued ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  const queue = files.slice();
  let got = 0;
  let skipped = 0;
  let failed = 0;
  let doneBytes = 0;
  async function worker(id) {
    const sftp = await connect();
    try {
      while (queue.length) {
        const item = queue.shift();
        if (!item) break;
        try {
          let exists = false;
          try {
            const st = await sftp.stat(item.remote);
            exists = Number(st.size || 0) === item.size;
          } catch {
            exists = false;
          }
          if (exists) {
            skipped += 1;
            doneBytes += item.size;
          } else {
            log(`w${id} start ${item.remote} ${(item.size / 1024 / 1024).toFixed(1)} MB`);
            await ensureDir(sftp, item.remote);
            if (item.size > 5 * 1024 * 1024) {
              await sftp.put(createReadStream(item.local), item.remote);
            } else {
              await sftp.fastPut(item.local, item.remote);
            }
            got += 1;
            doneBytes += item.size;
          }
          const n = got + skipped;
          if (n % 25 === 0 || item.remote.endsWith("mysql.sql") || item.size > 5 * 1024 * 1024) {
            const pct = totalBytes ? ((doneBytes / totalBytes) * 100).toFixed(1) : "0";
            log(`w${id} ${exists ? "skip" : "put"} ${item.remote} (${pct}%)`);
          }
        } catch (err) {
          failed += 1;
          log(`FAIL ${item.remote}: ${err.message || err}`);
        }
      }
    } finally {
      await sftp.end().catch(() => {});
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
  log(`phase done put=${got} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

const files = [];
if (phase === "sql" || phase === "all") {
  const localGz = join(SRC, "wp-content", "mysql.sql.gz");
  const localSql = join(SRC, "wp-content", "mysql.sql");
  if (existsSync(localGz)) {
    files.push({
      local: localGz,
      remote: "./wp-content/plugins/phoenix-restore-mysql.sql.gz",
      size: statSync(localGz).size,
    });
  } else if (existsSync(localSql)) {
    files.push({
      local: localSql,
      remote: "./wp-content/plugins/phoenix-restore-mysql.sql",
      size: statSync(localSql).size,
    });
  } else {
    console.error("Missing local mysql.sql. Run the pull first.");
    process.exit(1);
  }
}
if (phase === "content" || phase === "all") {
  walkLocal(join(SRC, "wp-content", "plugins"), files, "./wp-content/plugins");
  walkLocal(join(SRC, "wp-content", "themes"), files, "./wp-content/themes");
}
if (phase === "uploads" || phase === "all") {
  walkLocal(join(SRC, "wp-content", "uploads"), files, "./wp-content/uploads");
}

log(`src=${SRC} phase=${phase}`);
await push(files);
log("push done");
