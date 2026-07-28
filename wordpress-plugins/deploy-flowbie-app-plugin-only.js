/**
 * SFTP upload flowbie-app plugin only (no React dist).
 * Run: node wordpress-plugins/deploy-flowbie-app-plugin-only.js
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname, posix } from "path";
import { fileURLToPath } from "url";
import SftpClient from "ssh2-sftp-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localRoot = join(__dirname, "flowbie-app");
const configPath =
  process.env.FLOWBIE_WPENGINE_CONFIG || join(__dirname, "flowbie-wpengine.config.json");

if (!existsSync(configPath)) {
  console.error("Missing config:", configPath);
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const remoteRoot = (config.flowbieAppRemotePath || "/wp-content/plugins/flowbie-app").replace(/\/+$/, "");
const password =
  config.passwordPath && existsSync(config.passwordPath)
    ? readFileSync(config.passwordPath, "utf8").trim()
    : config.password;

function walk(abs, rel, files, dirs) {
  for (const ent of readdirSync(abs, { withFileTypes: true })) {
    if (ent.name === "tests" || ent.name === ".git" || ent.name === "node_modules") continue;
    const next = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      dirs.add(next);
      walk(join(abs, ent.name), next, files, dirs);
    } else if (ent.isFile()) {
      files.push({ local: join(abs, ent.name), remoteRel: next });
    }
  }
}

const files = [];
const dirs = new Set();
walk(localRoot, "", files, dirs);

const sftp = new SftpClient();
await sftp.connect({
  host: String(config.host).replace(/^sftp:\/\//, ""),
  port: config.port || 2222,
  username: config.username,
  password,
});
await sftp.mkdir(remoteRoot, true);
for (const d of [...dirs].sort((a, b) => a.length - b.length)) {
  await sftp.mkdir(posix.join(remoteRoot, d), true);
}
for (const f of files) {
  await sftp.fastPut(f.local, posix.join(remoteRoot, f.remoteRel));
}
await sftp.end();
console.log(`Uploaded ${files.length} files to ${remoteRoot}`);
