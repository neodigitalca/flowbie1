<?php
/**
 * Super Import plugin deactivation map tests.
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-super-import-plugins.php';

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

$files = Neo_Pulse_Wp_Super_Import_Plugins::rank_math_bootstrap_files();
assert_true( isset( $files['seo-by-rank-math/rank-math.php'] ), 'rank math free bootstrap path present' );
assert_true( isset( $files['seo-by-rank-math-pro/rank-math-pro.php'] ), 'rank math pro bootstrap path present' );
assert_true( $files['seo-by-rank-math/rank-math.php'] === 'Rank Math SEO', 'free plugin label' );
assert_true( $files['seo-by-rank-math-pro/rank-math-pro.php'] === 'Rank Math SEO PRO', 'pro plugin label' );
assert_true( count( $files ) === 2, 'rank math maps exactly two separate plugins' );

exit( $failed > 0 ? 1 : 0 );
