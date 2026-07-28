/**
 * SFTP deploy: React dist + flowbie-app plugin to WP Engine (flowbie.ca).
 *
 * Config: FLOWBIE_WPENGINE_CONFIG env, or wordpress-plugins/flowbie-wpengine.config.json
 *
 * Run from repo root:
 *   npm run build:flowbie-ca
 *   npm run deploy:flowbie-ca
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, dirname, posix } from "path";
import { fileURLToPath } from "url";
import SftpClient from "ssh2-sftp-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const localDistDir = join(repoRoot, "dist");
const localPluginDir = join(__dirname, "flowbie-app");
const CONCURRENCY = 8;

const HTACCESS = `# Flowbie SPA fallback (WP Engine /public/flowbie/)
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /flowbie/
RewriteRule ^index\\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /flowbie/index.html [L]
</IfModule>
`;

const SKIP_DIR_NAMES = new Set(["tests", ".git", "node_modules"]);

function loadConfig() {
  const configPath =
    process.env.FLOWBIE_WPENGINE_CONFIG || join(__dirname, "flowbie-wpengine.config.json");
  if (!existsSync(configPath)) {
    console.error("Missing config:", configPath);
    console.error("Create wordpress-plugins/flowbie-wpengine.config.json with SFTP credentials.");
    process.exit(1);
  }
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (e) {
    console.error("Invalid JSON:", configPath, e.message);
    process.exit(1);
  }
  if (!config.host || !config.username) {
    console.error("Config must include host and username.");
    process.exit(1);
  }
  let password = config.password;
  if (config.passwordPath && existsSync(config.passwordPath)) {
    password = readFileSync(config.passwordPath, "utf8").trim();
  }
  if (!password) {
    console.error("Config must include password or passwordPath.");
    process.exit(1);
  }
  return {
    site: config.site || "https://flowbie.ca/",
    host: String(config.host).replace(/^sftp:\/\//, ""),
    port: config.port || 2222,
    username: config.username,
    password,
    distRemotePath: (config.flowbieDistRemotePath || "/flowbie").replace(/\/+$/, ""),
    pluginRemotePath: (config.flowbieAppRemotePath || "/wp-content/plugins/flowbie-app").replace(/\/+$/, ""),
  };
}

function shouldSkipDir(name) {
  return SKIP_DIR_NAMES.has(name);
}

function collectFiles(root, skipRootMd = false) {
  const files = [];
  const dirs = new Set();

  function walk(absDir, relPosix) {
    for (const ent of readdirSync(absDir, { withFileTypes: true })) {
      if (ent.name === "." || ent.name === "..") continue;
      if (ent.isDirectory()) {
        if (shouldSkipDir(ent.name)) continue;
        const nextRel = relPosix ? `${relPosix}/${ent.name}` : ent.name;
        dirs.add(nextRel);
        walk(join(absDir, ent.name), nextRel);
        continue;
      }
      if (!ent.isFile()) continue;
      if (skipRootMd && !relPosix && ent.name.toLowerCase().endsWith(".md")) continue;
      const nextRel = relPosix ? `${relPosix}/${ent.name}` : ent.name;
      files.push({
        local: join(absDir, ent.name),
        remoteRel: nextRel,
        size: statSync(join(absDir, ent.name)).size,
      });
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

async function ensureDirs(sftp, remoteRoot, dirs) {
  await sftp.mkdir(remoteRoot, true);
  for (const d of dirs) {
    await sftp.mkdir(posix.join(remoteRoot, d), true);
  }
}

async function uploadPool(config, remoteRoot, files) {
  const queue = files.slice();
  let done = 0;
  const total = files.length;
  const workers = [];

  async function worker() {
    const sftp = await connectSftp(config);
    try {
      while (queue.length) {
        const item = queue.shift();
        if (!item) break;
        const remote = posix.join(remoteRoot, item.remoteRel);
        await sftp.fastPut(item.local, remote);
        done += 1;
        process.stdout.write(`\r  ${done}/${total} files uploaded`);
      }
    } finally {
      await sftp.end();
    }
  }

  const n = Math.min(CONCURRENCY, Math.max(1, files.length));
  for (let i = 0; i < n; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  if (total) process.stdout.write("\n");
}

async function deployTree(config, label, localRoot, remoteRoot, skipRootMd = false) {
  if (!existsSync(localRoot)) {
    console.error(`${label}: local folder not found:`, localRoot);
    process.exit(1);
  }
  const { files, dirs } = collectFiles(localRoot, skipRootMd);
  const bytes = files.reduce((n, f) => n + f.size, 0);
  console.log(`\n=== ${label} ===`);
  console.log("Remote:", remoteRoot);
  console.log(`  ${files.length} files (${(bytes / (1024 * 1024)).toFixed(2)} MB)`);
  const bootstrap = await connectSftp(config);
  try {
    await ensureDirs(bootstrap, remoteRoot, dirs);
  } finally {
    await bootstrap.end();
  }
  await uploadPool(config, remoteRoot, files);
}

async function main() {
  const config = loadConfig();

  if (!existsSync(localDistDir)) {
    console.error("dist/ not found. Run: npm run build:flowbie-ca");
    process.exit(1);
  }

  const htaccessPath = join(localDistDir, ".htaccess");
  writeFileSync(htaccessPath, HTACCESS, "utf8");

  console.log("Deploy target:", config.site);
  console.log("Host:", `${config.host}:${config.port}`);
  console.log("User:", config.username);

  await deployTree(config, "React dist", localDistDir, config.distRemotePath);
  await deployTree(config, "flowbie-app plugin", localPluginDir, config.pluginRemotePath, true);

  console.log("\n=== Done ===");
  console.log("SPA:", `${config.site.replace(/\/+$/, "")}/flowbie/`);
  console.log("Activate flowbie-app in WP admin and flush permalinks if /api/* 404s.");
}

main().catch((err) => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});
