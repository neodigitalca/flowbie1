/**
 * Download the live search/chat plugin files from kwbllp.com for diagnosis.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";
import { loadProductionSites } from "../deploy/lib/csv-sites.js";

const dest = join(import.meta.dirname, "..", "..", ".cursor-kwb-patch", "kwb-live-pull");
const csvPath = join(import.meta.dirname, "..", "Customer List", "SFTP Users_Clients List.csv");
const kwb = loadProductionSites(csvPath).find((s) => s.site === "kwbllp.com");
if (!kwb) {
  console.error("kwbllp.com not in CSV");
  process.exit(1);
}

const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
    "diffie-hellman-group14-sha1",
  ],
};

const sftp = new SftpClient();
await sftp.connect({
  host: kwb.host,
  port: kwb.port,
  username: kwb.username,
  password: kwb.password,
  readyTimeout: 30000,
  algorithms: ALGOS,
});

mkdirSync(dest, { recursive: true });
const plugins = await sftp.list("./wp-content/plugins");
const names = plugins.filter((e) => e.type === "d").map((e) => e.name).sort();
writeFileSync(join(dest, "plugins.txt"), names.join("\n"));
console.log("plugins:", names.join(", "));

const candidates = names.filter((n) => /neo-pulse|flowbie/i.test(n));
const files = [
  "assets/search/neo-pulse-search.js",
  "assets/search/flowbie-search.js",
  "assets/shared/neo-pulse-ai-sidebar-unify.js",
  "assets/shared/flowbie-ai-sidebar-unify.js",
  "includes/class-neo-pulse-wp-search.php",
  "includes/class-flowbie-wp-search.php",
  "neo-pulse-wp.php",
  "flowbie-wp.php",
];

for (const plugin of candidates) {
  const pluginDest = join(dest, plugin);
  mkdirSync(pluginDest, { recursive: true });
  for (const rel of files) {
    const remote = `./wp-content/plugins/${plugin}/${rel}`;
    try {
      const exists = await sftp.exists(remote);
      if (!exists) continue;
      const buf = await sftp.get(remote);
      const local = join(pluginDest, rel.replaceAll("/", "__"));
      writeFileSync(local, buf);
      console.log("got", plugin, rel, buf.length);
    } catch (err) {
      console.log("skip", plugin, rel, err.message);
    }
  }
}

await sftp.end();
console.log("pull dest", dest);
