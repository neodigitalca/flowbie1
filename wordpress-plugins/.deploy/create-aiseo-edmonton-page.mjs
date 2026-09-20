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
if ( empty( $admins ) ) {
  echo wp_json_encode( array( 'error' => 'no administrator' ) );
  @unlink( __FILE__ );
  exit;
}
wp_set_current_user( (int) $admins[0]->ID );
$post_id = wp_insert_post(
  array(
    'post_type'   => 'page',
    'post_title'  => 'aiseo edmonton',
    'post_name'   => 'aiseo-edmonton',
    'post_status' => 'publish',
    'post_author' => (int) $admins[0]->ID,
  ),
  true
);
if ( is_wp_error( $post_id ) ) {
  echo wp_json_encode( array( 'error' => $post_id->get_error_message() ) );
  @unlink( __FILE__ );
  exit;
}
update_post_meta( $post_id, '_elementor_edit_mode', 'builder' );
update_post_meta( $post_id, '_elementor_template_type', 'wp-page' );
echo wp_json_encode( array(
  'ok'       => true,
  'post_id'  => (int) $post_id,
  'title'    => get_the_title( $post_id ),
  'status'   => get_post_status( $post_id ),
  'view_url' => get_permalink( $post_id ),
  'edit_url' => get_edit_post_link( $post_id, 'raw' ),
) );
@unlink( __FILE__ );
`;

const tmpDir = join(import.meta.dirname, "neodigital-flush");
mkdirSync(tmpDir, { recursive: true });
const localPhp = join(tmpDir, "nd-create-aiseo-edmonton-once.php");
writeFileSync(localPhp, php, "utf8");

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
await sftp.put(localPhp, "./wp-content/plugins/neo-pulse-wp/nd-create-aiseo-edmonton-once.php");
await sftp.end();

const url = `https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-create-aiseo-edmonton-once.php?key=${token}`;
const res = await fetch(url, { cache: "no-store" });
const body = await res.text();
console.log("create_status", res.status);
console.log(body.trim());
if (!res.ok || !body.includes('"ok":true')) {
  process.exit(1);
}
