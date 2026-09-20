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
$post_id = 9880;
$post = get_post( $post_id );
if ( ! $post ) {
  echo wp_json_encode( array( 'error' => 'page 9880 missing' ) );
  @unlink( __FILE__ );
  exit;
}
$slug = sanitize_title( $post->post_title );
wp_update_post( array( 'ID' => $post_id, 'post_name' => $slug, 'post_status' => 'publish' ), true );
clean_post_cache( $post_id );
$fresh = get_post( $post_id );
echo wp_json_encode( array(
  'ok' => true,
  'post_id' => $post_id,
  'slug' => $fresh ? $fresh->post_name : $slug,
  'status' => $fresh ? $fresh->post_status : '',
  'view_url' => get_permalink( $post_id ),
) );
@unlink( __FILE__ );
`;

const tmpDir = join(import.meta.dirname, "neodigital-flush");
mkdirSync(tmpDir, { recursive: true });
const localPhp = join(tmpDir, "nd-fix-9880-slug-once.php");
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
await sftp.put(localPhp, "./wp-content/plugins/neo-pulse-wp/nd-fix-9880-slug-once.php");
await sftp.end();

const url = `https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-fix-9880-slug-once.php?key=${token}`;
const res = await fetch(url, { cache: "no-store" });
const body = await res.text();
console.log("slug_status", res.status);
console.log(body.trim());
if (!res.ok || !body.includes('"ok":true')) {
  process.exit(1);
}
