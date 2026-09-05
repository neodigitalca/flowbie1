/**
 * Pull Neo Digital theme/plugin CSS related to Table of Contents via WP Engine SFTP.
 * Does not print passwords.
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

const TOC_NAME = /toc|table-of-contents|contents|rank-math|elementor|hello-elementor|generatepress|customiz|additional/i;

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

async function listNames(sftp, remote) {
  try {
    const list = await sftp.list(remote);
    return list.map((e) => ({ name: e.name, type: e.type, size: Number(e.size || 0) }));
  } catch (err) {
    return [{ name: `ERROR ${err.message}`, type: "?", size: 0 }];
  }
}

async function downloadFile(sftp, remote) {
  const dest = join(DEST, remote.replace(/^\.\//, "").replace(/\//g, "__"));
  mkdirSync(dirname(dest), { recursive: true });
  const buf = await sftp.get(remote);
  writeFileSync(dest, buf);
  return dest;
}

const sftp = await connect();
mkdirSync(DEST, { recursive: true });

const plugins = await listNames(sftp, "./wp-content/plugins");
const themes = await listNames(sftp, "./wp-content/themes");
writeFileSync(
  join(DEST, "inventory.json"),
  JSON.stringify(
    {
      plugins: plugins.map((p) => p.name),
      themes: themes.map((t) => t.name),
    },
    null,
    2,
  ),
);
console.log("plugins", plugins.map((p) => p.name).join(", "));
console.log("themes", themes.map((t) => t.name).join(", "));

const pluginHits = plugins.filter((p) => TOC_NAME.test(p.name));
const themeHits = themes.filter((t) => t.type === "d");
console.log("plugin hits", pluginHits.map((p) => p.name).join(", "));

const downloads = [];
for (const theme of themeHits) {
  for (const file of ["style.css", "custom.css", "editor-style.css", "assets/css/custom.css"]) {
    const remote = `./wp-content/themes/${theme.name}/${file}`;
    try {
      if (await sftp.exists(remote)) {
        downloads.push(await downloadFile(sftp, remote));
        console.log("got", remote);
      }
    } catch {
      /* skip */
    }
  }
}

for (const plugin of pluginHits) {
  const root = `./wp-content/plugins/${plugin.name}`;
  const files = [];
  async function walk(remote, depth) {
    if (depth > 3) return;
    let list;
    try {
      list = await sftp.list(remote);
    } catch {
      return;
    }
    for (const e of list) {
      const next = `${remote}/${e.name}`;
      if (e.type === "d") {
        if (["vendor", "node_modules", ".git"].includes(e.name)) continue;
        await walk(next, depth + 1);
      } else if (/\.(css|scss)$/i.test(e.name) || /toc/i.test(e.name)) {
        files.push(next);
      }
    }
  }
  await walk(root, 0);
  for (const remote of files.slice(0, 40)) {
    try {
      downloads.push(await downloadFile(sftp, remote));
      console.log("got", remote);
    } catch (err) {
      console.log("skip", remote, err.message);
    }
  }
}

await sftp.end();
writeFileSync(join(DEST, "downloaded.txt"), downloads.join("\n"));
console.log("done", downloads.length, "files ->", DEST);
