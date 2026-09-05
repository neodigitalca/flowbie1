import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
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
const outDir = join(import.meta.dirname, "neodigital-title-sync");
const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});

if (await sftp.exists("./wp-content/plugins/neo-pulse-app.off")) {
  if (await sftp.exists("./wp-content/plugins/neo-pulse-app")) {
    console.log("both folders exist; leaving names");
  } else {
    await sftp.rename("./wp-content/plugins/neo-pulse-app.off", "./wp-content/plugins/neo-pulse-app");
    console.log("renamed .off back");
  }
}

const repair = `<?php
if ( ( $_GET['key'] ?? '' ) !== '9b68cfbb0b261070d4e24a6c0a93d548' ) {
	http_response_code( 403 );
	exit( 'forbidden' );
}
define( 'SHORTINIT', true );
define( 'WP_USE_THEMES', false );
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
	if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
	$dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code( 500 ); exit( 'wp-load missing' ); }
require_once $wp_load;
header( 'Content-Type: text/plain; charset=utf-8' );

function flowbie_nd_kw_tokens_2026( $phrase ) {
	$stop = array( 'a'=>true,'an'=>true,'and'=>true,'for'=>true,'how'=>true,'in'=>true,'is'=>true,'of'=>true,'on'=>true,'or'=>true,'the'=>true,'to'=>true,'what'=>true,'why'=>true );
	$parts = preg_split( '/\\s+/', strtolower( (string) $phrase ) );
	if ( ! is_array( $parts ) ) return array();
	$out = array();
	foreach ( $parts as $w ) {
		$w = preg_replace( '/[^a-z0-9]+/', '', $w );
		if ( ! is_string( $w ) || strlen( $w ) < 2 || isset( $stop[ $w ] ) ) continue;
		$out[] = $w;
	}
	return $out;
}
function flowbie_nd_title_covers_2026( $title, $keyword ) {
	$tokens = flowbie_nd_kw_tokens_2026( $keyword );
	if ( $tokens === array() ) return true;
	$hay = strtolower( (string) $title );
	foreach ( $tokens as $w ) {
		if ( strpos( $hay, $w ) === false ) return false;
	}
	return true;
}

global $wpdb;
$ids = $wpdb->get_col( "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'post' AND post_status IN ('publish','draft','future','pending','private') ORDER BY ID ASC" );
$fixed = 0; $skipped = 0; $lines = array();
foreach ( $ids as $post_id ) {
	$post_id = (int) $post_id;
	$research = (string) $wpdb->get_var( $wpdb->prepare( "SELECT meta_value FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key = 'seo_research' ORDER BY meta_id DESC LIMIT 1", $post_id ) );
	$decoded = json_decode( $research, true );
	if ( ! is_array( $decoded ) ) { ++$skipped; continue; }
	$research_title = trim( (string) ( $decoded['title'] ?? '' ) );
	$primary = trim( (string) ( $decoded['primary_keyword'] ?? '' ) );
	if ( $research_title === '' || $primary === '' ) { ++$skipped; continue; }
	$focus = trim( (string) $wpdb->get_var( $wpdb->prepare( "SELECT meta_value FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key = 'keyword_focus' ORDER BY meta_id DESC LIMIT 1", $post_id ) ) );
	$check = $focus !== '' ? $focus : $primary;
	if ( ! flowbie_nd_title_covers_2026( $research_title, $check ) && ! flowbie_nd_title_covers_2026( $research_title, $primary ) ) { ++$skipped; continue; }
	$row = $wpdb->get_row( $wpdb->prepare( "SELECT post_title, post_name FROM {$wpdb->posts} WHERE ID = %d", $post_id ) );
	if ( ! $row ) { ++$skipped; continue; }
	if ( flowbie_nd_title_covers_2026( (string) $row->post_title, $check ) ) { ++$skipped; continue; }
	$old = (string) $row->post_title;
	$wpdb->update( $wpdb->posts, array( 'post_title' => $research_title ), array( 'ID' => $post_id ), array( '%s' ), array( '%d' ) );
	$exists = $wpdb->get_var( $wpdb->prepare( "SELECT meta_id FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key = 'rank_math_title' LIMIT 1", $post_id ) );
	if ( $exists ) {
		$wpdb->update( $wpdb->postmeta, array( 'meta_value' => $research_title ), array( 'post_id' => $post_id, 'meta_key' => 'rank_math_title' ), array( '%s' ), array( '%d', '%s' ) );
	} else {
		$wpdb->insert( $wpdb->postmeta, array( 'post_id' => $post_id, 'meta_key' => 'rank_math_title', 'meta_value' => $research_title ), array( '%d', '%s', '%s' ) );
	}
	++$fixed;
	$lines[] = $post_id . "\\t" . $row->post_name . "\\t" . $old . "\\t=>\\t" . $research_title;
}
echo 'fixed=' . $fixed . "\\n";
echo 'skipped=' . $skipped . "\\n";
echo implode( "\\n", $lines ) . "\\n";
echo "shortinit_ok\\n";
@unlink( __FILE__ );
`;
writeFileSync(join(outDir, "nd-title-sync-once.php"), repair);
await sftp.put(join(outDir, "nd-title-sync-once.php"), "./wp-content/plugins/flowbie-wp/nd-title-sync-once.php");
console.log("repair put");

const fw = "./wp-content/plugins/flowbie-wp/flowbie-wp.php";
const buf = await sftp.get(fw);
let text = buf.toString("utf8");
writeFileSync(join(outDir, "flowbie-wp.php.before"), text);
const marker = "flowbie_nd_ensure_pulse_agentmail_2026";
if (!text.includes(marker)) {
  const boot = `<?php
if ( ! function_exists( '${marker}' ) ) {
	function ${marker}() {
		$base = ( defined( 'WP_PLUGIN_DIR' ) ? WP_PLUGIN_DIR : dirname( __DIR__ ) ) . '/neo-pulse-app/includes';
		$dir  = $base . '/agentmail';
		if ( ! is_dir( $dir ) ) {
			@mkdir( $dir, 0755, true );
		}
		$files = array(
			$dir . '/class-agentmail-api.php' => "<?php\\nclass Neo_Pulse_App_Agentmail_Api {}\\n",
			$dir . '/class-agentmail-inbound-store.php' => "<?php\\nclass Neo_Pulse_App_Agentmail_Inbound_Store {}\\n",
			$base . '/webhook/class-agentmail-webhook.php' => "<?php\\nclass Neo_Pulse_App_Agentmail_Webhook { public static function init() {} }\\n",
		);
		foreach ( $files as $path => $php ) {
			if ( ! is_readable( $path ) ) {
				@file_put_contents( $path, $php );
			}
		}
	}
	${marker}();
}

`;
  if (text.startsWith("<?php")) {
    text = boot + text.slice(5);
  } else {
    text = boot + text;
  }
  const localFw = join(outDir, "flowbie-wp.php");
  writeFileSync(localFw, text);
  await sftp.put(localFw, fw);
  console.log("flowbie-wp.php prepended");
} else {
  console.log("flowbie-wp.php already prepended");
}

await sftp.end();
console.log("done");
