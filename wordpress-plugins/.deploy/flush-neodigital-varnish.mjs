import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
if (!site) {
  console.error("No neodigital.ca catalog row");
  process.exit(1);
}

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
if ( $wp_load === '' ) { http_response_code(500); exit('wp-load missing'); }
require_once $wp_load;
if ( function_exists( 'wp_cache_flush' ) ) { wp_cache_flush(); }
if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush' ) ) { Neo_Pulse_Wp_Cache_Flush::flush_all(); }
$np = 'NitroPack\\\\WordPress\\\\NitroPack';
if ( class_exists( $np ) && method_exists( $np, 'getInstance' ) ) {
  $inst = $np::getInstance();
  if ( is_object( $inst ) && method_exists( $inst, 'getSdk' ) ) {
    $sdk = $inst->getSdk();
    if ( is_object( $sdk ) && method_exists( $sdk, 'invalidateCache' ) ) { $sdk->invalidateCache(); echo "nitropack_invalidate=yes\\n"; }
    if ( is_object( $sdk ) && method_exists( $sdk, 'purgeCache' ) ) { $sdk->purgeCache(); echo "nitropack_purge=yes\\n"; }
  }
}
if ( class_exists( 'WpeCommon' ) ) {
  if ( method_exists( 'WpeCommon', 'purge_memcached' ) ) { WpeCommon::purge_memcached(); }
  if ( method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) { WpeCommon::purge_varnish_cache(); }
  echo "purged=yes\\n";
} else {
  echo "purged=no_wpe\\n";
}
echo "plugin=" . ( defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : 'missing' ) . "\\n";
@unlink( __FILE__ );
`;

const tmpDir = join(import.meta.dirname, "neodigital-flush");
mkdirSync(tmpDir, { recursive: true });
const localFlush = join(tmpDir, "nd-varnish-flush-once.php");
writeFileSync(localFlush, flushPhp, "utf8");

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
await sftp.put(localFlush, "./wp-content/plugins/neo-pulse-wp/nd-varnish-flush-once.php");
await sftp.end();

const flushUrl = `https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-varnish-flush-once.php?key=${token}`;
const res = await fetch(flushUrl, { cache: "no-store" });
const body = await res.text();
console.log("flush_status", res.status);
console.log(body.trim());
if (!res.ok || !body.includes("purged=yes")) {
  process.exit(1);
}
