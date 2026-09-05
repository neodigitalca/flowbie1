/**
 * Deploy Ygency FAQ JSON-LD wrap (stop raw FAQ echo in wp_head) on neodigital.ca.
 * Does not print passwords.
 */
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, copyFileSync } from "fs";
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

const localPhp = join(import.meta.dirname, "neodigital-faq-head", "_wp_content_themes_ygency_functions_php");
const remotePhp = "./wp-content/themes/ygency/functions.php";
const token = randomBytes(16).toString("hex");
writeFileSync(join(import.meta.dirname, "neodigital-faq-head", "flush-token.txt"), token, "utf8");

const flushPhp = `<?php
if ( ( $_GET['key'] ?? '' ) !== '${token}' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
define( 'SHORTINIT', true );
define( 'WP_USE_THEMES', false );
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); exit('wp-load missing'); }
require_once $wp_load;
$purged = 'no';
$wpe = ( defined( 'WP_CONTENT_DIR' ) ? WP_CONTENT_DIR : dirname( $wp_load ) . '/wp-content' ) . '/mu-plugins/wpengine-common/plugin.php';
if ( is_readable( $wpe ) ) {
  require_once $wpe;
}
if ( class_exists( 'WpeCommon' ) ) {
  if ( method_exists( 'WpeCommon', 'purge_memcached' ) ) { WpeCommon::purge_memcached(); }
  if ( method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) { WpeCommon::purge_varnish_cache(); }
  $purged = 'yes';
}
echo "shortinit_ok\\n";
echo "purged=" . $purged . "\\n";
@unlink( __FILE__ );
`;

const localFlush = join(import.meta.dirname, "neodigital-faq-head", "nd-faq-flush-once.php");
writeFileSync(localFlush, flushPhp, "utf8");
const remoteFlush = "./wp-content/plugins/flowbie-wp/nd-faq-flush-once.php";

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

await sftp.put(localPhp, remotePhp);
const back = await sftp.get(remotePhp);
const text = back.toString("utf8");
const hasWrap = text.includes("ygency_render_faq_schema") && text.includes("Never return raw text");
const hasRawEcho = /echo\s+"\\n"\s*\.\s*\$faq_snippet/.test(text);
const hasTypo = text.includes(" mar");
console.log("php_bytes", back.length, "has_wrap", hasWrap, "has_raw_echo", hasRawEcho, "has_typo", hasTypo);
if (!hasWrap || hasRawEcho || hasTypo) {
  await sftp.end();
  process.exit(1);
}

await sftp.put(localFlush, remoteFlush);
console.log("flush_uploaded");
console.log("FLUSH_KEY=" + token);
await sftp.end();
