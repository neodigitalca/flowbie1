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

const files = [
  "./wp-content/themes/ygency/assets/js/main.js",
  "./wp-content/themes/ygency/assets/js/theme.js",
  "./wp-content/themes/ygency/assets/js/scripts.js",
  "./wp-content/themes/ygency/js/main.js",
  "./wp-content/themes/ygency/assets/js/ygency.js",
];

const dirs = [
  "./wp-content/themes/ygency/assets/js",
  "./wp-content/themes/ygency/js",
];

for (const d of dirs) {
  try {
    const rows = await sftp.list(d);
    console.log("DIR", d, rows.map((r) => r.name).join(" "));
    for (const row of rows) {
      if (row.type !== "-" || !row.name.endsWith(".js")) continue;
      const body = (await sftp.get(d + "/" + row.name)).toString("utf8");
      if (body.includes("waypoint") || body.includes("Swiper") || body.includes("elementorFrontend")) {
        const idx = Math.max(body.indexOf("waypoint"), body.indexOf("elementorFrontend"));
        console.log("HIT", d + "/" + row.name, "len=" + body.length, body.slice(Math.max(0, idx - 40), idx + 90).replace(/\s+/g, " "));
      }
    }
  } catch (err) {
    console.log("DIR miss", d, err.message.slice(0, 60));
  }
}

for (const f of files) {
  try {
    const body = (await sftp.get(f)).toString("utf8");
    console.log("FILE", f, body.length, body.includes("waypoint"));
  } catch {
    console.log("FILE miss", f);
  }
}

await sftp.end();
