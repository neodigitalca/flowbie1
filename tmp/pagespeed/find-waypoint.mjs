import { readFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../wordpress-plugins/.deploy/wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: {
    serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
    kex: [
      "curve25519-sha256",
      "ecdh-sha2-nistp256",
      "diffie-hellman-group14-sha256",
      "diffie-hellman-group-exchange-sha256",
    ],
  },
});

const roots = [
  "./wp-content/themes/ygency",
  "./wp-content/plugins/elementor",
  "./wp-content/plugins/elementor-pro",
];

async function walk(rel, depth, hits) {
  if (depth < 0 || hits.length >= 12) return;
  let rows;
  try {
    rows = await sftp.list(rel);
  } catch {
    return;
  }
  for (const row of rows) {
    if (hits.length >= 12) return;
    const path = rel + "/" + row.name;
    if (row.type === "d") {
      if (row.name === "node_modules" || row.name === ".git") continue;
      await walk(path, depth - 1, hits);
      continue;
    }
    if (!row.name.endsWith(".js") && !row.name.endsWith(".php")) continue;
    const body = (await sftp.get(path)).toString("utf8");
    if (!body.includes("elementorFrontend.waypoint") && !body.includes("frontend.waypoint")) continue;
    const idx = body.indexOf("waypoint");
    hits.push(path + " :: " + body.slice(Math.max(0, idx - 50), idx + 80).replace(/\s+/g, " "));
  }
}

const hits = [];
for (const root of roots) {
  await walk(root, 4, hits);
}
console.log(hits.join("\n") || "no hits");
await sftp.end();
