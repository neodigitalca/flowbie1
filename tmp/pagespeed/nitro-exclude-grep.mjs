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

async function walk(rel, depth) {
  if (depth < 0) return;
  let rows;
  try {
    rows = await sftp.list(rel);
  } catch {
    return;
  }
  for (const row of rows) {
    const path = rel + "/" + row.name;
    if (row.type === "d") {
      await walk(path, depth - 1);
      continue;
    }
    if (!row.name.endsWith(".php") && !row.name.endsWith(".js")) continue;
    const body = (await sftp.get(path)).toString("utf8");
    if (!body.includes("nitro-exclude") && !body.includes("nitroExclude") && !body.includes("excludedResources")) {
      continue;
    }
    const idx = body.indexOf("nitro-exclude");
    const idx2 = body.indexOf("excludedResources");
    const at = idx >= 0 ? idx : idx2;
    console.log(path, body.slice(Math.max(0, at - 60), at + 100).replace(/\s+/g, " "));
  }
}

await walk("./wp-content/plugins/nitropack", 3);
await sftp.end();
