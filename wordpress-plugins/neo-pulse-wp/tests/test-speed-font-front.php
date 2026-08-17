<?php
/**
 * Smoke tests for font display and front optimizations.
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

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
	function esc_url( $url ) { // phpcs:ignore
		return $url;
	}
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-minify.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-front.php';

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

$css = '@font-face { font-family: "Test"; src: url(a.woff2); }';
$out = Neo_Pulse_Wp_Speed_Minify::ensure_font_display_swap( $css );
assert_true( stripos( $out, 'font-display:swap' ) !== false, 'injects font-display swap into @font-face' );

$url = 'https://fonts.googleapis.com/css2?family=Roboto';
$swap = Neo_Pulse_Wp_Speed_Front::url_with_display_swap( $url );
assert_true( stripos( $swap, 'display=swap' ) !== false, 'google fonts URL gets display=swap' );

$config = array(
	'enabled'            => true,
	'font_display_swap'  => true,
	'preconnect_fonts'   => true,
	'async_google_fonts' => true,
);

$html = '<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto"></head><body></body></html>';
$processed = Neo_Pulse_Wp_Speed_Front::process( $html, $config );
assert_true( stripos( $processed, 'preconnect' ) !== false, 'injects preconnect for google fonts' );
assert_true( stripos( $processed, 'display=swap' ) !== false, 'google fonts link includes display swap' );

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll speed font front smoke tests passed.\n";
exit( $failed > 0 ? 1 : 0 );
