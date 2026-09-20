<?php
/**
 * Smoke tests for Speed module (run: php tests/test-speed-module.php)
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'WP_CONTENT_DIR', sys_get_temp_dir() . '/neo-pulse-speed-test' );

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

require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-speed-settings.php';
require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-speed-excludes.php';
require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-speed-minify.php';
require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-speed-cache.php';
require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-speed-assets.php';

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

$defaults = Neo_Pulse_Wp_Speed_Settings::default_config();
assert_true( empty( $defaults['enabled'] ), 'default_config disabled' );
assert_true( ! empty( $defaults['optimize_css'] ), 'default_config optimize_css' );
assert_true( ! empty( $defaults['optimize_js'] ), 'default_config optimize_js' );
assert_true( empty( $defaults['aggregate_css'] ), 'default_config no aggregate_css' );
assert_true( empty( $defaults['aggregate_js'] ), 'default_config no aggregate_js' );

$enabled_defaults = Neo_Pulse_Wp_Speed_Settings::default_enabled_config();
assert_true( ! empty( $enabled_defaults['enabled'] ), 'default_enabled_config enabled' );
assert_true( ! empty( $enabled_defaults['optimize_css'] ), 'default_enabled_config optimize_css' );
assert_true( ! empty( $enabled_defaults['optimize_js'] ), 'default_enabled_config optimize_js' );
assert_true( empty( $enabled_defaults['aggregate_css'] ), 'default_enabled_config no aggregate_css' );

$config = Neo_Pulse_Wp_Speed_Settings::sanitize_config(
	array(
		'enabled'       => true,
		'optimize_css'  => true,
		'cache_ttl'     => 3600,
		'js_exclude'    => "foo\nbar",
	)
);
assert_true( ! empty( $config['enabled'] ), 'enabled sanitized' );
assert_true( 3600 === (int) $config['cache_ttl'], 'cache ttl kept' );
$parsed = Neo_Pulse_Wp_Speed_Settings::parse_exclude_lines( (string) $config['js_exclude'] );
assert_true( 2 === count( $parsed ), 'exclude lines parsed' );

assert_true(
	! Neo_Pulse_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/neo-pulse-chat-widget.js', 'js', $config ),
	'neo-pulse chat is minified'
);
assert_true(
	Neo_Pulse_Wp_Speed_Excludes::is_defer_excluded( 'https://example.com/wp-content/neo-pulse-chat-widget.js', $config ),
	'neo-pulse chat stays off the defer list'
);
assert_true(
	! Neo_Pulse_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/plugins/neo-pulse-wp/assets/search/neo-pulse-search.js', 'js', $config ),
	'neo-pulse search not excluded'
);
assert_true(
	! Neo_Pulse_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/plugins/neo-pulse-wp/assets/search/neo-pulse-search.css', 'css', $config ),
	'neo-pulse search css not excluded'
);
assert_true(
	! Neo_Pulse_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/theme.js', 'js', $config ),
	'generic theme js not excluded'
);
assert_true(
	Neo_Pulse_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/theme-foo.js', 'js', $config ),
	'user exclude pattern matches'
);
assert_true(
	Neo_Pulse_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/plugins/elementor/assets/js/frontend.min.js', 'js', $config ),
	'elementor js is not minified'
);
assert_true(
	Neo_Pulse_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/plugins/elementor/assets/css/frontend.min.css', 'css', $config ),
	'elementor css is not minified'
);
assert_true(
	Neo_Pulse_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/themes/ygency/assets/js/jquery.waypoints.js', 'js', $config ),
	'waypoint js is not minified'
);
assert_true(
	Neo_Pulse_Wp_Speed_Excludes::is_excluded( 'https://example.com/wp-content/themes/ygency/assets/js/swiper.min.js', 'js', $config ),
	'swiper and min.js stay original'
);
$oneline = Neo_Pulse_Wp_Speed_Minify::js( 'var x="http://x.com";var y=2;' );
assert_true( $oneline === 'var x="http://x.com";var y=2;', 'already minified js is not truncated' );

$css = Neo_Pulse_Wp_Speed_Minify::css( "/* comment */\n.foo { color: red; }\n" );
assert_true( strpos( $css, 'comment' ) === false && strpos( $css, '.foo' ) !== false, 'css minified' );

if ( ! function_exists( 'wp_parse_url' ) ) {
	/**
	 * @param string $url URL.
	 * @param int    $component Component.
	 * @return mixed
	 */
	function wp_parse_url( $url, $component = -1 ) {
		return parse_url( $url, $component );
	}
}

if ( ! function_exists( 'home_url' ) ) {
	/**
	 * @param string $path Path.
	 */
	function home_url( $path = '' ) {
		return 'https://neodigital.ca' . ( $path === '' ? '' : '/' . ltrim( (string) $path, '/' ) );
	}
}

