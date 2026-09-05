/**
 * Deploy Neo Digital Elementor TOC CSS fix via WP Engine SFTP.
 * Does not print passwords.
 */
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
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

const localCss = join(import.meta.dirname, "neodigital-toc-pull", "wp-content__themes__ygency__style.css");
const remoteCss = "./wp-content/themes/ygency/style.css";
const remoteFlush = "./wp-content/plugins/flowbie-wp/nd-toc-flush-once.php";
const token = randomBytes(16).toString("hex");
const flushPhp = `<?php
if ( ( $_GET['key'] ?? '' ) !== '${token}' ) { http_response_code(403); exit('forbidden'); }
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); exit('wp-load missing'); }
require_once $wp_load;
header('Content-Type: text/plain; charset=utf-8');
if ( function_exists( 'wp_cache_flush' ) ) { wp_cache_flush(); }
if ( class_exists( 'WpeCommon' ) ) {
  if ( method_exists( 'WpeCommon', 'purge_memcached' ) ) { WpeCommon::purge_memcached(); }
  if ( method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) { WpeCommon::purge_varnish_cache(); }
}
echo "flushed\\n";
echo "style_ver=" . wp_get_theme()->get( 'Version' ) . "\\n";
@unlink( __FILE__ );
`;

const localFlush = join(import.meta.dirname, "neodigital-toc-pull", "nd-toc-flush-once.php");
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

await sftp.put(localCss, remoteCss);
const back = await sftp.get(remoteCss);
const text = back.toString("utf8");
const hasFix =
  text.includes("elementor-widget-table-of-contents .elementor-toc__list-item-text-wrapper") &&
  text.includes("min-width: 0") &&
  text.includes("align-items: flex-start");
const hasVer = text.includes("Version: 1.2.1.2");
console.log("css_bytes", back.length, "has_fix", hasFix, "has_ver", hasVer);
if (!hasFix || !hasVer) {
  await sftp.end();
  process.exit(1);
}

await sftp.put(localFlush, remoteFlush);
await sftp.end();
console.log("FLUSH_URL", `https://neodigital.ca/wp-content/plugins/flowbie-wp/nd-toc-flush-once.php?key=${token}`);
console.log("done");
