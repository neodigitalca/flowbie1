<?php
/**
 * Rank Math redirect source parser tests.
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

if ( ! function_exists( 'maybe_unserialize' ) ) {
	function maybe_unserialize( $data ) {
		if ( is_string( $data ) ) {
			$un = @unserialize( $data );
			if ( $un !== false || $data === 'b:0;' ) {
				return $un;
			}
		}
		return $data;
	}
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-redirects-csv.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/interface-neo-pulse-wp-migrate-adapter.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-neo-pulse-wp-migrate-source-rank-math.php';

$failed = 0;

function assert_eq( $expected, $actual, string $msg ): void {
	global $failed;
	if ( $expected !== $actual ) {
		echo "FAIL: {$msg} (expected {$expected}, got {$actual})\n";
		$failed++;
	} else {
		echo "OK: {$msg}\n";
	}
}

$serialized = serialize(
	array(
		array(
			'pattern' => '/old-page/',
			'comparison' => 'exact',
		),
	)
);

$source = Neo_Pulse_Wp_Migrate_Source_Rank_Math::parse_rank_math_source( $serialized );
assert_eq( 'old-page/', $source, 'parses serialized rank math source' );

$plain = Neo_Pulse_Wp_Migrate_Source_Rank_Math::parse_rank_math_source( '/another-path/' );
assert_eq( 'another-path/', $plain, 'parses plain path source' );

exit( $failed > 0 ? 1 : 0 );
