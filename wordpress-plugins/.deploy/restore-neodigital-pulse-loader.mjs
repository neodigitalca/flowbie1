import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import AdmZip from "adm-zip";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
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
const outDir = join(import.meta.dirname, "neodigital-title-sync", "restore");
mkdirSync(outDir, { recursive: true });
const zipPath = join(outDir, "neo-pulse-app.zip");

const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 60000,
  algorithms: ALGOS,
});
await sftp.fastGet("./wp-content/plugins/neo-pulse-app.zip", zipPath);
const zip = new AdmZip(zipPath);
const entries = zip.getEntries().map((e) => e.entryName);
const mainEntry = entries.find((n) => n.replace(/\\/g, "/").endsWith("neo-pulse-app.php"));
const loaderEntry = entries.find((n) => n.replace(/\\/g, "/").endsWith("class-neo-pulse-app-loader.php"));
if (!mainEntry || !loaderEntry) {
  console.error("zip missing main/loader", entries.slice(0, 30).join(","));
  await sftp.end();
  process.exit(1);
}
const mainBuf = zip.readFile(mainEntry);
const loaderBuf = zip.readFile(loaderEntry);
if (!mainBuf || !loaderBuf) {
  console.error("empty zip members");
  await sftp.end();
  process.exit(1);
}
const mainLocal = join(outDir, "neo-pulse-app.php");
const loaderLocal = join(outDir, "class-neo-pulse-app-loader.php");
writeFileSync(mainLocal, mainBuf);
writeFileSync(loaderLocal, loaderBuf);
console.log("zip_main_bytes", mainBuf.length, "zip_loader_bytes", loaderBuf.length);
console.log("loader_has_agentmail", loaderBuf.toString("utf8").includes("agentmail"));

await sftp.put(mainLocal, "./wp-content/plugins/neo-pulse-app/neo-pulse-app.php");
await sftp.put(loaderLocal, "./wp-content/plugins/neo-pulse-app/includes/class-neo-pulse-app-loader.php");
await sftp.end();
console.log("restored");
