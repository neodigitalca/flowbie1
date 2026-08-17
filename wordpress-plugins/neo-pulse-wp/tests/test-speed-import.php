<?php
/**
 * Smoke tests for Speed settings JSON import and presets.
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

if ( ! function_exists( 'apply_filters' ) ) {
	function apply_filters( $hook, $value ) {
		unset( $hook );
		return $value;
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		unset( $key );
		return $default;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( $key, $value, $autoload = true ) {
		unset( $key, $value, $autoload );
		return true;
	}
}

if ( ! function_exists( 'add_option' ) ) {
	function add_option( $key, $value, $deprecated = '', $autoload = true ) {
		unset( $key, $value, $deprecated, $autoload );
		return true;
	}
}

if ( ! function_exists( 'wp_parse_args' ) ) {
	function wp_parse_args( $args, $defaults = array() ) {
		return array_merge( $defaults, $args );
	}
}

if ( ! class_exists( 'WP_Error' ) ) {
	class WP_Error {
		private $message;
		public function __construct( $code, $message ) {
			unset( $code );
			$this->message = $message;
		}
		public function get_error_message() {
			return $this->message;
		}
	}
}

if ( ! function_exists( 'is_wp_error' ) ) {
	function is_wp_error( $thing ) {
		return $thing instanceof WP_Error;
	}
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-settings.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-image-settings.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-export.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-import.php';

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

$preset_path = Neo_Pulse_Wp_Speed_Import::preset_file_path( Neo_Pulse_Wp_Speed_Import::PRESET_ELEMENTOR_SAFE );
assert_true( is_readable( $preset_path ), 'elementor-safe preset file exists' );

$preset = Neo_Pulse_Wp_Speed_Import::load_preset( Neo_Pulse_Wp_Speed_Import::PRESET_ELEMENTOR_SAFE );
assert_true( ! is_wp_error( $preset ) && ! empty( $preset['speed'] ), 'load_preset returns speed block' );
assert_true( empty( $preset['speed']['aggregate_js'] ) && empty( $preset['speed']['defer_js'] ), 'preset disables aggregate and defer' );

$parsed = Neo_Pulse_Wp_Speed_Import::parse_json( file_get_contents( $preset_path ) );
assert_true( ! is_wp_error( $parsed ) && isset( $parsed['speed']['enabled'] ), 'parse_json reads preset file' );

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll speed import smoke tests passed.\n";
exit( $failed > 0 ? 1 : 0 );
