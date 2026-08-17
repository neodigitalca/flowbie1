<?php
/**
 * Smoke tests for Elementor-aware Speed gates and excludes.
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

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-settings.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-excludes.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-gate.php';

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

$config = array(
	'aggregate_css' => true,
	'aggregate_js'  => true,
	'defer_js'      => true,
);

$elementor_html = '<html><body class="elementor-page"><div data-elementor-type="wp-page"></div><script src="/elementor-frontend.min.js"></script></body></html>';
$plain_html     = '<html><body><p>Hello</p></body></html>';

assert_true( Neo_Pulse_Wp_Speed_Gate::html_uses_elementor( $elementor_html ), 'detects elementor-page markup' );
assert_true( ! Neo_Pulse_Wp_Speed_Gate::html_uses_elementor( $plain_html ), 'plain HTML is not elementor' );

$safe = Neo_Pulse_Wp_Speed_Gate::config_for_html( $config, $elementor_html );
assert_true( empty( $safe['aggregate_css'] ) && empty( $safe['aggregate_js'] ) && empty( $safe['defer_js'] ), 'elementor config disables risky flags' );

$unchanged = Neo_Pulse_Wp_Speed_Gate::config_for_html( $config, $plain_html );
assert_true( ! empty( $unchanged['aggregate_css'] ), 'non-elementor config unchanged' );

assert_true(
	Neo_Pulse_Wp_Speed_Excludes::is_defer_excluded( 'https://example.test/wp-content/plugins/elementor/assets/js/frontend.min.js', array() ),
	'elementor-frontend script URL is excluded from defer'
);

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll speed elementor gate smoke tests passed.\n";
exit( $failed > 0 ? 1 : 0 );
