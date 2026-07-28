<?php
/**
 * Rank Math redirect source parser tests.
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'FLOWBIE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/flowbie-wp.php' );
define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

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

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-redirects-csv.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/interface-flowbie-wp-migrate-adapter.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-flowbie-wp-migrate-source-rank-math.php';

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

$source = Flowbie_Wp_Migrate_Source_Rank_Math::parse_rank_math_source( $serialized );
assert_eq( 'old-page/', $source, 'parses serialized rank math source' );

$plain = Flowbie_Wp_Migrate_Source_Rank_Math::parse_rank_math_source( '/another-path/' );
assert_eq( 'another-path/', $plain, 'parses plain path source' );

exit( $failed > 0 ? 1 : 0 );
