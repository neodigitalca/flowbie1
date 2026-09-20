<?php
/**
 * SEO block page insert helpers (no WordPress bootstrap).
 *
 * @package Neo_Pulse_Wp
 */

define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
define( 'ABSPATH', NEO_PULSE_WP_PLUGIN_DIR );

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-slots.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-layout.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-library.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-page-insert.php';

if ( ! function_exists( 'absint' ) ) {
	function absint( $value ) {
		return abs( (int) $value );
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $str ) {
		return is_string( $str ) ? trim( $str ) : '';
	}
}

if ( ! function_exists( 'sanitize_textarea_field' ) ) {
	function sanitize_textarea_field( $str ) {
		return is_string( $str ) ? trim( $str ) : '';
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data ) {
		return json_encode( $data );
	}
}

if ( ! function_exists( 'uniqid' ) ) {
	function uniqid( $prefix = '', $more_entropy = false ) {
		return $prefix . 'test';
	}
}

if ( ! function_exists( 'wp_rand' ) ) {
	function wp_rand( $min = 0, $max = 0 ) {
		return 42;
	}
}

if ( ! function_exists( 'did_action' ) ) {
	function did_action( $hook ) {
		return defined( 'ELEMENTOR_VERSION' );
	}
}

$GLOBALS['neo_pulse_test_post_meta'] = array();

if ( ! function_exists( 'get_post_meta' ) ) {
	function get_post_meta( $post_id, $key, $single = true ) {
		$value = $GLOBALS['neo_pulse_test_post_meta'][ $post_id ][ $key ] ?? '';
		return $single ? $value : array( $value );
	}
}

if ( ! function_exists( 'wp_slash' ) ) {
	function wp_slash( $value ) {
		return $value;
	}
}

if ( ! function_exists( 'update_post_meta' ) ) {
	function update_post_meta( $post_id, $key, $value ) {
		$GLOBALS['neo_pulse_test_post_meta'][ $post_id ][ $key ] = $value;
		return true;
	}
}
if ( ! function_exists( 'delete_post_meta' ) ) {
	function delete_post_meta( $post_id, $key ) {
		unset( $GLOBALS['neo_pulse_test_post_meta'][ $post_id ][ $key ] );
		return true;
	}
}

if ( ! defined( 'ELEMENTOR_VERSION' ) ) {
	define( 'ELEMENTOR_VERSION', '3.0.0' );
}

function assert_ok( $condition, $message ) {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

if ( ! class_exists( 'Neo_Pulse_Wp_Seo_Blocks_Elementor_Widget', false ) ) {
	class Neo_Pulse_Wp_Seo_Blocks_Elementor_Widget {
		public static function layout_to_json( array $layout ): string {
			$json = wp_json_encode( $layout );
			return is_string( $json ) ? $json : '{}';
		}
	}
}

$row = array(
	'id'            => 7,
	'title'         => 'Test Block',
	'focus_keyword' => 'window treatments',
	'topic_focus'   => 'Edmonton',
	'slots'         => array(
		array(
			'type'    => 'h2',
			'content' => 'Types',
			'_id'     => 'slot1',
		),
	),
	'layout_config' => array(),
);

$settings = Neo_Pulse_Wp_Seo_Blocks_Page_Insert::registry_widget_settings( $row );
assert_ok( (string) $settings['registry_block_id'] === '7', 'registry_block_id set' );
assert_ok( empty( $settings['content_slots'] ), 'registry-only has empty inline slots' );

$elements = Neo_Pulse_Wp_Seo_Blocks_Library::build_section_elements( $settings );
assert_ok( ! empty( $elements[0]['elements'] ), 'section has column children' );
$widget = $elements[0]['elements'][0]['elements'][0] ?? array();
assert_ok( ( $widget['widgetType'] ?? '' ) === 'neo-pulse_seo_section', 'widget type is neo-pulse_seo_section' );
assert_ok( (string) ( $widget['settings']['registry_block_id'] ?? '' ) === '7', 'widget registry_block_id' );

Neo_Pulse_Wp_Seo_Blocks_Page_Insert::after_write_elementor_data( 99 );
assert_ok( ( $GLOBALS['neo_pulse_test_post_meta'][99]['_elementor_version'] ?? '' ) === ELEMENTOR_VERSION, 'sets elementor version' );
assert_ok( ( $GLOBALS['neo_pulse_test_post_meta'][99]['_elementor_template_type'] ?? '' ) === 'wp-page', 'sets wp-page template type' );
assert_ok( ! isset( $GLOBALS['neo_pulse_test_post_meta'][99]['_elementor_css'] ), 'clears elementor css meta' );

Neo_Pulse_Wp_Seo_Blocks_Page_Insert::ensure_elementor_page( 88 );
assert_ok( ( $GLOBALS['neo_pulse_test_post_meta'][88]['_elementor_edit_mode'] ?? '' ) === 'builder', 'ensure_elementor_page sets builder mode' );
assert_ok( ( $GLOBALS['neo_pulse_test_post_meta'][88]['_elementor_data'] ?? '' ) === '[]', 'ensure_elementor_page writes empty elementor data' );

$insert_src = file_get_contents( NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-page-insert.php' );
assert_ok( is_string( $insert_src ) && ! str_contains( $insert_src, 'can_apply' ), 'insert has no can_apply gate' );

fwrite( STDOUT, "OK: test-seo-blocks-page-insert\n" );
