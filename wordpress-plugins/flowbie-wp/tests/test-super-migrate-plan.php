<?php
/**
 * Super Migrate plan builder tests.
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

if ( ! function_exists( 'apply_filters' ) ) {
	function apply_filters( $hook, $value ) {
		unset( $hook );
		return $value;
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		if ( 'rank-math-options-titles' === $key && isset( $GLOBALS['flowbie_test_rank_math_titles'] ) ) {
			return $GLOBALS['flowbie_test_rank_math_titles'];
		}
		if ( 'elementor_active_kit' === $key && isset( $GLOBALS['flowbie_test_elementor_kit'] ) ) {
			return $GLOBALS['flowbie_test_elementor_kit'];
		}
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

if ( ! function_exists( 'home_url' ) ) {
	function home_url( $path = '' ) {
		return 'https://example.test/' . ltrim( $path, '/' );
	}
}

if ( ! function_exists( 'get_bloginfo' ) ) {
	function get_bloginfo( $show = '' ) {
		unset( $show );
		return '6.7';
	}
}

if ( ! function_exists( 'wp_parse_args' ) ) {
	function wp_parse_args( $args, $defaults = array() ) {
		return array_merge( $defaults, is_array( $args ) ? $args : array() );
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! class_exists( 'Flowbie_Wp_Admin_Menu' ) ) {
	class Flowbie_Wp_Admin_Menu {
		public static function get_menu_definition(): array {
			return array(
				array(
					'id'    => 'general',
					'label' => 'General',
					'items' => array(),
				),
				array(
					'id'    => 'fields',
					'label' => 'Fields',
					'items' => array(),
				),
			);
		}
	}
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-flo-sheet.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/interface-flowbie-wp-migrate-adapter.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-flowbie-wp-migrate-source-flowbie-native.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-flowbie-wp-migrate-source-rank-math.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-flowbie-wp-migrate-source-elementor.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/class-flowbie-wp-super-migrate-registry.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-super-import-plugins.php';

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

$plan = Flowbie_Wp_Super_Migrate_Registry::build_plan( array( 'crawl' ) );
assert_true( ! empty( $plan['micro'] ), 'native crawl adds micro steps' );
assert_true(
	$plan['micro'][0]['adapter'] === 'flowbie_native',
	'first adapter is flowbie_native when alone'
);

$empty = Flowbie_Wp_Flo_Sheet::from_json( '' );
assert_true( empty( $empty['ok'] ), 'empty json rejected' );

$sheet = Flowbie_Wp_Flo_Sheet::empty_sheet();
$json  = Flowbie_Wp_Flo_Sheet::to_json( $sheet );
$round = Flowbie_Wp_Flo_Sheet::from_json( $json );
assert_true( ! empty( $round['ok'] ), 'flo sheet round-trip' );

$GLOBALS['flowbie_test_rank_math_titles'] = array( 'knowledgegraph_name' => 'Test Co' );

if ( ! class_exists( 'wpdb' ) ) {
	class wpdb {
		public $postmeta = 'wp_postmeta';
		public function prepare( $query ) {
			return $query;
		}
		public function esc_like( $text ) {
			return $text;
		}
		public function get_var( $query ) {
			unset( $query );
			return '0';
		}
	}
	$GLOBALS['wpdb'] = new wpdb();
}

$rank_math = new Flowbie_Wp_Migrate_Source_Rank_Math();
$crawl_steps = $rank_math->get_steps( 'crawl' );
$crawl_ids = array_column( $crawl_steps, 'id' );
assert_true( in_array( 'rank_math_crawl_schema', $crawl_ids, true ), 'rank math crawl includes schema step' );

$apply_steps = $rank_math->get_steps( 'apply' );
$apply_ids = array_column( $apply_steps, 'id' );
assert_true( in_array( 'rank_math_apply_schema', $apply_ids, true ), 'rank math apply includes schema step' );

$GLOBALS['flowbie_test_elementor_kit'] = 42;
$elementor = new Flowbie_Wp_Migrate_Source_Elementor();
$elementor_crawl = $elementor->get_steps( 'crawl' );
$elementor_crawl_ids = array_column( $elementor_crawl, 'id' );
assert_true( in_array( 'elementor_crawl_globals', $elementor_crawl_ids, true ), 'elementor crawl includes globals step' );

$elementor_apply = $elementor->get_steps( 'apply' );
$elementor_apply_ids = array_column( $elementor_apply, 'id' );
assert_true( in_array( 'elementor_apply_globals', $elementor_apply_ids, true ), 'elementor apply includes globals step' );

$plugin_map = Flowbie_Wp_Super_Import_Plugins::rank_math_bootstrap_files();
assert_true( is_array( $plugin_map ), 'super import plugin map helper works' );
$reflection = new ReflectionClass( 'Flowbie_Wp_Super_Import_Plugins' );
$method = $reflection->getMethod( 'adapter_plugin_map' );
$method->setAccessible( true );
$adapters = $method->invoke( null );
assert_true( ! isset( $adapters['elementor'] ), 'elementor is excluded from deactivate-conflicts map' );

exit( $failed > 0 ? 1 : 0 );
