import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
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
const token = randomBytes(16).toString("hex");
const php = `<?php
if ( ( $_GET['key'] ?? '' ) !== '${token}' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
if ( function_exists( 'opcache_reset' ) ) {
  echo function_exists( 'opcache_reset' ) && opcache_reset() ? "opcache_reset=1\\n" : "opcache_reset=0\\n";
} else {
  echo "no_opcache\\n";
}
if ( function_exists( 'opcache_invalidate' ) ) {
  @opcache_invalidate( '/nas/content/live/neodigital/wp-content/plugins/neo-pulse-app/includes/class-neo-pulse-app-loader.php', true );
  @opcache_invalidate( '/nas/content/live/neodigital/wp-content/plugins/neo-pulse-app/neo-pulse-app.php', true );
  echo "invalidated\\n";
}
echo "ok\\n";
@unlink( __FILE__ );
`;
const local = join(import.meta.dirname, "neodigital-title-sync", "nd-opcache-once.php");
writeFileSync(local, php);
const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});
await sftp.put(local, "./wp-content/plugins/flowbie-wp/nd-opcache-once.php");
await sftp.end();
console.log("OPC_URL", `https://neodigital.ca/wp-content/plugins/flowbie-wp/nd-opcache-once.php?key=${token}`);
