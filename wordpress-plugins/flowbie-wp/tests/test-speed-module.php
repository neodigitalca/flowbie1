<?php
/**
 * Smoke tests for Speed module (run: php tests/test-speed-module.php)
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'WP_CONTENT_DIR', sys_get_temp_dir() . '/flowbie-speed-test' );

if ( ! defined( 'WEEK_IN_SECONDS' ) ) {
	define( 'WEEK_IN_SECONDS', 604800 );
}
if ( ! defined( 'HOUR_IN_SECONDS' ) ) {
	define( 'HOUR_IN_SECONDS', 3600 );
}
if ( ! defined( 'DAY_IN_SECONDS' ) ) {
	define( 'DAY_IN_SECONDS', 86400 );
}

if ( ! function_exists( 'wp_parse_args' ) ) {
	/**
	 * @param array<string, mixed> $args     Args.
	 * @param array<string, mixed> $defaults Defaults.
	 * @return array<string, mixed>
	 */
	function wp_parse_args( $args, $defaults = array() ) {
		if ( is_object( $args ) ) {
			$args = get_object_vars( $args );
		}
		if ( ! is_array( $args ) ) {
			return $defaults;
		}
		return array_merge( $defaults, $args );
	}
}

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

if ( ! function_exists( 'wp_json_encode' ) ) {
	/**
	 * @param mixed $data Data.
	 */
	function wp_json_encode( $data ) {
		return json_encode( $data );
	}
}

if ( ! function_exists( 'wp_normalize_path' ) ) {
	/**
	 * @param string $path Path.
	 */
	function wp_normalize_path( $path ) {
		return str_replace( '\\', '/', $path );
	}
}

require_once dirname( __DIR__ ) . '/includes/class-flowbie-wp-speed-settings.php';
require_once dirname( __DIR__ ) . '/includes/class-flowbie-wp-speed-excludes.php';
require_once dirname( __DIR__ ) . '/includes/class-flowbie-wp-speed-minify.php';
require_once dirname( __DIR__ ) . '/includes/class-flowbie-wp-speed-cache.php';

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

$defaults = Flowbie_Wp_Speed_Settings::default_config();
assert_true( empty( $defaults['enabled'] ), 'default_config disabled' );
assert_true( ! empty( $defaults['optimize_css'] ), 'default_config optimize_css' );
assert_true( ! empty( $defaults['optimize_js'] ), 'default_config optimize_js' );
assert_true( empty( $defaults['aggregate_css'] ), 'default_config no aggregate_css' );
assert_true( empty( $defaults['aggregate_js'] ), 'default_config no aggregate_js' );

$enabled_defaults = Flowbie_Wp_Speed_Settings::default_enabled_config();
assert_true( ! empty( $enabled_defaults['enabled'] ), 'default_enabled_config enabled' );
assert_true( ! empty( $enabled_defaults['optimize_css'] ), 'default_enabled_config optimize_css' );
assert_true( ! empty( $enabled_defaults['optimize_js'] ), 'default_enabled_config optimize_js' );
assert_true( empty( $enabled_defaults['aggregate_css'] ), 'default_enabled_config no aggregate_css' );

$config = Flowbie_Wp_Speed_Settings::sanitize_config(
	array(
		'enabled'       => true,
		'optimize_css'  => true,
		'cache_ttl'     => 3600,
		'js_exclude'    => "foo\nbar",
	)
);
assert_true( ! empty( $config['enabled'] ), 'enabled sanitized' );
assert_true( 3600 === (int) $config['cache_ttl'], 'cache ttl kept' );
$parsed = Flowbie_Wp_Speed_Settings::parse_exclude_lines( (string) $config['js_exclude'] );
assert_true( 2 === count( $parsed ), 'exclude lines parsed' );

assert_true(
	Flowbie_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/flowbie-chat-widget.js', 'js', $config ),
	'flowbie chat excluded'
);
assert_true(
	! Flowbie_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/plugins/flowbie-wp/assets/search/flowbie-search.js', 'js', $config ),
	'flowbie search not excluded'
);
assert_true(
	! Flowbie_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/plugins/flowbie-wp/assets/search/flowbie-search.css', 'css', $config ),
	'flowbie search css not excluded'
);
assert_true(
	! Flowbie_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/theme.js', 'js', $config ),
	'generic theme js not excluded'
);
assert_true(
	Flowbie_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/theme-foo.js', 'js', $config ),
	'user exclude pattern matches'
);

$css = Flowbie_Wp_Speed_Minify::css( "/* comment */\n.foo { color: red; }\n" );
assert_true( strpos( $css, 'comment' ) === false && strpos( $css, '.foo' ) !== false, 'css minified' );

$html = Flowbie_Wp_Speed_Minify::html( "<!DOCTYPE html>\n<html><body>  <p>Hi</p>  </body></html>\n" );
assert_true( strpos( $html, "\n\n" ) === false, 'html whitespace collapsed' );

$hash_a = Flowbie_Wp_Speed_Cache::build_hash( 'a', 'css', $config );
$hash_b = Flowbie_Wp_Speed_Cache::build_hash( 'b', 'css', $config );
assert_true( $hash_a !== $hash_b, 'cache hash differs by source' );
assert_true( strlen( $hash_a ) === 32, 'cache hash is md5' );

exit( $failed > 0 ? 1 : 0 );