$fa = Neo_Pulse_Wp_Speed_Minify::rewrite_relative_urls(
	'@font-face{src:url(../webfonts/fa-solid-900.woff2)}',
	'https://neodigital.ca/wp-content/plugins/elementor/assets/lib/font-awesome/css/solid.min.css'
);
assert_true(
	strpos( $fa, 'url(https://neodigital.ca/wp-content/plugins/elementor/assets/lib/font-awesome/webfonts/fa-solid-900.woff2)' ) !== false,
	'relative icon font urls become absolute'
);
$root_rel = Neo_Pulse_Wp_Speed_Minify::rewrite_relative_urls(
	'@font-face{src:url(fontawesome/fa-regular-400.woff2)}',
	'/wp-content/themes/ygency/assets/css/main.css'
);
assert_true(
	strpos( $root_rel, 'url(https://neodigital.ca/wp-content/themes/ygency/assets/css/fontawesome/fa-regular-400.woff2)' ) !== false,
	'root-relative stylesheet urls resolve against home'
);
$cache_base = Neo_Pulse_Wp_Speed_Minify::rewrite_relative_urls(
	'@font-face{src:url(fontawesome/fa-regular-400.woff2)}',
	'https://neodigital.ca/wp-content/cache/neo-pulse-speed/css/abc.css'
);
assert_true(
	strpos( $cache_base, 'url(fontawesome/fa-regular-400.woff2)' ) !== false
	&& strpos( $cache_base, '/cache/neo-pulse-speed/css/fontawesome' ) === false,
	'speed cache urls are not used as rewrite base'
);
assert_true(
	Neo_Pulse_Wp_Speed_Assets::is_speed_cache_url( 'https://neodigital.ca/wp-content/cache/neo-pulse-speed/css/abc.css' ),
	'speed cache url detected'
);
assert_true(
	! Neo_Pulse_Wp_Speed_Assets::is_speed_cache_url( 'https://neodigital.ca/wp-content/themes/ygency/style.css' ),
	'theme css is not a speed cache url'
);
$nitro_tag = Neo_Pulse_Wp_Speed_Assets::with_nitro_exclude(
	'<link rel="stylesheet" href="https://neodigital.ca/wp-content/cache/neo-pulse-speed/css/abc.css">'
);
assert_true(
	strpos( $nitro_tag, '<link nitro-exclude' ) !== false,
	'speed cache link tags are marked nitro-exclude'
);
assert_true(
	$nitro_tag === Neo_Pulse_Wp_Speed_Assets::with_nitro_exclude( $nitro_tag ),
	'nitro-exclude is not duplicated'
);
assert_true(
	Neo_Pulse_Wp_Speed_Minify::resolve_css_url( 'https://neodigital.ca/a/css/', 'data:image/svg+xml;base64,xx' ) === 'data:image/svg+xml;base64,xx',
	'data urls stay untouched'
);

$html = Neo_Pulse_Wp_Speed_Minify::html( "<!DOCTYPE html>\n<html><body>  <p>Hi</p>  </body></html>\n" );
assert_true( strpos( $html, "\n\n" ) === false, 'html whitespace collapsed' );

$hash_a = Neo_Pulse_Wp_Speed_Cache::build_hash( 'a', 'css', $config );
$hash_b = Neo_Pulse_Wp_Speed_Cache::build_hash( 'b', 'css', $config );
assert_true( $hash_a !== $hash_b, 'cache hash differs by source' );
assert_true( strlen( $hash_a ) === 32, 'cache hash is md5' );
assert_true(
	$hash_a === Neo_Pulse_Wp_Speed_Cache::build_hash( 'a', 'css', $config ),
	'cache hash is stable for the same source and settings'
);

$GLOBALS['neo_pulse_test_options'] = array();
if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		if ( array_key_exists( $key, $GLOBALS['neo_pulse_test_options'] ) ) {
			return $GLOBALS['neo_pulse_test_options'][ $key ];
		}
		return $default;
	}
}
if ( ! function_exists( 'update_option' ) ) {
	function update_option( $key, $value, $autoload = true ) {
		unset( $autoload );
		$GLOBALS['neo_pulse_test_options'][ $key ] = $value;
		return true;
	}
}
if ( ! function_exists( 'add_option' ) ) {
	function add_option( $key, $value, $deprecated = '', $autoload = true ) {
		unset( $deprecated, $autoload );
		if ( array_key_exists( $key, $GLOBALS['neo_pulse_test_options'] ) ) {
			return false;
		}
		$GLOBALS['neo_pulse_test_options'][ $key ] = $value;
		return true;
	}
}

Neo_Pulse_Wp_Speed_Settings::seed_default_config_if_missing();
$seeded = get_option( Neo_Pulse_Wp_Speed_Settings::OPTION_KEY, null );
assert_true( is_array( $seeded ), 'seed writes a speed option when missing' );
assert_true( ! empty( $seeded['enabled'] ), 'seed enables Speed' );
assert_true( ! empty( $seeded['optimize_css'] ), 'seed turns on CSS minify' );
assert_true( ! empty( $seeded['optimize_js'] ), 'seed turns on JS minify' );
assert_true( ! empty( $seeded['font_display_swap'] ), 'seed turns on font-display swap' );
assert_true( empty( $seeded['aggregate_css'] ), 'seed does not aggregate CSS' );
assert_true( empty( $seeded['aggregate_js'] ), 'seed does not aggregate JS' );

$seeded['enabled'] = false;
update_option( Neo_Pulse_Wp_Speed_Settings::OPTION_KEY, $seeded );
Neo_Pulse_Wp_Speed_Settings::seed_default_config_if_missing();
$kept = get_option( Neo_Pulse_Wp_Speed_Settings::OPTION_KEY, array() );
assert_true( empty( $kept['enabled'] ), 'seed does not overwrite an existing Speed option' );

exit( $failed > 0 ? 1 : 0 );
