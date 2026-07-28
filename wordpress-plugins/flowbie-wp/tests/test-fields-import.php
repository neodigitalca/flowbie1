<?php
/**
 * Smoke tests for ACF JSON import (window coverings fixture).
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

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-import-export.php';

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

$fixture_path = Flowbie_Wp_Fields_Import_Export::bundled_window_coverings_path();
assert_true( is_readable( $fixture_path ), 'window coverings fixture exists' );

$counts = Flowbie_Wp_Fields_Import_Export::count_entities_in_json_file( $fixture_path );
assert_true( is_array( $counts ), 'fixture entity counts parsed' );

$expected = Flowbie_Wp_Fields_Import_Export::window_coverings_fixture_counts();
assert_true( $counts['groups'] === $expected['groups'], 'fixture has 15 field groups' );
assert_true( $counts['post_types'] === $expected['post_types'], 'fixture has 11 post types' );
assert_true( $counts['taxonomies'] === $expected['taxonomies'], 'fixture has 6 taxonomies' );
assert_true( $counts['options_pages'] === $expected['options_pages'], 'fixture has 1 options page' );

$json = file_get_contents( $fixture_path );
assert_true( is_string( $json ), 'fixture JSON readable' );

$decoded = json_decode( $json, true );
assert_true( is_array( $decoded ), 'fixture JSON decodes' );

$has_hours_toggle = false;
foreach ( $decoded as $item ) {
	if ( ! is_array( $item ) || ( $item['key'] ?? '' ) !== 'group_66db25d7854b7' ) {
		continue;
	}
	foreach ( $item['fields'] ?? array() as $field ) {
		if ( is_array( $field ) && ( $field['key'] ?? '' ) === 'field_683778df90240' ) {
			$has_hours_toggle = true;
			break 2;
		}
	}
}
assert_true( $has_hours_toggle, 'contact group includes short-form hours toggle field' );

$smb_path = Flowbie_Wp_Fields_Import_Export::bundled_smb_starter_path();
assert_true( is_readable( $smb_path ), 'SMB Starter fixture exists' );

$smb_counts = Flowbie_Wp_Fields_Import_Export::count_entities_in_json_file( $smb_path );
assert_true( is_array( $smb_counts ), 'SMB Starter entity counts parsed' );

$smb_expected = Flowbie_Wp_Fields_Import_Export::smb_starter_fixture_counts();
assert_true( $smb_counts['groups'] === $smb_expected['groups'], 'SMB Starter has 3 field groups' );
assert_true( $smb_counts['post_types'] === $smb_expected['post_types'], 'SMB Starter has 2 post types' );
assert_true( $smb_counts['taxonomies'] === $smb_expected['taxonomies'], 'SMB Starter has 1 taxonomy' );
assert_true( $smb_counts['options_pages'] === $smb_expected['options_pages'], 'SMB Starter has 0 options pages' );

$pt_sample = array(
	'key'       => 'post_type_test',
	'post_type' => 'hunter-douglas',
	'menu_icon' => array(
		'type'  => 'dashicons',
		'value' => 'dashicons-format-chat',
	),
	'rewrite'   => array(
		'permalink_rewrite' => 'post_type_key',
		'with_front'        => '0',
	),
	'taxonomies' => '',
);
$normalized_pt = Flowbie_Wp_Fields_Import_Export::normalize_post_type( $pt_sample );
assert_true( $normalized_pt['menu_icon'] === 'dashicons-format-chat', 'normalize_post_type resolves dashicons menu_icon' );
assert_true( is_array( $normalized_pt['taxonomies'] ) && empty( $normalized_pt['taxonomies'] ), 'normalize_post_type coerces empty taxonomies' );
assert_true( ( $normalized_pt['rewrite']['slug'] ?? '' ) === 'hunter-douglas', 'normalize_post_type sets rewrite slug from CPT key' );

$opt_sample = array(
	'key'        => 'ui_options_page_test',
	'menu_slug'  => 'contact-information',
	'page_title' => 'Contact Information',
	'capability' => 'edit_posts',
);
$normalized_opt = Flowbie_Wp_Fields_Import_Export::normalize_options_page( $opt_sample );
assert_true( $normalized_opt['menu_slug'] === 'contact-information', 'normalize_options_page keeps menu_slug' );
assert_true( $normalized_opt['capability'] === 'edit_posts', 'normalize_options_page keeps capability' );

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll tests passed.\n";
exit( $failed > 0 ? 1 : 0 );
