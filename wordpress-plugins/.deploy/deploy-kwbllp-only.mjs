import { join } from "path";
import { execSync } from "child_process";
import SftpClient from "ssh2-sftp-client";
import { buildPluginZip } from "../deploy/lib/build-zip.js";
import { deployZip } from "../deploy/lib/deploy-zip.js";
import { loadProductionSites } from "../deploy/lib/csv-sites.js";

const dir = join(import.meta.dirname, "..");
const repoRoot = join(dir, "..");
const csvPath = join(dir, "Customer List", "SFTP Users_Clients List.csv");
const zipPath = join(dir, "neo-pulse-wp.zip");
const pluginDir = join(dir, "neo-pulse-wp");

const sites = loadProductionSites(csvPath);
const site = sites.find((s) => s.site === "kwbllp.com");
if (!site) {
  console.error("kwbllp.com not found in production CSV");
  process.exit(1);
}

console.log("Connecting", site.host, "as", site.username, "passLen", site.password.length);

const probe = new SftpClient();
try {
  await probe.connect({
    host: site.host,
    port: site.port,
    username: site.username,
    password: site.password,
    readyTimeout: 30000,
    algorithms: {
      serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
      kex: [
        "curve25519-sha256",
        "ecdh-sha2-nistp256",
        "diffie-hellman-group14-sha256",
        "diffie-hellman-group-exchange-sha256",
        "diffie-hellman-group14-sha1",
      ],
    },
  });
  const list = await probe.list("./wp-content/plugins");
  await probe.end();
  console.log(
    "plugins:",
    list
      .filter((e) => e.type === "d")
      .map((e) => e.name)
      .sort()
      .join(", "),
  );
} catch (e) {
  console.error("probe failed:", e.message);
  process.exit(1);
}

execSync("node scripts/embed-wp-secrets.mjs", { cwd: repoRoot, stdio: "inherit" });
console.log("Building neo-pulse-wp zip...");
buildPluginZip(pluginDir, zipPath, (done, total) => {
  process.stdout.write(`\r zip ${Math.round((done / total) * 100)}%`);
});
process.stdout.write("\n");

console.log("Deploying to", site.label, site.host);
const result = await deployZip(site, zipPath, pluginDir, (phase, done, total) => {
  process.stdout.write(`\r ${phase} ${Math.round((done / total) * 100)}%`);
});
process.stdout.write("\n");
if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}
console.log("kwbllp.com deployed");
