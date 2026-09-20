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

const files = await sftp.list("./wp-content/cache/neo-pulse-speed/css");
const cssFiles = files.filter((f) => f.type === "-" && f.name.endsWith(".css"));
console.log("cache css", cssFiles.length);
let rel = 0;
let absOk = 0;
let cacheAbs = 0;
for (const f of cssFiles) {
  const body = (await sftp.get("./wp-content/cache/neo-pulse-speed/css/" + f.name)).toString("utf8");
  if (!body.includes("url(")) continue;
  const hasRelFont =
    body.includes("url(fontawesome") ||
    body.includes("url(../webfonts") ||
    body.includes("url(webfonts") ||
    body.includes("url(flaticon") ||
    body.includes("url('../webfonts") ||
    body.includes('url("../webfonts');
  const hasCacheAbs = body.includes("/cache/neo-pulse-speed/") && body.includes("woff");
  const hasThemeAbs =
    body.includes("url(https://neodigital.ca/wp-content/plugins/") ||
    body.includes("url(https://neodigital.ca/wp-content/themes/");
  if (hasRelFont) {
    rel += 1;
    const idx = body.indexOf("url(fontawesome") >= 0 ? body.indexOf("url(fontawesome") : body.indexOf("url(");
    console.log("REL", f.name, body.slice(idx, idx + 120));
  }
  if (hasCacheAbs) {
    cacheAbs += 1;
    const idx = body.indexOf("/cache/neo-pulse-speed/");
    console.log("CACHEABS", f.name, body.slice(Math.max(0, idx - 10), idx + 90));
  }
  if (hasThemeAbs) absOk += 1;
}
console.log("summary rel", rel, "cacheAbs", cacheAbs, "themeAbs", absOk);
await sftp.end();
