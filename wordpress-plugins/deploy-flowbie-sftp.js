/**
 * SFTP deploy: local wordpress-plugins/flowbie-wp/ → WP Engine (flowbie.ca).
 *
 * Uses SFTP only (host / user / password / port). WP Engine cannot extract
 * archives over SFTP, so files are synced directly with parallel uploads.
 *
 * Config: FLOWBIE_WPENGINE_CONFIG env, or wordpress-plugins/flowbie-wpengine.config.json
 *
 * Run from repo root: npm run deploy:flowbie-plugin
 * Or: wordpress-plugins\upload-flowbie.bat
 */

import {
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, dirname, posix } from 'path';
import { fileURLToPath } from 'url';
import SftpClient from 'ssh2-sftp-client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localPluginDir = join(__dirname, 'flowbie-wp');
const CONCURRENCY = 8;

const DEFAULT_CONFIG = {
  site: 'https://flowbie.ca/',
  host: 'flowbietest.sftp.wpengine.com',
  port: 2222,
  username: '',
  password: '',
  remotePath: '/wp-content/plugins/flowbie-wp',
};

const SKIP_DIR_NAMES = new Set(['tests', '.git', 'node_modules']);

function loadConfig() {
  const configPath =
    process.env.FLOWBIE_WPENGINE_CONFIG || join(__dirname, 'flowbie-wpengine.config.json');
  let config = { ...DEFAULT_CONFIG };
  if (existsSync(configPath)) {
    try {
      config = { ...config, ...JSON.parse(readFileSync(configPath, 'utf8')) };
    } catch (e) {
      console.error('Invalid JSON:', configPath, e.message);
      process.exit(1);
    }
  } else {
    console.error('Missing config file:', configPath);
    console.error('Create wordpress-plugins/flowbie-wpengine.config.json with host, username, password, remotePath.');
    process.exit(1);
  }
  if (!config.host || !config.username) {
    console.error('Config must include host and username.');
    process.exit(1);
  }
  let password = config.password;
  if (config.passwordPath && existsSync(config.passwordPath)) {
    password = readFileSync(config.passwordPath, 'utf8').trim();
  }
  if (!password) {
    console.error('Config must include password or passwordPath.');
    process.exit(1);
  }
  let remotePath = (config.remotePath || '').replace(/\/+$/, '');
  if (!remotePath) {
    console.error('Config must include remotePath (e.g. /wp-content/plugins/flowbie-wp).');
    process.exit(1);
  }
  return {
    site: config.site || DEFAULT_CONFIG.site,
    host: String(config.host).replace(/^sftp:\/\//, ''),
    port: config.port || 2222,
    username: config.username,
    password,
    remotePath,
  };
}

function shouldSkipDir(name) {
  return SKIP_DIR_NAMES.has(name);
}

function collectFiles(root) {
  const files = [];
  const dirs = new Set();

  function walk(absDir, relPosix) {
    for (const ent of readdirSync(absDir, { withFileTypes: true })) {
      if (ent.name === '.' || ent.name === '..') continue;
      if (ent.isDirectory()) {
        if (shouldSkipDir(ent.name)) continue;
        const nextRel = relPosix ? `${relPosix}/${ent.name}` : ent.name;
        dirs.add(nextRel);
        walk(join(absDir, ent.name), nextRel);
        continue;
      }
      if (!ent.isFile()) continue;
      // Skip markdown only at plugin root
      if (!relPosix && ent.name.toLowerCase().endsWith('.md')) continue;
      const nextRel = relPosix ? `${relPosix}/${ent.name}` : ent.name;
      files.push({
        local: join(absDir, ent.name),
        remoteRel: nextRel,
        size: statSync(join(absDir, ent.name)).size,
      });
    }
  }

  walk(root, '');
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
  if (total) process.stdout.write('\n');
}

async function main() {
  if (!existsSync(localPluginDir)) {
    console.error('Local plugin folder not found:', localPluginDir);
    process.exit(1);
  }

  const config = loadConfig();
  const remoteRoot = config.remotePath.replace(/\\/g, '/');

  try {
    console.log('Deploy target:', config.site);
    console.log('=== SFTP upload ===');
    console.log('Host:', `${config.host}:${config.port}`);
    console.log('User:', config.username);
    console.log('Remote:', remoteRoot);

    const { files, dirs } = collectFiles(localPluginDir);
    const bytes = files.reduce((n, f) => n + f.size, 0);
    console.log(`  ${files.length} files (${(bytes / (1024 * 1024)).toFixed(2)} MB), concurrency ${CONCURRENCY}`);

    console.log('Ensuring remote directories...');
    const bootstrap = await connectSftp(config);
    try {
      await ensureDirs(bootstrap, remoteRoot, dirs);
    } finally {
      await bootstrap.end();
    }

    console.log('Uploading...');
    await uploadPool(config, remoteRoot, files);
    console.log('=== Done ===');
  } catch (err) {
    console.error('Deploy failed:', err.message);
    process.exit(1);
  }
}

main();
