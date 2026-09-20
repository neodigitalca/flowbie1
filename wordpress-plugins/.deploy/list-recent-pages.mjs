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
$pages = get_posts( array(
  'post_type'      => 'page',
  'post_status'    => array( 'publish', 'draft', 'private' ),
  'posts_per_page' => 8,
  'orderby'        => 'date',
  'order'          => 'DESC',
) );
$out = array();
foreach ( $pages as $page ) {
  $out[] = array(
    'id'     => (int) $page->ID,
    'title'  => $page->post_title,
    'status' => $page->post_status,
    'slug'   => $page->post_name,
    'url'    => get_permalink( $page ),
    'date'   => $page->post_date,
  );
}
echo wp_json_encode( array( 'ok' => true, 'pages' => $out ) );
@unlink( __FILE__ );
`;

const tmpDir = join(import.meta.dirname, "neodigital-flush");
mkdirSync(tmpDir, { recursive: true });
const localPhp = join(tmpDir, "nd-list-pages-once.php");
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
await sftp.put(localPhp, "./wp-content/plugins/neo-pulse-wp/nd-list-pages-once.php");
await sftp.end();

const url = `https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-list-pages-once.php?key=${token}`;
const res = await fetch(url, { cache: "no-store" });
console.log(await res.text());
