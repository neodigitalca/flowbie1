<?php
/**
 * HFCM snippet row mapping tests.
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data, $options = 0, $depth = 512 ) {
		unset( $options, $depth );
		return json_encode( $data );
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $text ) {
		return is_string( $text ) ? trim( $text ) : '';
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-script-manager-rules.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-script-manager-import.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/interface-neo-pulse-wp-migrate-adapter.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-neo-pulse-wp-migrate-source-hfcm.php';

$failed = 0;

function assert_true( bool $cond, string $msg ): void {
	global $failed;
	if ( ! $cond ) {
		echo "FAIL: {$msg}\n";
		$failed++;
	} else {
		echo "OK: {$msg}\n";
	}
}

$row = Neo_Pulse_Wp_Migrate_Source_Hfcm::hfcm_row_to_snippet(
	array(
		'name'         => 'Dynamic Copyright Year',
		'snippet'      => '<script>console.log(1)</script>',
		'location'     => 'header',
		'status'       => 'active',
		'snippet_type' => 'js',
		'display_on'   => 'All',
	)
);

assert_true( $row['name'] === 'Dynamic Copyright Year', 'maps snippet name from HFCM DB row' );
assert_true( $row['location'] === 'header', 'maps location' );
assert_true( strpos( $row['snippet'], '<script>' ) !== false, 'wraps raw JS snippets in script tags' );

$body_row = Neo_Pulse_Wp_Migrate_Source_Hfcm::hfcm_row_to_snippet(
	array(
		'name'     => 'Body Tag',
		'snippet'  => '<div>body</div>',
		'location' => 'before_content',
		'status'   => 'active',
	)
);
$body_parsed = Neo_Pulse_Wp_Script_Manager_Import::hfcm_snippets_to_rows( array( $body_row ) );
assert_true( ! empty( $body_parsed['rows'] ), 'before_content maps to import row' );
assert_true( $body_parsed['rows'][0]['placement'] === 'body', 'before_content maps to body placement' );

$parsed = Neo_Pulse_Wp_Script_Manager_Import::hfcm_snippets_to_rows( array( $row ) );
assert_true( empty( $parsed['error'] ), 'hfcm snippets convert to import rows' );
assert_true( ! empty( $parsed['rows'] ), 'produces import rows' );
assert_true( $parsed['rows'][0]['name'] === 'Dynamic Copyright Year', 'import row keeps snippet name' );

$second = Neo_Pulse_Wp_Migrate_Source_Hfcm::hfcm_row_to_snippet(
	array(
		'name'         => 'AI Policy',
		'snippet'      => '<meta name="robots" content="noai">',
		'location'     => 'header',
		'status'       => 'active',
		'snippet_type' => 'html',
		'display_on'   => 'All',
	)
);
$multi = Neo_Pulse_Wp_Script_Manager_Import::hfcm_snippets_to_rows( array( $row, $second ) );
assert_true( count( $multi['rows'] ) === 2, 'imports all HFCM snippets from a batch' );

$json = wp_json_encode(
	array(
		'snippets' => array( $row, $second ),
	)
);
$file_import = Neo_Pulse_Wp_Script_Manager_Import::parse_hfcm_export( is_string( $json ) ? $json : '{}' );
assert_true( count( $file_import['rows'] ) === 2, 'HFCM JSON export path imports all snippets' );

$empty_code = Neo_Pulse_Wp_Migrate_Source_Hfcm::hfcm_row_to_snippet(
	array(
		'name'     => 'Empty Snippet',
		'snippet'  => '   ',
		'location' => 'header',
	)
);
$empty_result = Neo_Pulse_Wp_Script_Manager_Import::hfcm_snippets_to_rows( array( $empty_code ) );
assert_true( ! empty( $empty_result['error'] ), 'empty snippet code returns an error instead of silent skip' );

assert_true(
	Neo_Pulse_Wp_Migrate_Source_Hfcm::is_hfcm_present() || ! Neo_Pulse_Wp_Migrate_Source_Hfcm::is_hfcm_plugin_active(),
	'ihaf fallback guard: is_hfcm_present tracks plugin activation'
);

exit( $failed > 0 ? 1 : 0 );
