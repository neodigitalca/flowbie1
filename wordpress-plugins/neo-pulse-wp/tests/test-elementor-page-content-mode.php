<?php
/**
 * Elementor page content mode helpers.
 *
 * @package Neo_Pulse_Wp
 */

define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
define( 'ABSPATH', NEO_PULSE_WP_PLUGIN_DIR );

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-context.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-pipeline-content-prep.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-tools-elementor-sections.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-workflow-expand.php';

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $str ) {
		return is_string( $str ) ? trim( $str ) : '';
	}
}

if ( ! function_exists( 'wp_kses_post' ) ) {
	function wp_kses_post( $data ) {
		return is_string( $data ) ? $data : '';
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return is_string( $key ) ? strtolower( preg_replace( '/[^a-z0-9_\-]/', '', $key ) ) : '';
	}
}

function assert_ok( $cond, $msg ) {
	if ( ! $cond ) {
		fwrite( STDERR, "FAIL: {$msg}\n" );
		exit( 1 );
	}
}

$normalized = Neo_Pulse_Wp_Backend_Assist_Tools_Elementor_Sections::normalize_sections(
	array(
		array(
			'h2'        => 'Hero',
			'body_html' => '<p>Body</p>',
			'bullets'   => array( 'One', 'Two' ),
			'cta'       => 'Contact us',
		),
		array(
			'h2' => '',
		),
	)
);
assert_ok( count( $normalized ) === 1 && $normalized[0]['h2'] === 'Hero', 'normalize sections' );

$merged = Neo_Pulse_Wp_Backend_Assist_Tools_Elementor_Sections::merge_sections(
	array( array( 'h2' => 'A', 'body_html' => '<p>a</p>' ) ),
	array( array( 'h2' => 'B', 'body_html' => '<p>b</p>' ) )
);
assert_ok( count( $merged ) === 2, 'merge sections' );

Neo_Pulse_Wp_Backend_Assist_Context::$builder_context = array( 'page_content_mode' => 'elementor_widgets' );
assert_ok(
	Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::page_content_mode_from_context() === 'elementor_widgets',
	'context elementor mode'
);
Neo_Pulse_Wp_Backend_Assist_Context::$builder_context = null;
assert_ok(
	Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::page_content_mode_from_context() === 'seo_blocks',
	'context default seo blocks'
);

Neo_Pulse_Wp_Backend_Assist_Context::$builder_context = array( 'page_content_mode' => 'elementor_widgets' );
$expanded = Neo_Pulse_Wp_Backend_Assist_Workflow_Expand::expand_create_to_full_page(
	array(
		'workflow' => false,
		'steps'    => array(),
	),
	'Create a page for window treatments edmonton',
	array(
		'tool'   => 'create_page',
		'params' => array(
			'title'         => 'Window treatments Edmonton',
			'focus_keyword' => 'window treatments edmonton',
		),
	)
);
Neo_Pulse_Wp_Backend_Assist_Context::$builder_context = null;

$tools = array();
foreach ( (array) ( $expanded['steps'] ?? array() ) as $step ) {
	if ( is_array( $step ) && ! empty( $step['tool'] ) ) {
		$tools[] = (string) $step['tool'];
	}
}
assert_ok( in_array( 'compose_elementor_page_sections', $tools, true ), 'expand includes compose_elementor' );
assert_ok( ! in_array( 'save_seo_block', $tools, true ), 'expand skips save_seo_block in elementor mode' );
assert_ok( in_array( 'design_page_with_novamira', $tools, true ), 'expand includes design' );

echo "OK elementor-page-content-mode tests\n";
