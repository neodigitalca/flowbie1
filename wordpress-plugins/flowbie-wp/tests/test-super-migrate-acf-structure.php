<?php
/**
 * ACF structure fetch/categorize tests.
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

if ( ! class_exists( 'Flowbie_Wp_Fields', false ) ) {
	class Flowbie_Wp_Fields {
		public static function acf_is_active(): bool {
			return true;
		}
	}
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/interface-flowbie-wp-migrate-adapter.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-flowbie-wp-migrate-source-acf.php';

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

$sample = array(
	array( 'key' => 'group_abc', 'title' => 'Contact' ),
	array( 'key' => 'post_type_service_area', 'post_type' => 'service-area', 'title' => 'Service Areas' ),
	array( 'key' => 'taxonomy_city', 'taxonomy' => 'city', 'title' => 'Cities' ),
	array( 'key' => 'ui_options_page_contact', 'menu_slug' => 'contact-information' ),
);

$split = Flowbie_Wp_Migrate_Source_Acf::categorize_structure_items( $sample );
assert_true( count( $split['groups'] ) === 1, 'categorize keeps field groups' );
assert_true( count( $split['post_types'] ) === 1, 'categorize keeps post types' );
assert_true( count( $split['taxonomies'] ) === 1, 'categorize keeps taxonomies' );
assert_true( count( $split['options_pages'] ) === 1, 'categorize keeps options pages' );

$group_with_options = array(
	array(
		'key'      => 'group_66db25d7854b7',
		'location' => array(
			array(
				array(
					'param'    => 'options_page',
					'operator' => '==',
					'value'    => 'contact-information',
				),
			),
		),
	),
);
$location_slugs = Flowbie_Wp_Migrate_Source_Acf::collect_options_page_slugs_from_groups( $group_with_options );
assert_true( in_array( 'contact-information', $location_slugs, true ), 'collect_options_page_slugs_from_groups finds contact-information' );

$synthesized = Flowbie_Wp_Migrate_Source_Acf::synthesize_options_pages_from_slugs( $location_slugs, array() );
assert_true( count( $synthesized ) === 1, 'synthesize creates options page from group location slug' );

$fixture_path = FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/fixtures/acf-export-smb-starter.json';
$json         = file_get_contents( $fixture_path );
$data         = is_string( $json ) ? json_decode( $json, true ) : null;
assert_true( is_array( $data ), 'SMB fixture decodes' );

$fixture_split = Flowbie_Wp_Migrate_Source_Acf::categorize_structure_items( $data );
assert_true( count( $fixture_split['groups'] ) === 3, 'SMB fixture has 3 groups' );
assert_true( count( $fixture_split['post_types'] ) === 2, 'SMB fixture has 2 post types' );
assert_true( count( $fixture_split['taxonomies'] ) === 1, 'SMB fixture has 1 taxonomy' );

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll tests passed.\n";
exit( $failed > 0 ? 1 : 0 );
