<?php
/**
 * Duplicate payload and slot-id-only fill (no WordPress bootstrap).
 *
 * @package Neo_Pulse_Wp
 */

define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
define( 'ABSPATH', NEO_PULSE_WP_PLUGIN_DIR );

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = null ) {
		unset( $domain );
		return $text;
	}
}
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
if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/i', '', (string) $key ) );
	}
}
if ( ! function_exists( 'esc_url_raw' ) ) {
	function esc_url_raw( $url ) {
		return (string) $url;
	}
}
if ( ! function_exists( 'wp_kses_post' ) ) {
	function wp_kses_post( $html ) {
		return (string) $html;
	}
}
if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data ) {
		return json_encode( $data );
	}
}
if ( ! class_exists( 'WP_Error', false ) ) {
	class WP_Error {
		public $message;
		public function __construct( $code, $message ) {
			unset( $code );
			$this->message = $message;
		}
		public function get_error_message() {
			return $this->message;
		}
	}
}
if ( ! function_exists( 'is_wp_error' ) ) {
	function is_wp_error( $thing ) {
		return $thing instanceof WP_Error;
	}
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-slots.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-layout.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-mutation.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-storage.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-agent.php';

function assert_ok( $condition, $message ) {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

$source = array(
	'title'         => 'SEO Extra',
	'focus_keyword' => 'seo edmonton',
	'topic_focus'   => 'Local SEO',
	'slots'         => array(
		array(
			'type' => 'h2',
			'text' => 'Old heading',
			'_id'  => 'slot-h2',
		),
		array(
			'type' => 'paragraph',
			'html' => '<p>Old copy</p>',
			'_id'  => 'slot-p',
		),
	),
	'layout_config'   => array(),
	'primary_post_id' => 12,
);

$payload = Neo_Pulse_Wp_Seo_Blocks_Storage::duplicate_source_to_save_input( $source );
assert_ok( $payload['title'] === 'SEO Extra (Copy)', 'duplicate title appends Copy' );
assert_ok( $payload['focus_keyword'] === 'seo edmonton', 'duplicate keeps keyword' );
assert_ok( $payload['status'] === 'draft', 'duplicate is draft' );
assert_ok( count( $payload['slots'] ) === 2, 'duplicate copies slots' );
assert_ok( $payload['slots'][0]['_id'] === 'slot-h2', 'duplicate keeps slot ids' );
assert_ok( $payload['primary_post_id'] === 12, 'duplicate keeps primary post' );

$filled = Neo_Pulse_Wp_Seo_Blocks_Agent::apply_mapped_slot_updates(
	$source,
	array(
		array(
			'_id'  => 'slot-h2',
			'text' => 'Local SEO for clinics',
		),
		array(
			'_id'  => 'slot-p',
			'html' => '<p>Clinics in Edmonton.</p>',
		),
	)
);
assert_ok( ! is_wp_error( $filled ), 'mapped fill succeeds' );
assert_ok( $filled['slots'][0]['text'] === 'Local SEO for clinics', 'h2 text filled' );
assert_ok( $filled['slots'][1]['html'] === '<p>Clinics in Edmonton.</p>', 'paragraph html filled' );
assert_ok( $source['slots'][0]['text'] === 'Old heading', 'source slots not mutated' );

$unknown = Neo_Pulse_Wp_Seo_Blocks_Agent::apply_mapped_slot_updates(
	$source,
	array(
		array(
			'_id'  => 'not-on-template',
			'text' => 'Nope',
		),
	)
);
assert_ok( is_wp_error( $unknown ), 'unknown slot id fails' );

$empty = Neo_Pulse_Wp_Seo_Blocks_Agent::apply_mapped_slot_updates( $source, array() );
assert_ok( is_wp_error( $empty ), 'empty updates fail' );

fwrite( STDOUT, "OK: test-seo-block-duplicate-fill\n" );
