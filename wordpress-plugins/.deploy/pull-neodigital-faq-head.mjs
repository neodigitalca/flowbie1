import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
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
const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});
const themes = await sftp.list("./wp-content/themes");
console.log("themes", themes.map((t) => t.name).join(","));
const out = join(import.meta.dirname, "neodigital-faq-head");
mkdirSync(out, { recursive: true });
const candidates = [
  "./wp-content/themes/ygency/functions.php",
  "./wp-content/themes/ygency-child/functions.php",
  "./wp-content/plugins/ygency-toolkit/ygency-toolkit.php",
  "./wp-content/plugins/flowbie-wp/flowbie-wp.php",
];
for (const p of candidates) {
  const exists = await sftp.exists(p);
  console.log(p, exists ? "yes" : "no");
  if (!exists) continue;
  const buf = await sftp.get(p);
  const name = p.replace(/[^a-z0-9]+/gi, "_");
  writeFileSync(join(out, name), buf);
  const t = buf.toString("utf8");
  console.log(
    " bytes",
    buf.length,
    "inject",
    t.includes("inject_custom_acf"),
    "faq_echo",
    t.includes("faq_snippet") || t.includes("echo $faq"),
    "render_faq",
    t.includes("render_faq_schema"),
    "wp_head",
    t.includes("wp_head"),
  );
}
await sftp.end();
