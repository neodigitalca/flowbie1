<?php
/**
 * SEO block context helpers (no WordPress bootstrap).
 *
 * @package Flowbie_Wp
 */

define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
define( 'ABSPATH', FLOWBIE_WP_PLUGIN_DIR );

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-slots.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-layout.php';

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
		return is_string( $key ) ? strtolower( preg_replace( '/[^a-z0-9_\-]/', '', $key ) ) : '';
	}
}

if ( ! function_exists( 'esc_url_raw' ) ) {
	function esc_url_raw( $url ) {
		return is_string( $url ) ? $url : '';
	}
}

if ( ! function_exists( 'wp_kses_post' ) ) {
	function wp_kses_post( $data ) {
		return is_string( $data ) ? $data : '';
	}
}

if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	function wp_strip_all_tags( $string ) {
		return is_string( $string ) ? strip_tags( $string ) : '';
	}
}

class Flowbie_Wp_Seo_Blocks_Storage {
	public static function get( int $id ): ?array {
		unset( $id );
		return null;
	}

	public static function first_h2( array $slots ): string {
		foreach ( $slots as $slot ) {
			if ( ( $slot['type'] ?? '' ) === 'h2' && ! empty( $slot['text'] ) ) {
				return (string) $slot['text'];
			}
		}
		return '';
	}
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-context.php';

// resolve_primary_post_id: request wins.
assert(
	Flowbie_Wp_Seo_Blocks_Context::resolve_primary_post_id( 42, 0, null ) === 42,
	'request post id used'
);

// resolve_primary_post_id: block_row fallback.
assert(
	Flowbie_Wp_Seo_Blocks_Context::resolve_primary_post_id( 0, 0, array( 'primary_post_id' => 99 ) ) === 99,
	'block_row primary_post_id used'
);

// collect_body_text_from_elements: heading + text-editor.
$elements = array(
	array(
		'elType'     => 'widget',
		'widgetType' => 'heading',
		'settings'   => array( 'title' => 'Thank You' ),
	),
	array(
		'elType'     => 'widget',
		'widgetType' => 'text-editor',
		'settings'   => array( 'editor' => '<p>We appreciate your business.</p>' ),
	),
);
$body = Flowbie_Wp_Seo_Blocks_Context::collect_body_text_from_elements( $elements );
assert( strpos( $body, 'Thank You' ) !== false, 'heading text in body' );
assert( strpos( $body, 'appreciate your business' ) !== false, 'editor text in body' );

// format_for_prompt includes page body section.
$prompt = Flowbie_Wp_Seo_Blocks_Context::format_for_prompt(
	array(
		'postId'       => 1,
		'pageTitle'    => 'Thank You',
		'pageBodyText' => 'We appreciate your business.',
	)
);
assert( strpos( $prompt, 'Page body (for intent alignment):' ) !== false, 'prompt includes page body label' );
assert( strpos( $prompt, 'appreciate your business' ) !== false, 'prompt includes body text' );

echo "OK seo-blocks-context tests\n";
