import { randomBytes } from "crypto";
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
const token = randomBytes(16).toString("hex");
const php = `<?php
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
if ( function_exists( 'nitropack_sdk_purge_cache' ) ) { nitropack_sdk_purge_cache(); echo "fn_sdk_purge=yes\\n"; }
if ( function_exists( 'nitropack_sdk_invalidate_cache' ) ) { nitropack_sdk_invalidate_cache(); echo "fn_sdk_invalidate=yes\\n"; }
$cache = WP_CONTENT_DIR . '/cache';
$wiped = 0;
if ( is_dir( $cache ) ) {
  $items = scandir( $cache );
  foreach ( $items as $name ) {
    if ( $name === '.' || $name === '..' ) { continue; }
    if ( stripos( $name, 'nitropack' ) === false ) { continue; }
    $path = $cache . '/' . $name;
    if ( ! is_dir( $path ) ) { continue; }
    $it = new RecursiveIteratorIterator(
      new RecursiveDirectoryIterator( $path, FilesystemIterator::SKIP_DOTS ),
      RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ( $it as $file ) {
      $file->isDir() ? @rmdir( $file->getPathname() ) : @unlink( $file->getPathname() );
    }
    @rmdir( $path );
    $wiped++;
  }
}
echo "nitro_dirs_wiped={$wiped}\\n";
if ( class_exists( 'WpeCommon' ) ) {
  if ( method_exists( 'WpeCommon', 'purge_memcached' ) ) { WpeCommon::purge_memcached(); }
  if ( method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) { WpeCommon::purge_varnish_cache(); }
}
echo "purged=yes\\n";
echo "plugin=" . ( defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : 'missing' ) . "\\n";
@unlink( __FILE__ );
`;

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
await sftp.put(Buffer.from(php, "utf8"), "./wp-content/plugins/neo-pulse-wp/nd-varnish-flush-once.php");
await sftp.end();

if (!isProxyConfigured()) {
  console.log("no proxy");
  process.exit(1);
}
const url = `https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-varnish-flush-once.php?key=${token}`;
const { browser, page } = await launchBrowserWithResidentialProxy({
  headed: false,
  env: resolveResidentialProxyEnv(),
});
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const text = await page.evaluate(() => (document.body ? document.body.innerText : ""));
  console.log(text.slice(0, 600));
} finally {
  await browser.close();
}
