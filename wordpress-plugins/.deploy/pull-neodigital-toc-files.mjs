import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
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

const files = [
  "./wp-content/themes/ygency/assets/css/theme.min.css",
  "./wp-content/themes/ygency/assets/css/theme.css",
  "./wp-content/themes/ygency/style.css",
  "./wp-content/uploads/elementor/css/post-7745.css",
  "./wp-content/uploads/elementor/css/post-5564.css",
  "./wp-content/uploads/elementor/css/custom-frontend.min.css",
  "./wp-content/plugins/elementor-pro/assets/css/widget-table-of-contents.min.css",
  "./wp-content/plugins/elementor-pro/assets/css/widget-table-of-contents.css",
];

const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});
mkdirSync(DEST, { recursive: true });
for (const remote of files) {
  try {
    const buf = await sftp.get(remote);
    const dest = join(DEST, remote.replace(/^\.\//, "").replace(/\//g, "__"));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
    console.log("got", remote, buf.length);
  } catch (err) {
    console.log("skip", remote, err.message);
  }
}
await sftp.end();
console.log("done");
