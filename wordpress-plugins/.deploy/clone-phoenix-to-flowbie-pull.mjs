/**
 * Pull Phoenix Painting from WP Engine SFTP for restore onto flowbie.ca.
 * Also snapshots flowbie's current mysql.sql so the test site can be put back.
 * Resumable. Does not print passwords.
 *
 * Usage: node wordpress-plugins/.deploy/clone-phoenix-to-flowbie-pull.mjs [sql|content|uploads|flowbie-sql|all]
 */
import { mkdirSync, existsSync, statSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { readFileSync } from "fs";
import SftpClient from "ssh2-sftp-client";

const phase = (process.argv[2] || "all").toLowerCase();
const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const phoenix = catalog.rows.find((r) => r.site === "phoenixpainting.ca" && !r.isStaging);
const flowbie = catalog.rows.find((r) => r.site === "flowbie.ca" && !r.isStaging);
if (!phoenix || !flowbie) {
  console.error("Missing catalog rows");
  process.exit(1);
}

const DEST = join(process.env.USERPROFILE || "C:/Users/Sean Craig", "wp-local", "phoenix-to-flowbie");
const LOG = join(DEST, "pull.log");
const CONCURRENCY = 6;
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
  "cache",
  "upgrade",
  "upgrade-temp-backup",
  ".logs",
  "drop-ins",
  "ShortpixelBackups",
  "nitropack-logs",
  "wpe-configuration",
  "autoupdater",
  "wpengine-common",
  "wpe-cache-plugin",
  "wpe-wp-sign-on-plugin",
  "wpe-update-source-selector",
  "force-strong-passwords",
]);
const SKIP_FILES = new Set([
  "object-cache.php",
  "advanced-cache.php",
  "flowbie-wp.zip",
  "wpe-update-source-selector.php",
  "wpengine-security-auditor.php",
  "wpe-cache-plugin.php",
  "wpe-wp-sign-on-plugin.php",
  "mu-plugin.php",
  "slt-force-strong-passwords.php",
]);

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(msg);
  mkdirSync(DEST, { recursive: true });
  appendFileSync(LOG, line + "\n");
}

function localPath(remote) {
  const rel = remote.replace(/^\.\//, "").replace(/\\/g, "/");
  return join(DEST, ...rel.split("/"));
}

async function connect(site) {
  const sftp = new SftpClient();
  await sftp.connect({
    host: site.host,
    port: site.port,
    username: site.username,
    password: site.password,
    readyTimeout: 60000,
    algorithms: ALGOS,
  });
  return sftp;
}

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name) || name.startsWith("adbc_uploads_");
}

async function walk(sftp, remote, files) {
  const list = await sftp.list(remote);
  for (const e of list) {
    const next = `${remote}/${e.name}`.replace(/\/+/g, "/");
    if (e.type === "d") {
      if (shouldSkipDir(e.name)) continue;
      await walk(sftp, next, files);
    } else if (e.type === "-" || e.type === "l") {
      if (SKIP_FILES.has(e.name)) continue;
      files.push({ remote: next, size: Number(e.size || 0) });
    }
  }
}

async function downloadOne(sftp, item, destRoot = DEST) {
  const rel = item.remote.replace(/^\.\//, "").replace(/\\/g, "/");
  const dest = join(destRoot, ...rel.split("/"));
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest) && statSync(dest).size === item.size) return "skip";
  await sftp.fastGet(item.remote, dest);
  return "get";
}

async function pull(site, files, destRoot = DEST) {
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  log(`queued ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  const queue = files.slice();
  let got = 0;
  let skipped = 0;
  let failed = 0;
  let doneBytes = 0;
  async function worker(id) {
    const sftp = await connect(site);
    try {
      while (queue.length) {
        const item = queue.shift();
        if (!item) break;
        try {
          const result = await downloadOne(sftp, item, destRoot);
          if (result === "skip") skipped += 1;
          else got += 1;
          doneBytes += item.size;
          const n = got + skipped;
          if (n % 25 === 0 || item.remote.endsWith("mysql.sql")) {
            const pct = totalBytes ? ((doneBytes / totalBytes) * 100).toFixed(1) : "0";
            log(`w${id} ${result} ${item.remote} (${pct}%)`);
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
  log(`phase done got=${got} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

mkdirSync(DEST, { recursive: true });
log(`dest=${DEST} phase=${phase}`);

if (phase === "flowbie-sql" || phase === "all") {
  const sftp = await connect(flowbie);
  try {
    const st = await sftp.stat("./wp-content/mysql.sql");
    await pull(
      flowbie,
      [{ remote: "./wp-content/mysql.sql", size: Number(st.size || 0) }],
      join(DEST, "flowbie-snapshot"),
    );
  } finally {
    await sftp.end().catch(() => {});
  }
}

if (phase === "sql" || phase === "all") {
  const sftp = await connect(phoenix);
  const files = [];
  try {
    for (const root of ["./wp-content/mysql.sql", "./.htaccess"]) {
      const exists = await sftp.exists(root);
      if (!exists) {
        log(`missing ${root}`);
        continue;
      }
      const st = await sftp.stat(root);
      files.push({ remote: root, size: Number(st.size || 0) });
    }
  } finally {
    await sftp.end().catch(() => {});
  }
  await pull(phoenix, files);
}

if (phase === "content" || phase === "all") {
  const sftp = await connect(phoenix);
  const files = [];
  try {
    log("walk plugins + themes");
    await walk(sftp, "./wp-content/plugins", files);
    await walk(sftp, "./wp-content/themes", files);
  } finally {
    await sftp.end().catch(() => {});
  }
  await pull(phoenix, files);
}

if (phase === "uploads" || phase === "all") {
  const sftp = await connect(phoenix);
  const files = [];
  try {
    log("walk uploads");
    await walk(sftp, "./wp-content/uploads", files);
  } finally {
    await sftp.end().catch(() => {});
  }
  await pull(phoenix, files);
}

log(`done dest=${DEST}`);
