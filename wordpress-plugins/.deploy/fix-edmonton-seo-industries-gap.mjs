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
require_once $wp_load;
$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
wp_set_current_user( (int) $admins[0]->ID );

function &nd_find( &$elements, $id ) {
  foreach ( $elements as &$el ) {
    if ( ! is_array( $el ) ) {
      continue;
    }
    if ( isset( $el['id'] ) && $el['id'] === $id ) {
      return $el;
    }
    if ( ! empty( $el['elements'] ) ) {
      $hit =& nd_find( $el['elements'], $id );
      if ( $hit !== null ) {
        return $hit;
      }
    }
  }
  unset( $el );
  $none = null;
  return $none;
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$row =& nd_find( $data, '19ed9c0' );
$image =& nd_find( $data, '8f21b01' );
$text =& nd_find( $data, 'e475fb8' );
if ( ! $row || ! $image || ! $text ) {
  echo wp_json_encode( array( 'error' => 'industries row missing' ) );
  @unlink( __FILE__ );
  exit;
}

$row['settings']['flex_gap'] = array(
  'column' => '48',
  'row' => '32',
  'isLinked' => false,
  'unit' => 'px',
  'size' => 48,
);
$image['settings']['padding'] = array(
  'unit' => 'px',
  'top' => '0',
  'right' => '32',
  'bottom' => '0',
  'left' => '0',
  'isLinked' => false,
);
$text['settings']['padding'] = array(
  'unit' => 'px',
  'top' => '0',
  'right' => '0',
  'bottom' => '0',
  'left' => '32',
  'isLinked' => false,
);

$document = \\Elementor\\Plugin::$instance->documents->get( 10203 );
$document->save( array( 'elements' => $data ) );
\\Elementor\\Plugin::$instance->files_manager->clear_cache();

echo wp_json_encode( array( 'ok' => true ) );
@unlink( __FILE__ );
`;

const tmpDir = join(import.meta.dirname, "neodigital-flush");
mkdirSync(tmpDir, { recursive: true });
const localPhp = join(tmpDir, "nd-fix-industries-gap-once.php");
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
await sftp.put(localPhp, "./wp-content/plugins/neo-pulse-wp/nd-fix-industries-gap-once.php");
await sftp.end();
const res = await fetch(`https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-fix-industries-gap-once.php?key=${token}`, { cache: "no-store" });
console.log(await res.text());
