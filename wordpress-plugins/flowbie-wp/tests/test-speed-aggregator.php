<?php
/**
 * Smoke tests for Speed CSS aggregation safety.
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'FLOWBIE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/flowbie-wp.php' );
define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

if ( ! function_exists( 'apply_filters' ) ) {
	/**
	 * @param mixed $value Value.
	 * @return mixed
	 */
	function apply_filters( $hook, $value ) { // phpcs:ignore
		unset( $hook );
		return $value;
	}
}

if ( ! function_exists( 'esc_url' ) ) {
	/**
	 * @param string $url URL.
	 */
	function esc_url( $url ) {
		return $url;
	}
}

if ( ! function_exists( 'home_url' ) ) {
	function home_url( $path = '' ) {
		return 'https://example.test/' . ltrim( (string) $path, '/' );
	}
}

if ( ! function_exists( 'content_url' ) ) {
	function content_url( $path = '' ) {
		return 'https://example.test/wp-content/' . ltrim( (string) $path, '/' );
	}
}

if ( ! function_exists( 'site_url' ) ) {
	function site_url( $path = '' ) {
		return 'https://example.test/' . ltrim( (string) $path, '/' );
	}
}

if ( ! function_exists( 'is_ssl' ) ) {
	function is_ssl() {
		return true;
	}
}

if ( ! function_exists( 'wp_normalize_path' ) ) {
	function wp_normalize_path( $path ) {
		return str_replace( '\\', '/', (string) $path );
	}
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-settings.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-cache.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-minify.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-excludes.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-assets.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-aggregator.php';

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

$html = '<!DOCTYPE html><html><head>'
	. '<link rel="stylesheet" href="https://example.test/wp-content/themes/theme/style.css" />'
	. '</head><body><p>Hi</p></body></html>';

$config = array_merge(
	Flowbie_Wp_Speed_Settings::default_config(),
	array(
		'enabled'       => true,
		'optimize_css'  => true,
		'aggregate_css' => true,
	)
);

$result = Flowbie_Wp_Speed_Aggregator::aggregate_stylesheets( $html, $config );

assert_true(
	strpos( $result, 'themes/theme/style.css' ) !== false,
	'unresolvable local stylesheet links are not stripped without a bundle'
);

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll speed aggregator smoke tests passed.\n";
exit( $failed > 0 ? 1 : 0 );
