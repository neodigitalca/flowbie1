/**
 * SFTP upload React dist only to /flowbie/ on WP Engine.
 * Run: node wordpress-plugins/deploy-flowbie-app-dist-only.js
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, dirname, posix } from "path";
import { fileURLToPath } from "url";
import SftpClient from "ssh2-sftp-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const localDistDir = join(repoRoot, "dist");
const CONCURRENCY = 8;

const HTACCESS = `# Flowbie SPA fallback
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /flowbie/
RewriteRule ^index\\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /flowbie/index.html [L]
</IfModule>
`;

function loadConfig() {
  const configPath =
    process.env.FLOWBIE_WPENGINE_CONFIG || join(__dirname, "flowbie-wpengine.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const password =
    config.passwordPath && existsSync(config.passwordPath)
      ? readFileSync(config.passwordPath, "utf8").trim()
      : config.password;
  return {
    host: String(config.host).replace(/^sftp:\/\//, ""),
    port: config.port || 2222,
    username: config.username,
    password,
    distRemotePath: (config.flowbieDistRemotePath || "/flowbie").replace(/\/+$/, ""),
  };
}

function collectFiles(root) {
  const files = [];
  const dirs = new Set();
  function walk(absDir, relPosix) {
    for (const ent of readdirSync(absDir, { withFileTypes: true })) {
      if (ent.name === "." || ent.name === "..") continue;
      const nextRel = relPosix ? `${relPosix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        dirs.add(nextRel);
        walk(join(absDir, ent.name), nextRel);
      } else if (ent.isFile()) {
        files.push({ local: join(absDir, ent.name), remoteRel: nextRel, size: statSync(join(absDir, ent.name)).size });
      }
    }
  }
  walk(root, "");
  return { files, dirs: [...dirs].sort((a, b) => a.length - b.length) };
}

async function connectSftp(config) {
  const sftp = new SftpClient();
  await sftp.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
  });
  return sftp;
}

async function main() {
  if (!existsSync(localDistDir)) {
    console.error("dist/ missing. Run: npm run build:flowbie-ca");
    process.exit(1);
  }
  writeFileSync(join(localDistDir, ".htaccess"), HTACCESS, "utf8");
  const config = loadConfig();
  const { files, dirs } = collectFiles(localDistDir);
  console.log(`Uploading ${files.length} files to ${config.distRemotePath}`);
  const bootstrap = await connectSftp(config);
  await bootstrap.mkdir(config.distRemotePath, true);
  for (const d of dirs) await bootstrap.mkdir(posix.join(config.distRemotePath, d), true);
  await bootstrap.end();

  const queue = files.slice();
  let done = 0;
  async function worker() {
    const sftp = await connectSftp(config);
    try {
      while (queue.length) {
        const item = queue.shift();
        if (!item) break;
        await sftp.fastPut(item.local, posix.join(config.distRemotePath, item.remoteRel));
        done += 1;
        process.stdout.write(`\r  ${done}/${files.length}`);
      }
    } finally {
      await sftp.end();
    }
  }
  const n = Math.min(CONCURRENCY, Math.max(1, files.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
