/**
 * Prefix + uploads size probe. Does not print DB passwords.
 */
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const phoenix = catalog.rows.find((r) => r.site === "phoenixpainting.ca" && !r.isStaging);
const flowbie = catalog.rows.find((r) => r.site === "flowbie.ca" && !r.isStaging);

const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
  ],
};

function prefixFromConfig(buf) {
  const text = buf.toString("utf8");
  const m = text.match(/\$table_prefix\s*=\s*'([^']+)'/);
  return m ? m[1] : null;
}

async function connect(site) {
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

async function listUploads(sftp) {
  const top = await sftp.list("./wp-content/uploads");
  const years = [];
  let listedBytes = 0;
  let listedFiles = 0;
  for (const item of top) {
    if (item.type === "-") {
      listedBytes += item.size;
      listedFiles += 1;
      continue;
    }
    if (item.type !== "d") continue;
    if (["cache", "wpo", "shortpixel", "nitropack", "woocommerce_uploads"].includes(item.name)) {
      years.push({ name: item.name, skippedHint: true });
      continue;
    }
    const children = await sftp.list(`./wp-content/uploads/${item.name}`);
    const months = [];
    for (const child of children) {
      months.push({ name: child.name, type: child.type, size: child.size });
      if (child.type === "-") {
        listedBytes += child.size;
        listedFiles += 1;
      }
    }
    years.push({ name: item.name, entries: months.length, months });
  }
  return { top: top.map((i) => ({ name: i.name, type: i.type, size: i.size })), years, listedBytes, listedFiles };
}

async function listThemes(sftp) {
  const items = await sftp.list("./wp-content/themes");
  return items.filter((i) => i.type === "d").map((i) => i.name);
}

const dest = join(process.env.USERPROFILE || "C:/Users/Sean Craig", "wp-local", "phoenix-to-flowbie");
mkdirSync(dest, { recursive: true });

const out = {};
for (const [label, site] of [
  ["phoenix", phoenix],
  ["flowbie", flowbie],
]) {
  const sftp = await connect(site);
  try {
    const cfg = await sftp.get("./wp-config.php");
    writeFileSync(join(dest, `${label}-wp-config.php`), cfg);
    out[label] = {
      prefix: prefixFromConfig(cfg),
      themes: await listThemes(sftp),
      uploads: await listUploads(sftp),
    };
  } finally {
    await sftp.end();
  }
}

console.log(JSON.stringify(out, null, 2));
