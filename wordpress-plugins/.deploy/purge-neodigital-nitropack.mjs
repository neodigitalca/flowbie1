/**
 * One-shot NitroPack + guest HTML check for neodigital.ca.
 */
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
echo 'plugin=' . ( defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : 'missing' ) . "\\n";
$fns = array(
  'nitropack_sdk_purge_cache',
  'nitropack_purge_cache',
  'nitropack_invalidate_cache',
  'nitropack_sdk_invalidate_cache',
);
foreach ( $fns as $fn ) {
  echo 'fn_' . $fn . '=' . ( function_exists( $fn ) ? 'yes' : 'no' ) . "\\n";
  if ( function_exists( $fn ) ) { $fn(); }
}
if ( function_exists( 'do_action' ) ) {
  do_action( 'nitropack_integration_purge_all' );
  do_action( 'nitropack_cache_invalidate' );
}
if ( class_exists( '\\NitroPack\\WordPress\\NitroPack' ) ) {
  echo "class_nitropack=yes\\n";
}
$classes = get_declared_classes();
foreach ( $classes as $c ) {
  if ( stripos( $c, 'nitro' ) !== false ) {
    echo 'class=' . $c . "\\n";
  }
}
@unlink( __FILE__ );
`;

const tmpDir = join(import.meta.dirname, "neodigital-flush");
mkdirSync(tmpDir, { recursive: true });
const localFlush = join(tmpDir, "nd-nitropack-flush-once.php");
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
await sftp.put(localFlush, "./wp-content/plugins/neo-pulse-wp/nd-nitropack-flush-once.php");
await sftp.end();

const flushUrl = `https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-nitropack-flush-once.php?key=${token}`;
const res = await fetch(flushUrl, { cache: "no-store" });
const body = await res.text();
console.log("status", res.status);
console.log(body.trim());
if (!res.ok) process.exit(1);
