import { readdirSync, statSync } from "fs";
import { join, posix } from "path";
import SftpClient from "ssh2-sftp-client";

const REMOTE_ZIP = "./wp-content/plugins/flowbie-wp.zip";
const PLUGIN_ROOT = "./wp-content/plugins/flowbie-wp";
const PLUGIN_PHP = "./wp-content/plugins/flowbie-wp/flowbie-wp.php";
const CONCURRENCY = 8;
const SKIP_DIRS = new Set(["tests", ".git", "node_modules"]);

function shouldSkip(rel) {
  if (rel.split("/").some((p) => SKIP_DIRS.has(p))) return true;
  if (!rel.includes("/") && rel.toLowerCase().endsWith(".md")) return true;
  return false;
}

export function collectPluginFiles(root, rel = "") {
  const files = [];
  const dirs = new Set();
  for (const ent of readdirSync(join(root, rel), { withFileTypes: true })) {
    const nextRel = rel ? `${rel}/${ent.name}` : ent.name;
    if (shouldSkip(nextRel.replace(/\\/g, "/"))) continue;
    if (ent.isDirectory()) {
      dirs.add(nextRel.replace(/\\/g, "/"));
      const sub = collectPluginFiles(root, nextRel);
      files.push(...sub.files);
      for (const d of sub.dirs) dirs.add(d);
    } else if (ent.isFile()) {
      files.push({
        local: join(root, nextRel),
        rel: nextRel.replace(/\\/g, "/"),
      });
    }
  }
  return { files, dirs };
}

async function connect(siteRow) {
  const sftp = new SftpClient();
  await sftp.connect({
    host: siteRow.host,
    port: siteRow.port,
    username: siteRow.username,
    password: siteRow.password,
    readyTimeout: 30000,
  });
  return sftp;
}

async function installToRemote(siteRow, localDir, remoteRoot, onProgress) {
  const { files, dirs } = collectPluginFiles(localDir);
  const queue = files.slice();
  let done = 0;

  async function worker() {
    const sftp = await connect(siteRow);
    try {
      while (queue.length) {
        const item = queue.shift();
        if (!item) break;
        await sftp.fastPut(item.local, posix.join(remoteRoot, item.rel));
        done += 1;
        onProgress?.(done, files.length);
      }
    } finally {
      await sftp.end();
    }
  }

  const bootstrap = await connect(siteRow);
  try {
    await bootstrap.mkdir(remoteRoot, true);
    for (const d of [...dirs].sort((a, b) => a.length - b.length)) {
      await bootstrap.mkdir(posix.join(remoteRoot, d), true);
    }
  } finally {
    await bootstrap.end();
  }

  const workers = Math.min(CONCURRENCY, Math.max(1, files.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

/** Upload one zip, then install from local tree (same pattern as flowbie-wp clients). */
export async function uploadZipAndInstall(siteRow, options) {
  const {
    zipPath,
    localDir,
    remoteZipPath,
    installRoot,
    verifyRelPath,
    onProgress,
  } = options;

  const totalBytes = statSync(zipPath).size;
  const remoteZipDir = remoteZipPath.replace(/\/[^/]+$/, "") || ".";

  const sftp = await connect(siteRow);
  try {
    await sftp.mkdir(remoteZipDir, true);
    await sftp.fastPut(zipPath, remoteZipPath, {
      step: (transferred) => onProgress?.("upload", transferred, totalBytes),
    });
  } finally {
    await sftp.end();
  }

  onProgress?.("install", 0, 1);
  await installToRemote(siteRow, localDir, installRoot, (done, total) => {
    onProgress?.("install", done, total);
  });

  if (verifyRelPath) {
    const check = await connect(siteRow);
    try {
      await check.stat(posix.join(installRoot, verifyRelPath));
    } finally {
      await check.end();
    }
  }

  return { ok: true };
}

export async function deployZip(siteRow, zipPath, pluginDir, onProgress) {
  try {
    await uploadZipAndInstall(siteRow, {
      zipPath,
      localDir: pluginDir,
      remoteZipPath: REMOTE_ZIP,
      installRoot: PLUGIN_ROOT,
      verifyRelPath: "flowbie-wp.php",
      onProgress,
    });
    return { ok: true, site: siteRow.label };
  } catch (e) {
    return { ok: false, site: siteRow.label, error: e.message };
  }
}
