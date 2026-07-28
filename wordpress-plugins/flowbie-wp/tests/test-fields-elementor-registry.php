<?php
/**
 * Elementor registry unified field picker tests.
 *
 * Run: php tests/test-fields-elementor-registry.php
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'FLOWBIE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/flowbie-wp.php' );
define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

$flowbie_test_options = array();

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'esc_html__' ) ) {
	function esc_html__( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'wp_parse_args' ) ) {
	/**
	 * @param array<string, mixed> $args     Args.
	 * @param array<string, mixed> $defaults Defaults.
	 * @return array<string, mixed>
	 */
	function wp_parse_args( $args, $defaults = array() ) {
		if ( ! is_array( $args ) ) {
			return $defaults;
		}
		return array_merge( $defaults, $args );
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		global $flowbie_test_options;
		return array_key_exists( $key, $flowbie_test_options ) ? $flowbie_test_options[ $key ] : $default;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( $key, $value ) {
		global $flowbie_test_options;
		$flowbie_test_options[ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'add_option' ) ) {
	function add_option( $key, $value ) {
		global $flowbie_test_options;
		if ( array_key_exists( $key, $flowbie_test_options ) ) {
			return false;
		}
		$flowbie_test_options[ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! function_exists( 'apply_filters' ) ) {
	function apply_filters( $hook, $value ) {
		unset( $hook );
		return $value;
	}
}

if ( ! function_exists( 'get_post_type_object' ) ) {
	function get_post_type_object( $post_type ) {
		unset( $post_type );
		return null;
	}
}

class Flowbie_Wp_Fields_Storage {
	public static function get_entities( string $cpt ): array {
		unset( $cpt );
		return array(
			array(
				'menu_slug'  => 'company',
				'page_title' => 'Company Info',
			),
		);
	}

	public static function get_all_groups( bool $published_only = true ): array {
		unset( $published_only );
		return array(
			array(
				'key'      => 'group_page',
				'title'    => 'Page SEO',
				'location' => array(
					array(
						array(
							'param'    => 'post_type',
							'operator' => '==',
							'value'    => 'page',
						),
					),
				),
				'fields'   => array(
					array(
						'name'  => 'headline',
						'label' => 'Headline',
						'type'  => 'text',
					),
				),
			),
			array(
				'key'      => 'group_service',
				'title'    => 'Service Area',
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
						'name'  => 'headline',
						'label' => 'SA Headline',
						'type'  => 'text',
					),
					array(
						'name'  => 'city',
						'label' => 'City',
						'type'  => 'text',
					),
				),
			),
			array(
				'key'      => 'group_company',
				'title'    => 'Company',
				'location' => array(
					array(
						array(
							'param'    => 'options_page',
							'operator' => '==',
							'value'    => 'company',
						),
					),
				),
				'fields'   => array(
					array(
						'name'  => 'phone',
						'label' => 'Phone',
						'type'  => 'text',
					),
				),
			),
		);
	}
}

class Flowbie_Wp_Fields_Location {
	/**
	 * @param array<string, mixed> $group Field group.
	 */
	public static function summarize( array $group ): string {
		$location = isset( $group['location'] ) && is_array( $group['location'] ) ? $group['location'] : array();
		foreach ( $location as $rule_group ) {
			if ( ! is_array( $rule_group ) ) {
				continue;
			}
			foreach ( $rule_group as $rule ) {
				if ( ! is_array( $rule ) ) {
					continue;
				}
				if ( (string) ( $rule['param'] ?? '' ) === 'post_type' ) {
					return (string) ( $rule['value'] ?? '' );
				}
				if ( (string) ( $rule['param'] ?? '' ) === 'options_page' ) {
					return 'options:' . (string) ( $rule['value'] ?? '' );
				}
			}
		}
		return '';
	}

	public static function matches_group( array $group, array $screen ): bool {
		unset( $group, $screen );
		return true;
	}
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-settings.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-registry.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';

$failed = 0;

/**
 * @param bool   $cond Condition.
 * @param string $msg  Message.
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

$parsed_options = Flowbie_Wp_Fields_Elementor_Registry::parse_field_key( 'company::phone' );
assert_true( $parsed_options['field_name'] === 'phone', 'parse options composite key' );
assert_true( $parsed_options['options_slug'] === 'company', 'parse options slug' );

$parsed_post = Flowbie_Wp_Fields_Elementor_Registry::parse_field_key( 'post:service-area:city' );
assert_true( $parsed_post['field_name'] === 'city', 'parse post composite field name' );
assert_true( $parsed_post['post_type'] === 'service-area', 'parse post composite post type' );

$resolved = Flowbie_Wp_Fields_Elementor_Acf_Resolver::resolve_any_key( 'company::phone' );
assert_true( is_array( $resolved ) && $resolved['field_name'] === 'phone', 'resolver handles options composite' );
assert_true( ! empty( $resolved['options_slug'] ) && $resolved['options_slug'] === 'company', 'resolver options slug' );

$resolved_post = Flowbie_Wp_Fields_Elementor_Acf_Resolver::resolve_any_key( 'post:page:headline' );
assert_true( is_array( $resolved_post ) && $resolved_post['field_name'] === 'headline', 'resolver handles post composite' );

$flowbie_test_options[ Flowbie_Wp_Fields_Elementor_Settings::OPTION_KEY ] = array(
	'field_picker_scope' => 'all',
);

$choices = Flowbie_Wp_Fields_Elementor_Registry::get_unified_field_choices( array( 'text' ) );
assert_true( isset( $choices['company::phone'] ), 'unified choices include options field' );
assert_true( isset( $choices['post:page:headline'] ) || isset( $choices['headline'] ), 'unified choices include page field' );
assert_true( isset( $choices['post:service-area:headline'] ), 'unified choices disambiguate duplicate names' );
assert_true( isset( $choices['city'] ) || isset( $choices['post:service-area:city'] ), 'unified choices include service area field' );

$defaults = Flowbie_Wp_Fields_Elementor_Settings::default_config();
assert_true( ( $defaults['field_picker_scope'] ?? '' ) === 'all', 'default picker scope is all' );
assert_true( Flowbie_Wp_Fields_Elementor_Settings::use_unified_field_picker(), 'use_unified_field_picker true by default' );

exit( $failed > 0 ? 1 : 0 );
