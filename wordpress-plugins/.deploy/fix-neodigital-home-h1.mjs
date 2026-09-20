import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
if (!site) process.exit(1);

const token = randomBytes(16).toString("hex");
const php = `<?php
if ( ( $_GET['key'] ?? '' ) !== '${token}' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;
$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( empty( $admins ) ) { echo '{"error":"no administrator"}'; @unlink( __FILE__ ); exit; }
wp_set_current_user( (int) $admins[0]->ID );

function nd_fix_home_h1( &$elements, &$changed ) {
  foreach ( $elements as &$el ) {
    if ( ! is_array( $el ) ) {
      continue;
    }
    if ( isset( $el['id'] ) && $el['id'] === 'a71df32' && isset( $el['settings']['title'] ) ) {
      $before = (string) $el['settings']['title'];
      $after  = preg_replace( '/^\\s*Window Coverings\\b/i', 'Edmonton', $before, 1 );
      if ( is_string( $after ) && $after !== $before ) {
        $el['settings']['title'] = $after;
        $changed = $before;
      }
    }
    if ( ! empty( $el['elements'] ) ) {
      nd_fix_home_h1( $el['elements'], $changed );
    }
  }
  unset( $el );
}

$raw = get_post_meta( 55, '_elementor_data', true );
$data = json_decode( is_string( $raw ) ? $raw : '', true );
if ( ! is_array( $data ) ) {
  echo wp_json_encode( array( 'error' => 'no elementor data' ) );
  @unlink( __FILE__ );
  exit;
}
$changed = '';
nd_fix_home_h1( $data, $changed );
if ( $changed === '' ) {
  echo wp_json_encode( array( 'ok' => true, 'changed' => false, 'title' => 'already edmonton' ) );
  @unlink( __FILE__ );
  exit;
}
if ( class_exists( 'Elementor\\\\Plugin' ) ) {
  $document = \\Elementor\\Plugin::$instance->documents->get( 55 );
  if ( $document ) {
    $document->save( array( 'elements' => $data ) );
  } else {
    update_post_meta( 55, '_elementor_data', wp_slash( wp_json_encode( $data ) ) );
  }
  \\Elementor\\Plugin::$instance->files_manager->clear_cache();
} else {
  update_post_meta( 55, '_elementor_data', wp_slash( wp_json_encode( $data ) ) );
}
echo wp_json_encode( array( 'ok' => true, 'changed' => true, 'from' => $changed ) );
@unlink( __FILE__ );
`;

const tmpDir = join(import.meta.dirname, "neodigital-flush");
mkdirSync(tmpDir, { recursive: true });
const localPhp = join(tmpDir, "nd-fix-home-h1-once.php");
writeFileSync(localPhp, php, "utf8");
const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: ["curve25519-sha256", "ecdh-sha2-nistp256", "diffie-hellman-group14-sha256", "diffie-hellman-group-exchange-sha256", "diffie-hellman-group14-sha1"],
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
await sftp.put(localPhp, "./wp-content/plugins/neo-pulse-wp/nd-fix-home-h1-once.php");
await sftp.end();
const res = await fetch(`https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-fix-home-h1-once.php?key=${token}`, { cache: "no-store" });
console.log(await res.text());
