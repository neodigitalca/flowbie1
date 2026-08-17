<?php
/**
 * Elementor global CSS migration mapper tests.
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

$GLOBALS['neo-pulse_test_options'] = array();
$GLOBALS['neo-pulse_test_post_meta'] = array();
$GLOBALS['neo-pulse_test_updated_options'] = array();

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		return $GLOBALS['neo-pulse_test_options'][ $key ] ?? $default;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( $key, $value ) {
		$GLOBALS['neo-pulse_test_options'][ $key ] = $value;
		$GLOBALS['neo-pulse_test_updated_options'][ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'get_post_meta' ) ) {
	function get_post_meta( $post_id, $key, $single = false ) {
		unset( $single );
		return $GLOBALS['neo-pulse_test_post_meta'][ $post_id ][ $key ] ?? '';
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $text ) {
		return trim( (string) $text );
	}
}

if ( ! function_exists( 'sanitize_hex_color' ) ) {
	function sanitize_hex_color( $color ) {
		$color = trim( (string) $color );
		if ( preg_match( '|^#([A-Fa-f0-9]{3}){1,2}$|', $color ) ) {
			return $color;
		}
		return '';
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data ) {
		return json_encode( $data );
	}
}

if ( ! function_exists( 'sanitize_title' ) ) {
	function sanitize_title( $title ) {
		return strtolower( preg_replace( '/[^a-z0-9_-]+/', '-', (string) $title ) );
	}
}

if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	function wp_strip_all_tags( $text ) {
		return strip_tags( (string) $text );
	}
}

if ( ! class_exists( 'Neo_Pulse_Wp_Fields_Storage', false ) ) {
	class Neo_Pulse_Wp_Fields_Storage {
		const CPT_OPTIONS = 'neo-pulse-options-page';
		public static function get_entities( $cpt ) {
			unset( $cpt );
			return array(
				array(
					'menu_slug'  => 'global-css',
					'page_title' => 'Global CSS',
				),
			);
		}
		public static function get_all_groups( $active_only = false ) {
			unset( $active_only );
			return array(
				array(
					'location' => array(
						array(
							array(
								'param'    => 'options_page',
								'operator' => '==',
								'value'    => 'global-css',
							),
						),
					),
					'fields'   => array(
						array( 'name' => 'gc_enabled', 'type' => 'true_false', 'key' => 'field_gc_enabled' ),
						array( 'name' => 'gc_color_primary', 'type' => 'color_picker', 'key' => 'field_gc_color_primary' ),
						array( 'name' => 'gc_color_secondary', 'type' => 'color_picker', 'key' => 'field_gc_color_secondary' ),
						array( 'name' => 'gc_color_accent', 'type' => 'color_picker', 'key' => 'field_gc_color_accent' ),
						array( 'name' => 'gc_color_text', 'type' => 'color_picker', 'key' => 'field_gc_color_text' ),
						array( 'name' => 'gc_custom_colors', 'type' => 'repeater', 'key' => 'field_gc_custom_colors' ),
						array( 'name' => 'gc_body_font_family', 'type' => 'text', 'key' => 'field_gc_body_font_family' ),
						array( 'name' => 'gc_custom_css', 'type' => 'textarea', 'key' => 'field_gc_custom_css' ),
						array( 'name' => 'gc_elementor_tokens_json', 'type' => 'textarea', 'key' => 'field_gc_elementor_tokens_json' ),
					),
				),
			);
		}
	}
}

if ( ! class_exists( 'Neo_Pulse_Wp_Fields_Location', false ) ) {
	class Neo_Pulse_Wp_Fields_Location {
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

if ( ! class_exists( 'Neo_Pulse_Wp_Fields_Registry', false ) ) {
	class Neo_Pulse_Wp_Fields_Registry {
		public static function load_value( $raw, array $field, int $post_id ) {
			unset( $field, $post_id );
			return $raw;
		}
		public static function format_value( $loaded, array $field, int $post_id ) {
			unset( $field, $post_id );
			return $loaded;
		}
		public static function update_value( $value, array $field, int $post_id ) {
			unset( $field, $post_id );
			return $value;
		}
	}
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-values.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-global-css.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/class-neo-pulse-wp-migrate-elementor-global-css.php';

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

$GLOBALS['neo-pulse_test_options']['elementor_active_kit'] = 99;
$GLOBALS['neo-pulse_test_post_meta'][99]['_elementor_page_settings'] = array(
	'system_colors' => array(
		array( '_id' => 'primary', 'title' => 'Primary', 'color' => '#112233' ),
		array( '_id' => 'secondary', 'title' => 'Secondary', 'color' => '#445566' ),
		array( '_id' => 'accent', 'title' => 'Accent', 'color' => '#778899' ),
		array( '_id' => 'text', 'title' => 'Text', 'color' => '#101010' ),
	),
	'custom_colors' => array(
		array( '_id' => 'brand', 'title' => 'Brand', 'color' => '#ABCDEF' ),
	),
	'system_typography' => array(
		array(
			'_id'                    => 'primary',
			'title'                  => 'Primary',
			'typography_typography'  => 'custom',
			'typography_font_family' => 'Roboto',
			'typography_font_size'   => array( 'size' => 16, 'unit' => 'px' ),
			'typography_font_weight' => '400',
		),
		array(
			'_id'                    => 'h1',
			'title'                  => 'H1',
			'typography_typography'  => 'custom',
			'typography_font_family' => 'Merriweather',
			'typography_font_size'   => array( 'size' => 42, 'unit' => 'px' ),
		),
	),
	'custom_css' => '.site-header { color: red; }',
);

$settings = Neo_Pulse_Wp_Migrate_Elementor_Global_Css::read_kit_settings();
$mapped   = Neo_Pulse_Wp_Migrate_Elementor_Global_Css::map_from_elementor( $settings );

assert_true( ( $mapped['gc_color_primary'] ?? '' ) === '#112233', 'maps primary color' );
assert_true( ( $mapped['gc_body_font_family'] ?? '' ) === 'Roboto', 'maps body font family from primary typography token' );
assert_true( ( $mapped['gc_h1_font_family'] ?? '' ) === 'Merriweather', 'maps h1 font family' );
assert_true( strpos( (string) ( $mapped['gc_custom_css'] ?? '' ), '.site-header' ) !== false, 'maps custom css' );
assert_true( ! empty( $mapped['gc_enabled'] ), 'mapper enables output' );

$merged = Neo_Pulse_Wp_Migrate_Elementor_Global_Css::merge_non_empty(
	array(
		'gc_color_primary' => '#FFFFFF',
	),
	array(
		'gc_color_primary' => '',
	)
);
assert_true( ( $merged['gc_color_primary'] ?? '' ) === '#FFFFFF', 'merge preserves existing primary when elementor value empty' );

$merged_overlay = Neo_Pulse_Wp_Migrate_Elementor_Global_Css::merge_non_empty(
	array(
		'gc_color_primary' => '#FFFFFF',
	),
	array(
		'gc_color_primary' => '#112233',
	)
);
assert_true( ( $merged_overlay['gc_color_primary'] ?? '' ) === '#112233', 'merge overlays elementor primary when present' );

$GLOBALS['neo-pulse_test_options']['rank-math-options-titles'] = array();
$apply = Neo_Pulse_Wp_Migrate_Elementor_Global_Css::apply( false );
assert_true( ! empty( $apply['ok'] ), 'apply writes global css values' );
assert_true( isset( $GLOBALS['neo-pulse_test_updated_options']['global-css_gc_color_primary'] ), 'apply updates primary option' );
assert_true( ! empty( $GLOBALS['neo-pulse_test_updated_options']['global-css_gc_enabled'] ), 'apply enables global css' );

$css = Neo_Pulse_Wp_Global_Css::build_frontend_css();
assert_true( strpos( $css, '--neo-pulse-color-primary' ) !== false, 'frontend css includes color variables' );
assert_true( strpos( $css, 'body{' ) !== false, 'frontend css includes body typography' );

exit( $failed > 0 ? 1 : 0 );
