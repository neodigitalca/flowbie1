import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const flowbie = catalog.rows.find((r) => r.site === "flowbie.ca" && !r.isStaging);
const token = randomBytes(16).toString("hex");
const generated = join(import.meta.dirname, "phoenix-flush-cache-once.generated.php");
writeFileSync(
  generated,
  readFileSync(join(import.meta.dirname, "phoenix-flush-cache-once.php"), "utf8").replace(
    "PHOENIX_FLUSH_TOKEN",
    token,
  ),
);
const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
  ],
};
const name = `phoenix-flush-${token.slice(0, 12)}.php`;
const sftp = new SftpClient();
await sftp.connect({
  host: flowbie.host,
  port: flowbie.port,
  username: flowbie.username,
  password: flowbie.password,
  readyTimeout: 20000,
  algorithms: ALGOS,
});
await sftp.put(generated, `./wp-content/plugins/${name}`);
await sftp.end();
const res = await fetch(`https://flowbie.ca/wp-content/plugins/${name}?key=${token}`);
const text = await res.text();
console.log("flush", res.status, text);
const home = await fetch(`https://flowbie.ca/?t=${Date.now()}`, { redirect: "follow" });
const html = await home.text();
console.log(
  JSON.stringify({
    status: home.status,
    url: home.url,
    title: (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "",
    phoenixName: /Phoenix Painting/i.test(html),
    phoenixHost: html.includes("phoenixpainting"),
  }),
);
