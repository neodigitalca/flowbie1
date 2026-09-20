import { readFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";
import {
  launchBrowserWithResidentialProxy,
  isProxyConfigured,
  resolveResidentialProxyEnv,
} from "../../scripts/research/residential-proxy/lib.mjs";

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
const minify = (await sftp.get("./wp-content/plugins/neo-pulse-wp/includes/class-neo-pulse-wp-speed-minify.php")).toString("utf8");
console.log("remote rewrite", minify.includes("rewrite_relative_urls"));
const files = await sftp.list("./wp-content/cache/neo-pulse-speed/css");
const cssFiles = files.filter((f) => f.type === "-" && f.name.endsWith(".css")).slice(0, 8);
console.log("cache css count", files.filter((f) => f.type === "-" && f.name.endsWith(".css")).length);
for (const f of cssFiles) {
  const body = (await sftp.get("./wp-content/cache/neo-pulse-speed/css/" + f.name)).toString("utf8");
  const hasRel = body.includes("url(../") || body.includes("url(fontawesome") || body.includes("url(webfonts") || body.includes("url(flaticon");
  const hasAbs = body.includes("url(https://neodigital.ca/wp-content");
  if (hasRel || hasAbs || body.includes("@font-face")) {
    console.log(f.name, "rel=" + hasRel, "abs=" + hasAbs, "len=" + body.length);
    const idx = body.indexOf("url(");
    console.log("  sample", body.slice(Math.max(0, idx), idx + 140));
  }
}
await sftp.end();

if (isProxyConfigured()) {
  const { browser, page } = await launchBrowserWithResidentialProxy({
    headed: false,
    env: resolveResidentialProxyEnv(),
  });
  try {
    await page.goto("https://neodigital.ca/elementor-help/", { waitUntil: "domcontentloaded", timeout: 90_000 });
    const hrefs = await page.$$eval('link[rel="stylesheet"]', (els) =>
      els.map((el) => el.href).filter((h) => h.includes("neo-pulse-speed") || h.includes("font-awesome") || h.includes("flaticon"))
    );
    console.log("page css", hrefs.slice(0, 12));
  } finally {
    await browser.close();
  }
}
