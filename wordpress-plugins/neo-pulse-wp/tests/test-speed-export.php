<?php
/**
 * Smoke tests for Speed settings JSON export.
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

if ( ! function_exists( 'home_url' ) ) {
	function home_url( $path = '' ) {
		return 'https://example.test/' . ltrim( (string) $path, '/' );
	}
}

if ( ! function_exists( 'get_bloginfo' ) ) {
	function get_bloginfo( $show ) {
		return 'version' === $show ? '6.4' : '';
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		unset( $key );
		return $default;
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data, $options = 0 ) {
		return json_encode( $data, $options );
	}
}

if ( ! function_exists( 'sanitize_file_name' ) ) {
	function sanitize_file_name( $filename ) {
		return preg_replace( '/[^a-z0-9._-]/i', '-', (string) $filename );
	}
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-settings.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-excludes.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-cache.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-image-settings.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-export.php';

$failed = 0;

/**
 * @param bool   $cond Condition.
 * @param string $msg Message.
 */
function assert_true( bool $cond, string $msg ): void {
	global $failed;
	if ( ! $cond ) {
		echo "FAIL: {$msg}\n";
		$failed++;
	} else {
		echo "OK: {$msg}\n";
	}
}

$data = Neo_Pulse_Wp_Speed_Export::collect();
assert_true( isset( $data['meta'], $data['speed'], $data['speed_images'], $data['cache'] ), 'collect has meta, speed, speed_images, cache' );
assert_true( is_array( $data['speed'] ) && array_key_exists( 'enabled', $data['speed'] ), 'speed config includes enabled' );

$json = Neo_Pulse_Wp_Speed_Export::build_json();
assert_true( $json !== '' && $json !== '{}', 'build_json returns non-empty JSON' );
$decoded = json_decode( $json, true );
assert_true( is_array( $decoded ) && isset( $decoded['speed'] ), 'build_json decodes to array with speed' );

$redacted = Neo_Pulse_Wp_Speed_Export::redact_secrets(
	array(
		'api_key' => 'secret-value',
		'enabled' => true,
	)
);
assert_true( $redacted['api_key'] === '__REDACTED__', 'redact_secrets masks api_key' );
assert_true( $redacted['enabled'] === true, 'redact_secrets leaves non-secret keys' );

$filename = Neo_Pulse_Wp_Speed_Export::download_filename();
assert_true( strpos( $filename, 'neo-pulse-speed-settings-' ) === 0 && substr( $filename, -5 ) === '.json', 'download_filename format' );

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll speed export smoke tests passed.\n";
exit( $failed > 0 ? 1 : 0 );
