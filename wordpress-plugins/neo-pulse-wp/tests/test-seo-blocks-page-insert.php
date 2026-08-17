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

if ( ! defined( 'ELEMENTOR_VERSION' ) ) {
	define( 'ELEMENTOR_VERSION', '3.0.0' );
}

function assert( $condition, $message ) {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
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
assert( (string) $settings['registry_block_id'] === '7', 'registry_block_id set' );
assert( empty( $settings['content_slots'] ), 'registry-only has empty inline slots' );

$elements = Neo_Pulse_Wp_Seo_Blocks_Library::build_section_elements( $settings );
assert( ! empty( $elements[0]['elements'] ), 'section has column children' );
$widget = $elements[0]['elements'][0]['elements'][0] ?? array();
assert( ( $widget['widgetType'] ?? '' ) === 'neo-pulse_seo_section', 'widget type is neo-pulse_seo_section' );
assert( (string) ( $widget['settings']['registry_block_id'] ?? '' ) === '7', 'widget registry_block_id' );

fwrite( STDOUT, "OK: test-seo-blocks-page-insert\n" );
