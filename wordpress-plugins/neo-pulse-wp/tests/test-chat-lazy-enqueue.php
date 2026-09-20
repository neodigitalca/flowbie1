<?php
/**
 * Chat frontend lazy enqueue (no Lato, no full widget on first paint).
 *
 * Run: php tests/test-chat-lazy-enqueue.php
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

$GLOBALS['np_is_admin'] = false;

if ( ! function_exists( 'is_admin' ) ) {
	function is_admin() {
		return ! empty( $GLOBALS['np_is_admin'] );
	}
}

if ( ! function_exists( 'plugin_dir_url' ) ) {
	/**
	 * @param string $file Plugin file.
	 */
	function plugin_dir_url( $file ) { // phpcs:ignore
		unset( $file );
		return 'https://neodigital.ca/wp-content/plugins/neo-pulse-wp/';
	}
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat.php';

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

$GLOBALS['np_is_admin'] = false;
assert_true( Neo_Pulse_Wp_Chat::should_lazy_load_frontend(), 'frontend uses lazy chat load' );

$GLOBALS['np_is_admin'] = true;
assert_true( ! Neo_Pulse_Wp_Chat::should_lazy_load_frontend(), 'admin still uses full enqueue' );

$assets = Neo_Pulse_Wp_Chat::frontend_lazy_assets(
	array( 'voiceEnabled' => false ),
	array()
);

$joined = implode( "\n", array_merge( $assets['styles'], $assets['scripts'] ) );
assert_true( str_contains( $joined, 'neo-pulse-chat-widget.js' ), 'lazy list includes widget JS' );
assert_true( str_contains( $joined, 'neo-pulse-chat-widget.css' ), 'lazy list includes widget CSS' );
assert_true( ! str_contains( $joined, 'fonts.googleapis.com' ), 'lazy list has no Google Fonts' );
assert_true( ! str_contains( strtolower( $joined ), 'lato' ), 'lazy list has no Lato' );
assert_true( ! str_contains( $joined, 'neo-pulse-chat-lazy.js' ), 'lazy loader is not in the deferred list' );

$lazy_js = file_get_contents( NEO_PULSE_WP_PLUGIN_DIR . 'assets/frontend/neo-pulse-chat-lazy.js' );
assert_true( is_string( $lazy_js ) && str_contains( $lazy_js, 'requestIdleCallback' ), 'lazy script waits for idle' );
assert_true( is_string( $lazy_js ) && str_contains( $lazy_js, 'data-fcw-chat-launcher' ), 'lazy script loads on launcher tap' );
assert_true( is_string( $lazy_js ) && str_contains( $lazy_js, 'fcw-launcher--pending' ), 'lazy script reveals the launcher after CSS' );
assert_true( str_contains( Neo_Pulse_Wp_Chat::pending_launcher_css(), 'fcw-launcher--pending' ), 'pending CSS hides the unstyled tab' );

$mobile_css = Neo_Pulse_Wp_Chat::mobile_launcher_force_css();
assert_true( str_contains( $mobile_css, '#neo-pulse-chat-mobile-launcher.fcw-launcher--edge-tab' ), 'mobile CSS turns the edge tab into a circle' );
assert_true( str_contains( $mobile_css, 'fai-sidebar-root--peek:not(.fai-sidebar-root--open)' ), 'mobile CSS hides peek' );
assert_true( ! str_contains( $mobile_css, ':not(.fcw-launcher--edge-tab)' ), 'mobile CSS does not keep the edge rail' );

$widget_js = file_get_contents( NEO_PULSE_WP_PLUGIN_DIR . 'assets/frontend/neo-pulse-chat-widget.js' );
assert_true( is_string( $widget_js ) && str_contains( $widget_js, 'function isEdgeTabDesktop()' ), 'widget keeps edge tab on desktop only' );
assert_true( is_string( $widget_js ) && str_contains( $widget_js, 'if (!isEdgeTabDesktop() || prefersReducedMotion()) return;' ), 'widget skips peek on mobile' );

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll chat lazy enqueue tests passed.\n";
exit( $failed > 0 ? 1 : 0 );
