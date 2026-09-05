/**
 * Pull In The Shade from WP Engine SFTP into the local Docker import dir.
 * Phase 1: mysql.sql, wp-config, htaccess, plugins, themes.
 * Phase 2: uploads (skips cache-like folders).
 * Resumable. Does not print passwords.
 *
 * Usage: node wordpress-plugins/.deploy/pull-intheshade-sftp.mjs [phase1|phase2|all]
 */
import { mkdirSync, existsSync, statSync, writeFileSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import SftpClient from "ssh2-sftp-client";

const phase = (process.argv[2] || "phase1").toLowerCase();
const catalog = JSON.parse(
  (await import("fs")).readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "intheshadeflorida.com" && !r.isStaging);
if (!site) {
  console.error("No intheshadeflorida.com catalog row");
  process.exit(1);
}

const DEST = join(process.env.USERPROFILE || "C:/Users/Sean Craig", "wp-local", "intheshade");
const LOG = join(DEST, "pull.log");
const CONCURRENCY = 8;
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
  "metasync_data",
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

async function downloadOne(sftp, item) {
  const dest = localPath(item.remote);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) {
    const st = statSync(dest);
    if (st.size === item.size) return "skip";
  }
  await sftp.fastGet(item.remote, dest);
  return "get";
}

async function pull(files) {
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
          const result = await downloadOne(sftp, item);
          if (result === "skip") skipped += 1;
          else got += 1;
          doneBytes += item.size;
          const n = got + skipped;
          if (n % 40 === 0 || item.remote.endsWith("mysql.sql") || item.remote.endsWith("wp-config.php")) {
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
const walker = await connect();
try {
  log(`connected ${site.username}@${site.host}:${site.port} phase=${phase}`);

  if (phase === "phase1" || phase === "all") {
    const files = [];
    for (const root of ["./wp-content/mysql.sql", "./wp-config.php", "./.htaccess"]) {
      const exists = await walker.exists(root);
      if (!exists) {
        log(`missing ${root}`);
        continue;
      }
      const st = await walker.stat(root);
      files.push({ remote: root, size: Number(st.size || 0) });
    }
    log("walk plugins + themes");
    await walk(walker, "./wp-content/plugins", files);
    await walk(walker, "./wp-content/themes", files);
    await walker.end().catch(() => {});
    await pull(files);

    const cfgPath = localPath("./wp-config.php");
    if (existsSync(cfgPath)) {
      const cfg = (await import("fs")).readFileSync(cfgPath, "utf8");
      const prefixMatch = cfg.match(/\$table_prefix\s*=\s*'([^']+)'/);
      const prefix = prefixMatch ? prefixMatch[1] : "wp_";
      writeFileSync(join(DEST, "table-prefix.txt"), prefix);
      log(`table prefix=${prefix}`);
    }
  } else {
    await walker.end().catch(() => {});
  }

  if (phase === "phase2" || phase === "all") {
    const sftp = await connect();
    const files = [];
    try {
      log("walk uploads");
      await walk(sftp, "./wp-content/uploads", files);
    } finally {
      await sftp.end().catch(() => {});
    }
    await pull(files);
  }
} catch (err) {
  try {
    await walker.end();
  } catch {
    // already closed
  }
  throw err;
}

log(`done dest=${DEST}`);
