/**
 * Deploy Pulse title/keyword sync + one-shot post_title repair on neodigital.ca.
 * Does not print passwords.
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

const repoRoot = join(import.meta.dirname, "..", "..");
const outDir = join(import.meta.dirname, "neodigital-title-sync");
mkdirSync(outDir, { recursive: true });

const token = randomBytes(16).toString("hex");
const repairPhp = `<?php
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

function nd_keyword_tokens( $phrase ) {
  $stop = array( 'a' => true, 'an' => true, 'and' => true, 'for' => true, 'how' => true, 'in' => true, 'is' => true, 'of' => true, 'on' => true, 'or' => true, 'the' => true, 'to' => true, 'what' => true, 'why' => true );
  $parts = preg_split( '/\\s+/', strtolower( (string) $phrase ) );
  if ( ! is_array( $parts ) ) {
    return array();
  }
  $out = array();
  foreach ( $parts as $w ) {
    $w = preg_replace( '/[^a-z0-9]+/', '', $w );
    if ( ! is_string( $w ) || strlen( $w ) < 2 || isset( $stop[ $w ] ) ) {
      continue;
    }
    $out[] = $w;
  }
  return $out;
}
function nd_title_covers( $title, $keyword ) {
  $tokens = nd_keyword_tokens( $keyword );
  if ( $tokens === array() ) {
    return true;
  }
  $hay = strtolower( (string) $title );
  foreach ( $tokens as $w ) {
    if ( strpos( $hay, $w ) === false ) {
      return false;
    }
  }
  return true;
}

$q = new WP_Query(
  array(
    'post_type'      => 'post',
    'post_status'    => array( 'publish', 'draft', 'future', 'pending', 'private' ),
    'posts_per_page' => -1,
    'fields'         => 'ids',
    'no_found_rows'  => true,
  )
);

$fixed   = 0;
$skipped = 0;
$lines   = array();
foreach ( $q->posts as $post_id ) {
  $post_id = (int) $post_id;
  $research = '';
  if ( function_exists( 'get_field' ) ) {
    $acf = get_field( 'seo_research', $post_id, false );
    if ( is_string( $acf ) && trim( $acf ) !== '' ) {
      $research = trim( $acf );
    }
  }
  if ( $research === '' ) {
    $meta = get_post_meta( $post_id, 'seo_research', true );
    if ( is_string( $meta ) ) {
      $research = trim( $meta );
    }
  }
  $decoded = json_decode( $research, true );
  if ( ! is_array( $decoded ) ) {
    ++$skipped;
    continue;
  }
  $research_title = trim( (string) ( $decoded['title'] ?? '' ) );
  $primary        = trim( (string) ( $decoded['primary_keyword'] ?? '' ) );
  if ( $research_title === '' || $primary === '' ) {
    ++$skipped;
    continue;
  }
  $focus = '';
  if ( function_exists( 'get_field' ) ) {
    $fk = get_field( 'keyword_focus', $post_id, false );
    if ( is_string( $fk ) ) {
      $focus = trim( $fk );
    }
  }
  if ( $focus === '' ) {
    $fk = get_post_meta( $post_id, 'keyword_focus', true );
    if ( is_string( $fk ) ) {
      $focus = trim( $fk );
    }
  }
  $check = $focus !== '' ? $focus : $primary;
  if ( ! nd_title_covers( $research_title, $check ) && ! nd_title_covers( $research_title, $primary ) ) {
    ++$skipped;
    continue;
  }
  $post = get_post( $post_id );
  if ( ! $post instanceof WP_Post ) {
    ++$skipped;
    continue;
  }
  if ( nd_title_covers( (string) $post->post_title, $check ) ) {
    ++$skipped;
    continue;
  }
  $old = (string) $post->post_title;
  wp_update_post(
    array(
      'ID'         => $post_id,
      'post_title' => $research_title,
    )
  );
  update_post_meta( $post_id, 'rank_math_title', $research_title );
  ++$fixed;
  $lines[] = $post_id . '\\t' . $post->post_name . '\\t' . $old . '\\t=>\\t' . $research_title;
}

echo "fixed={$fixed}\\n";
echo "skipped={$skipped}\\n";
echo implode( "\\n", $lines ) . "\\n";
if ( function_exists( 'wp_cache_flush' ) ) { wp_cache_flush(); }
if ( class_exists( 'WpeCommon' ) ) {
  if ( method_exists( 'WpeCommon', 'purge_memcached' ) ) { WpeCommon::purge_memcached(); }
  if ( method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) { WpeCommon::purge_varnish_cache(); }
}
echo "flushed\\n";
@unlink( __FILE__ );
`;

writeFileSync(join(outDir, "nd-title-sync-once.php"), repairPhp, "utf8");

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

const plugins = await sftp.list("./wp-content/plugins");
const names = plugins.map((p) => p.name);
console.log("plugins", names.join(","));

const puts = [];
if (names.includes("neo-pulse-app")) {
  puts.push(
    [
      join(repoRoot, "wordpress-plugins/neo-pulse-app/includes/wordpress/class-wp-overview-seo-item.php"),
      "./wp-content/plugins/neo-pulse-app/includes/wordpress/class-wp-overview-seo-item.php",
    ],
    [
      join(repoRoot, "wordpress-plugins/neo-pulse-app/includes/wordpress/class-wp-meta.php"),
      "./wp-content/plugins/neo-pulse-app/includes/wordpress/class-wp-meta.php",
    ],
    [
      join(repoRoot, "wordpress-plugins/neo-pulse-app/includes/class-neo-pulse-app-loader.php"),
      "./wp-content/plugins/neo-pulse-app/includes/class-neo-pulse-app-loader.php",
    ],
    [
      join(repoRoot, "wordpress-plugins/neo-pulse-app/neo-pulse-app.php"),
      "./wp-content/plugins/neo-pulse-app/neo-pulse-app.php",
    ],
  );
}
if (names.includes("neo-pulse-wp")) {
  puts.push(
    [
      join(repoRoot, "wordpress-plugins/neo-pulse-wp/includes/class-neo-pulse-wp-ai-apply.php"),
      "./wp-content/plugins/neo-pulse-wp/includes/class-neo-pulse-wp-ai-apply.php",
    ],
    [
      join(repoRoot, "wordpress-plugins/neo-pulse-wp/includes/class-neo-pulse-wp-overview-seo-bulk.php"),
      "./wp-content/plugins/neo-pulse-wp/includes/class-neo-pulse-wp-overview-seo-bulk.php",
    ],
    [
      join(repoRoot, "wordpress-plugins/neo-pulse-wp/neo-pulse-wp.php"),
      "./wp-content/plugins/neo-pulse-wp/neo-pulse-wp.php",
    ],
  );
}

for (const [local, remote] of puts) {
  await sftp.put(local, remote);
  console.log("put", remote);
}

const repairRemote = names.includes("flowbie-wp")
  ? "./wp-content/plugins/flowbie-wp/nd-title-sync-once.php"
  : names.includes("neo-pulse-app")
    ? "./wp-content/plugins/neo-pulse-app/nd-title-sync-once.php"
    : "./wp-content/plugins/nd-title-sync-once.php";
await sftp.put(join(outDir, "nd-title-sync-once.php"), repairRemote);
await sftp.end();

const webPath = repairRemote.replace(/^\.\//, "");
console.log("REPAIR_URL", `https://neodigital.ca/${webPath}?key=${token}`);
console.log("done");
