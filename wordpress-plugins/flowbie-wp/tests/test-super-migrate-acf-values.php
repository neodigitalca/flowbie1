<?php
/**
 * ACF options/post value import tests.
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'FLOWBIE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/flowbie-wp.php' );
define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

$GLOBALS['flowbie_test_options'] = array();
$GLOBALS['flowbie_test_post_meta'] = array();
$GLOBALS['flowbie_test_get_field_map'] = array();
$GLOBALS['flowbie_test_updated_options'] = array();
$GLOBALS['flowbie_test_updated_posts'] = array();

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		return $GLOBALS['flowbie_test_options'][ $key ] ?? $default;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( $key, $value ) {
		$GLOBALS['flowbie_test_options'][ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'get_post_meta' ) ) {
	function get_post_meta( $post_id, $key, $single = false ) {
		unset( $single );
		return $GLOBALS['flowbie_test_post_meta'][ $post_id ][ $key ] ?? '';
	}
}

if ( ! function_exists( 'metadata_exists' ) ) {
	function metadata_exists( $type, $object_id, $meta_key ) {
		unset( $type );
		return isset( $GLOBALS['flowbie_test_post_meta'][ $object_id ][ $meta_key ] );
	}
}

if ( ! function_exists( 'get_field' ) ) {
	function get_field( $selector, $post_id = false, $format_value = true ) {
		unset( $format_value );
		$key = is_int( $post_id ) || is_numeric( $post_id )
			? 'post:' . (int) $post_id . ':' . (string) $selector
			: 'option:' . (string) $post_id . ':' . (string) $selector;
		return $GLOBALS['flowbie_test_get_field_map'][ $key ] ?? null;
	}
}

if ( ! function_exists( 'get_fields' ) ) {
	function get_fields( $post_id = false, $format_value = true ) {
		unset( $format_value );
		$prefix = is_int( $post_id ) || is_numeric( $post_id )
			? 'post:' . (int) $post_id . ':'
			: 'option:' . (string) $post_id . ':';
		$out    = array();
		foreach ( $GLOBALS['flowbie_test_get_field_map'] as $key => $value ) {
			if ( 0 === strpos( $key, $prefix ) ) {
				$name = substr( $key, strlen( $prefix ) );
				$out[ $name ] = $value;
			}
		}
		return $out;
	}
}

if ( ! class_exists( 'Flowbie_Wp_Fields', false ) ) {
	class Flowbie_Wp_Fields {
		public static function acf_is_active(): bool {
			return true;
		}
	}
}

if ( ! class_exists( 'Flowbie_Wp_Fields_Location', false ) ) {
	class Flowbie_Wp_Fields_Location {
		public static function matches_group( array $group, array $screen ): bool {
			$location = isset( $group['location'] ) && is_array( $group['location'] ) ? $group['location'] : array();
			foreach ( $location as $rule_group ) {
				if ( ! is_array( $rule_group ) ) {
					continue;
				}
				$match = true;
				foreach ( $rule_group as $rule ) {
					if ( ! is_array( $rule ) ) {
						$match = false;
						break;
					}
					if ( ( $rule['param'] ?? '' ) === 'options_page' && (string) ( $rule['value'] ?? '' ) !== (string) ( $screen['options_page'] ?? '' ) ) {
						$match = false;
						break;
					}
				}
				if ( $match ) {
					return true;
				}
			}
			return false;
		}
	}
}

if ( ! class_exists( 'Flowbie_Wp_Fields_Values', false ) ) {
	class Flowbie_Wp_Fields_Values {
		public static function screen_for_post( int $post_id ): array {
			return array(
				'post_id'   => $post_id,
				'post_type' => 'service-area',
			);
		}

		public static function update_option( string $option_slug, array $field, $value ): void {
			$name = (string) ( $field['name'] ?? '' );
			$GLOBALS['flowbie_test_updated_options'][] = array(
				'slug'  => $option_slug,
				'name'  => $name,
				'value' => $value,
			);
			update_option( $option_slug . '_' . $name, $value );
			if ( ! empty( $field['key'] ) ) {
				update_option( '_' . $option_slug . '_' . $name, (string) $field['key'] );
			}
		}

		public static function update_value( int $post_id, array $field, $value ): bool {
			$name = (string) ( $field['name'] ?? '' );
			$GLOBALS['flowbie_test_updated_posts'][] = array(
				'post_id' => $post_id,
				'name'    => $name,
				'value'   => $value,
			);
			$GLOBALS['flowbie_test_post_meta'][ $post_id ][ $name ] = $value;
			return true;
		}
	}
}

if ( ! class_exists( 'Flowbie_Wp_Fields_Registry', false ) ) {
	class Flowbie_Wp_Fields_Registry {
		public static function update_value( $value, array $field, int $post_id ) {
			unset( $field, $post_id );
			return $value;
		}
	}
}

if ( ! class_exists( 'Flowbie_Wp_Fields_Validation', false ) ) {
	class Flowbie_Wp_Fields_Validation {
		public static function validate( array $field, $value ) {
			unset( $field, $value );
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

$groups = array(
	array(
		'key'      => 'group_contact',
		'location' => array(
			array(
				array(
					'param'    => 'options_page',
					'operator' => '==',
					'value'    => 'contact-information',
				),
			),
		),
		'fields'   => array(
			array(
				'key'  => 'field_company',
				'name' => 'ci_company_name',
				'type' => 'text',
			),
			array(
				'key'  => 'field_phone',
				'name' => 'ci_phone',
				'type' => 'text',
			),
		),
	),
	array(
		'key'      => 'group_service',
		'location' => array(
			array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => 'service-area',
				),
			),
		),
		'fields'   => array(
			array(
				'key'  => 'field_headline',
				'name' => 'headline',
				'type' => 'text',
			),
		),
	),
);

$sheet = array(
	'sheets' => array(
		'fields' => array(
			'groups'        => $groups,
			'options_pages' => array(
				array(
					'key'       => 'ui_options_page_contact',
					'menu_slug' => 'contact-information',
				),
			),
		),
	),
);

$GLOBALS['flowbie_test_get_field_map']['option:contact-information:ci_company_name'] = 'Heritage Dental Centre';
$GLOBALS['flowbie_test_get_field_map']['option:contact-information:ci_phone']         = '780-555-0100';
$GLOBALS['flowbie_test_get_field_map']['post:42:headline']                            = 'Downtown Edmonton';
$GLOBALS['flowbie_test_options']['options_ci_company_name']                           = 'Legacy Options Company';
$GLOBALS['flowbie_test_options']['options_ci_phone']                                  = '780-555-9999';

$slugs = Flowbie_Wp_Migrate_Source_Acf::resolve_options_page_slugs( $sheet );
assert_true( in_array( 'contact-information', $slugs, true ), 'resolve_options_page_slugs finds contact-information' );

$groups_only_sheet = array(
	'sheets' => array(
		'fields' => array(
			'groups' => $groups,
		),
	),
);
$slugs_from_groups = Flowbie_Wp_Migrate_Source_Acf::resolve_options_page_slugs( $groups_only_sheet );
assert_true( in_array( 'contact-information', $slugs_from_groups, true ), 'resolve_options_page_slugs finds slug from group location without options_pages entity' );

$collected = Flowbie_Wp_Migrate_Source_Acf::collect_options_page_slugs_from_groups( $groups );
assert_true( in_array( 'contact-information', $collected, true ), 'collect_options_page_slugs_from_groups reads location rules' );
assert_true( ! in_array( 'service-area', $collected, true ), 'collect_options_page_slugs_from_groups ignores post type groups' );

$synthesized = Flowbie_Wp_Migrate_Source_Acf::synthesize_options_pages_from_slugs(
	array( 'contact-information' ),
	array()
);
assert_true( count( $synthesized ) === 1, 'synthesize_options_pages_from_slugs creates page row' );
assert_true( ( $synthesized[0]['menu_slug'] ?? '' ) === 'contact-information', 'synthesized page keeps menu_slug' );

$option_fields = Flowbie_Wp_Migrate_Source_Acf::top_level_fields_for_options_page( $groups, 'contact-information' );
assert_true( count( $option_fields ) === 2, 'top_level_fields_for_options_page returns two fields' );

$crawled = Flowbie_Wp_Migrate_Source_Acf::crawl_field_values_for_target( $option_fields, 'contact-information' );
assert_true( ( $crawled['ci_company_name'] ?? '' ) === 'Heritage Dental Centre', 'crawl reads company name from ACF' );
assert_true( ( $crawled['ci_phone'] ?? '' ) === '780-555-0100', 'crawl reads phone from ACF' );

$legacy_field = array( 'name' => 'ci_company_name', 'type' => 'text' );
$legacy_value = Flowbie_Wp_Migrate_Source_Acf::read_acf_option_value( $legacy_field, 'contact-information' );
assert_true( $legacy_value === 'Heritage Dental Centre', 'read_acf_option_value prefers slug-specific ACF value' );

$GLOBALS['flowbie_test_get_field_map'] = array();
$legacy_only = Flowbie_Wp_Migrate_Source_Acf::read_acf_option_value( $legacy_field, 'contact-information' );
assert_true( $legacy_only === 'Legacy Options Company', 'read_acf_option_value falls back to options_ storage prefix' );

$GLOBALS['flowbie_test_get_field_map']['option:contact-information:ci_company_name'] = 'Heritage Dental Centre';
$GLOBALS['flowbie_test_get_field_map']['option:contact-information:ci_phone']         = '780-555-0100';

$apply_fields = Flowbie_Wp_Migrate_Source_Acf::fields_for_options_apply(
	array(),
	'contact-information',
	array(
		'ci_company_name' => 'Imported Co',
		'ci_phone'        => '780-555-0100',
	)
);
assert_true( count( $apply_fields ) === 2, 'fields_for_options_apply builds fields from crawled value keys' );

$GLOBALS['flowbie_test_updated_options'] = array();
$updated = Flowbie_Wp_Migrate_Source_Acf::apply_field_values_to_options(
	'contact-information',
	$option_fields,
	$crawled,
	false
);
assert_true( $updated === 2, 'apply_field_values_to_options updates two fields' );
assert_true(
	get_option( 'contact-information_ci_company_name' ) === 'Heritage Dental Centre',
	'company name stored in Flowbie options key'
);
assert_true(
	get_option( '_contact-information_ci_company_name' ) === 'field_company',
	'field key reference stored for options value'
);

$post_fields = Flowbie_Wp_Migrate_Source_Acf::top_level_fields_for_post( $groups, 42 );
assert_true( count( $post_fields ) === 1, 'top_level_fields_for_post returns one field' );

$post_values = Flowbie_Wp_Migrate_Source_Acf::crawl_field_values_for_target( $post_fields, 42 );
assert_true( ( $post_values['headline'] ?? '' ) === 'Downtown Edmonton', 'crawl reads post headline from ACF' );

$GLOBALS['flowbie_test_updated_posts'] = array();
$post_updated = Flowbie_Wp_Migrate_Source_Acf::apply_field_values_to_post( 42, $post_fields, $post_values, false );
assert_true( $post_updated === 1, 'apply_field_values_to_post updates one field' );
assert_true(
	( $GLOBALS['flowbie_test_post_meta'][42]['headline'] ?? '' ) === 'Downtown Edmonton',
	'post headline stored in post meta'
);

$adapter = new Flowbie_Wp_Migrate_Source_Acf();
$crawl_sheet = $sheet;
$crawl_result = $adapter->run_step( 'acf_crawl_options_values', 'crawl', $crawl_sheet, array() );
assert_true( ! empty( $crawl_result['ok'] ), 'acf_crawl_options_values step succeeds' );
assert_true(
	! empty( $crawl_sheet['sheets']['field_values']['options'][0]['fields']['ci_company_name'] ),
	'crawl step stores options values in flo sheet'
);

$apply_result = $adapter->run_step( 'acf_apply_options_values', 'apply', $crawl_sheet, array() );
assert_true( ! empty( $apply_result['ok'] ), 'acf_apply_options_values step succeeds' );
assert_true( (int) ( $apply_result['stats']['updated'] ?? 0 ) >= 2, 'apply step reports updated fields' );

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll tests passed.\n";
exit( $failed > 0 ? 1 : 0 );
