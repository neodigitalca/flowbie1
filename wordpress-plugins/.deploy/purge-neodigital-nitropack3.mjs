import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"));
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
const token = randomBytes(16).toString("hex");
const flushPhp = `<?php
if ( ( $_GET['key'] ?? '' ) !== '${token}' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
require_once $wp_load;
$cls = 'NitroPack\\\\WordPress\\\\Settings\\\\PurgeCache';
if ( class_exists( $cls ) && method_exists( $cls, 'nitropack_purge_entire_cache' ) ) {
  $cls::nitropack_purge_entire_cache();
  echo "entire=yes\\n";
}
if ( class_exists( $cls ) && method_exists( $cls, 'nitropack_invalidate_entire_cache' ) ) {
  $cls::nitropack_invalidate_entire_cache();
  echo "invalidate=yes\\n";
}
if ( class_exists( 'WpeCommon' ) && method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) {
  WpeCommon::purge_varnish_cache();
  echo "varnish=yes\\n";
}
echo "plugin=" . ( defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : 'missing' ) . "\\n";
@unlink( __FILE__ );
`;
const tmpDir = join(import.meta.dirname, "neodigital-flush");
mkdirSync(tmpDir, { recursive: true });
const localFlush = join(tmpDir, "nd-nitropack-flush3.php");
writeFileSync(localFlush, flushPhp, "utf8");
const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: {
    serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
    kex: ["curve25519-sha256", "ecdh-sha2-nistp256", "diffie-hellman-group14-sha256", "diffie-hellman-group-exchange-sha256", "diffie-hellman-group14-sha1"],
  },
});
await sftp.put(localFlush, "./wp-content/plugins/neo-pulse-wp/nd-nitropack-flush3.php");
await sftp.end();
const res = await fetch(`https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-nitropack-flush3.php?key=${token}`, { cache: "no-store" });
console.log((await res.text()).trim());
