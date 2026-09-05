/**
 * Targeted Neo Digital SFTP pull: theme CSS, Elementor post CSS, Rank Math / EA TOC.
 */
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
if (!site) {
  console.error("No neodigital.ca catalog row");
  process.exit(1);
}

const DEST = join(import.meta.dirname, "neodigital-toc-pull");
const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
  ],
};

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

async function downloadFile(sftp, remote) {
  const dest = join(DEST, remote.replace(/^\.\//, "").replace(/\//g, "__"));
  mkdirSync(dirname(dest), { recursive: true });
  const buf = await sftp.get(remote);
  writeFileSync(dest, buf);
  console.log("got", remote, Number(buf.length || 0));
  return dest;
}

async function walkFiles(sftp, remote, depth, pred, acc) {
  if (depth > 4) return;
  let list;
  try {
    list = await sftp.list(remote);
  } catch {
    return;
  }
  for (const e of list) {
    const next = `${remote}/${e.name}`;
    if (e.type === "d") {
      if (["vendor", "node_modules", ".git", "languages"].includes(e.name)) continue;
      await walkFiles(sftp, next, depth + 1, pred, acc);
    } else if (pred(e.name, next)) {
      acc.push(next);
    }
  }
}

const sftp = await connect();
mkdirSync(DEST, { recursive: true });

const roots = [
  "./wp-content/themes/ygency",
  "./wp-content/plugins/ygency-toolkit",
  "./wp-content/uploads/elementor/css",
];

const files = [];
for (const root of roots) {
  await walkFiles(
    sftp,
    root,
    0,
    (name) => /\.(css|scss)$/i.test(name),
    files,
  );
}

const extraGlobs = [];
for (const plugin of [
  "seo-by-rank-math",
  "seo-by-rank-math-pro",
  "essential-addons-for-elementor-lite",
  "essential-addons-elementor",
  "elementor-pro",
]) {
  await walkFiles(
    sftp,
    `./wp-content/plugins/${plugin}`,
    0,
    (name, path) => /\.(css|scss)$/i.test(name) && /toc|table-of-content/i.test(`${name} ${path}`),
    extraGlobs,
  );
}

const all = [...new Set([...files, ...extraGlobs])];
console.log("candidates", all.length);
const downloaded = [];
for (const remote of all) {
  try {
    downloaded.push(await downloadFile(sftp, remote));
  } catch (err) {
    console.log("skip", remote, err.message);
  }
}

await sftp.end();
writeFileSync(join(DEST, "downloaded-targeted.txt"), downloaded.join("\n"));
console.log("done", downloaded.length);
