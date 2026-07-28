<?php
/**
 * AI widget design: Site Branding, scope, migration, visibility.
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'FLOWBIE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/flowbie-wp.php' );
define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

$GLOBALS['flowbie_test_options'] = array();
$GLOBALS['flowbie_test_post_meta'] = array();

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'esc_attr' ) ) {
	function esc_attr( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'esc_html' ) ) {
	function esc_html( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		return $GLOBALS['flowbie_test_options'][ $key ] ?? $default;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( $key, $value, $autoload = null ) {
		unset( $autoload );
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

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $str ) {
		return trim( strip_tags( (string) $str ) );
	}
}

if ( ! function_exists( 'sanitize_hex_color' ) ) {
	function sanitize_hex_color( $color ) {
		$color = trim( (string) $color );
		if ( preg_match( '/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/', $color ) ) {
			if ( strlen( $color ) === 4 ) {
				return '#' . $color[1] . $color[1] . $color[2] . $color[2] . $color[3] . $color[3];
			}
			return $color;
		}
		return null;
	}
}

if ( ! function_exists( 'wp_parse_args' ) ) {
	function wp_parse_args( $args, $defaults = array() ) {
		if ( ! is_array( $args ) ) {
			$args = array();
		}
		return array_merge( $defaults, $args );
	}
}

if ( ! function_exists( 'is_readable' ) ) {
	// native
}

if ( ! function_exists( 'add_action' ) ) {
	function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
		unset( $hook, $callback, $priority, $accepted_args );
	}
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/class-flowbie-wp-migrate-elementor-global-css.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-widget-design.php';

function flowbie_assert( $cond, $msg ) {
	if ( ! $cond ) {
		fwrite( STDERR, "FAIL: $msg\n" );
		exit( 1 );
	}
	echo "OK: $msg\n";
}

// Reset
$GLOBALS['flowbie_test_options'] = array(
	Flowbie_Wp_Ai_Widget_Design::MIGRATION_KEY => '1',
);
Flowbie_Wp_Ai_Widget_Design::clear_resolve_cache();

// ── Defaults ─────────────────────────────────────────────────
$defaults = Flowbie_Wp_Ai_Widget_Design::get_settings();
flowbie_assert( $defaults['color_source'] === 'site_branding', 'default color_source is site_branding' );
flowbie_assert( $defaults['style_scope'] === 'both', 'default style_scope is both' );
flowbie_assert( ! empty( $defaults['chat_ui']['launcher'] ), 'chat visibility defaults true' );
flowbie_assert( ! empty( $defaults['search_ui']['powered_by'] ), 'search visibility defaults true' );

// ── Color sanitize ───────────────────────────────────────────
flowbie_assert( Flowbie_Wp_Ai_Widget_Design::sanitize_color_value( '#3b82f6' ) === '#3b82f6', 'hex sanitize' );
flowbie_assert( Flowbie_Wp_Ai_Widget_Design::sanitize_color_value( 'rgba(1,2,3,0.5)' ) === 'rgba(1,2,3,0.5)', 'rgba sanitize' );
flowbie_assert( Flowbie_Wp_Ai_Widget_Design::sanitize_color_value( 'not-a-color' ) === '', 'reject junk color' );

// ── Elementor kit → palette ──────────────────────────────────
$GLOBALS['flowbie_test_options']['elementor_active_kit'] = 42;
$GLOBALS['flowbie_test_post_meta'][42]['_elementor_page_settings'] = array(
	'system_colors' => array(
		array( '_id' => 'primary', 'title' => 'Primary', 'color' => '#112233' ),
		array( '_id' => 'secondary', 'title' => 'Secondary', 'color' => '#445566' ),
		array( '_id' => 'accent', 'title' => 'Accent', 'color' => '#778899' ),
		array( '_id' => 'text', 'title' => 'Text', 'color' => '#101010' ),
	),
	'custom_colors' => array(
		array( '_id' => 'brand', 'title' => 'Brand Extra', 'color' => '#abcdef' ),
	),
);

$branded = Flowbie_Wp_Ai_Widget_Design::palette_from_elementor_kit();
flowbie_assert( ( $branded['accent'] ?? '' ) === '#112233', 'kit primary maps to accent' );
flowbie_assert( ( $branded['bg_elevated'] ?? '' ) === '#445566', 'kit secondary maps to bg_elevated' );
flowbie_assert( ( $branded['highlight'] ?? '' ) === '#778899', 'kit accent maps to highlight' );
flowbie_assert( ( $branded['text'] ?? '' ) === '#101010', 'kit text maps to text' );

$swatches = Flowbie_Wp_Ai_Widget_Design::elementor_color_swatches();
flowbie_assert( count( $swatches ) === 5, 'swatches include system + custom' );

Flowbie_Wp_Ai_Widget_Design::clear_resolve_cache();
$resolved = Flowbie_Wp_Ai_Widget_Design::resolve( 'chat' );
flowbie_assert( $resolved['accent'] === '#112233', 'resolve overlays Site Branding accent' );

// ── Custom color source ──────────────────────────────────────
Flowbie_Wp_Ai_Widget_Design::save(
	array(
		'color_source' => 'custom',
		'style_scope'  => 'both',
		'shared'       => array_merge(
			Flowbie_Wp_Ai_Widget_Design::fallback_palette(),
			array( 'accent' => '#ff0000', 'radius' => 12 )
		),
	)
);
Flowbie_Wp_Ai_Widget_Design::clear_resolve_cache();
$custom = Flowbie_Wp_Ai_Widget_Design::resolve( 'search' );
flowbie_assert( $custom['accent'] === '#ff0000', 'custom source uses stored accent' );
flowbie_assert( (int) $custom['radius'] === 12, 'custom radius preserved' );

// ── Individual scope ─────────────────────────────────────────
Flowbie_Wp_Ai_Widget_Design::save(
	array(
		'style_scope' => 'individual',
		'chat'        => array_merge( Flowbie_Wp_Ai_Widget_Design::fallback_palette(), array( 'accent' => '#00ff00' ) ),
		'search'      => array_merge( Flowbie_Wp_Ai_Widget_Design::fallback_palette(), array( 'accent' => '#0000ff' ) ),
	)
);
Flowbie_Wp_Ai_Widget_Design::clear_resolve_cache();
$chat_t   = Flowbie_Wp_Ai_Widget_Design::resolve( 'chat' );
$search_t = Flowbie_Wp_Ai_Widget_Design::resolve( 'search' );
flowbie_assert( $chat_t['accent'] === '#00ff00', 'individual chat accent' );
flowbie_assert( $search_t['accent'] === '#0000ff', 'individual search accent' );

// ── Visibility sanitize from admin post ──────────────────────
Flowbie_Wp_Ai_Widget_Design::save_from_admin_post(
	array(
		'style_scope'  => 'both',
		'color_source' => 'custom',
		'tokens'       => array( 'accent' => '#123456' ),
		'ui'           => array( 'launcher' => '1', 'powered_by' => '1' ),
	),
	'chat'
);
$after = Flowbie_Wp_Ai_Widget_Design::get_settings();
flowbie_assert( ! empty( $after['chat_ui']['launcher'] ), 'posted launcher visible' );
flowbie_assert( empty( $after['chat_ui']['mic_button'] ), 'unposted mic hidden' );

// ── CSS var builders ─────────────────────────────────────────
$chat_vars = Flowbie_Wp_Ai_Widget_Design::build_chat_css_vars( Flowbie_Wp_Ai_Widget_Design::fallback_palette() );
flowbie_assert( strpos( $chat_vars, '--fcw-accent:' ) !== false, 'chat css vars include accent' );
flowbie_assert( strpos( $chat_vars, '--fcw-powered:' ) !== false, 'chat css vars include powered' );
flowbie_assert( strpos( $chat_vars, '--fcw-icon:' ) !== false, 'chat css vars include icon' );
flowbie_assert( strpos( $chat_vars, '--fcw-button-border:' ) !== false, 'chat css vars include button-border' );
$search_vars = Flowbie_Wp_Ai_Widget_Design::build_search_css_vars( Flowbie_Wp_Ai_Widget_Design::fallback_palette() );
flowbie_assert( strpos( $search_vars, '--fbs-primary:' ) !== false, 'search css vars include primary' );
flowbie_assert( strpos( $search_vars, '--fbs-powered:' ) !== false, 'search css vars include powered' );
flowbie_assert( strpos( $search_vars, '--fbs-powered-icon:' ) !== false, 'search css vars include powered-icon' );
flowbie_assert( strpos( $search_vars, '--fbs-icon:' ) !== false, 'search css vars include icon' );
flowbie_assert( strpos( $search_vars, '--fbs-button-border:' ) !== false, 'search css vars include button-border' );
flowbie_assert( strpos( $search_vars, '--fbs-form-border:' ) !== false, 'search css vars include form-border' );
flowbie_assert( strpos( $search_vars, '--fbs-input-text:' ) !== false, 'search css vars include input-text' );

$palette = Flowbie_Wp_Ai_Widget_Design::fallback_palette();
flowbie_assert( ( $palette['powered_text'] ?? '' ) === '#64748b', 'fallback powered_text' );
flowbie_assert( ( $palette['powered_icon'] ?? '' ) === '#3b82f6', 'fallback powered_icon' );
flowbie_assert( ( $palette['icon_color'] ?? '' ) === '#3b82f6', 'fallback icon_color' );
flowbie_assert( ( $palette['button_border'] ?? '' ) === '#cbd5e1', 'fallback button_border' );
flowbie_assert( ( $palette['form_border'] ?? '' ) === '#cbd5e1', 'fallback form_border' );
flowbie_assert( ( $palette['input_text'] ?? '' ) === '#1e293b', 'fallback input_text' );
flowbie_assert( in_array( 'powered_text', Flowbie_Wp_Ai_Widget_Design::color_token_keys(), true ), 'powered_text is a color token' );

// ── Site Branding preserves part tokens ──────────────────────
Flowbie_Wp_Ai_Widget_Design::save(
	array(
		'color_source' => 'site_branding',
		'style_scope'  => 'both',
		'shared'       => array_merge(
			Flowbie_Wp_Ai_Widget_Design::fallback_palette(),
			array(
				'powered_text'  => '#abcdef',
				'powered_icon'  => '#fedcba',
				'icon_color'    => '#112233',
				'button_border' => '#445566',
				'form_border'   => '#778899',
				'input_text'    => '#101010',
			)
		),
	)
);
Flowbie_Wp_Ai_Widget_Design::clear_resolve_cache();
$brand_part = Flowbie_Wp_Ai_Widget_Design::resolve( 'search' );
flowbie_assert( $brand_part['powered_text'] === '#abcdef', 'site branding keeps powered_text from bag' );
flowbie_assert( $brand_part['powered_icon'] === '#fedcba', 'site branding keeps powered_icon from bag' );
flowbie_assert( $brand_part['icon_color'] === '#112233', 'site branding keeps icon_color from bag' );
flowbie_assert( $brand_part['button_border'] === '#445566', 'site branding keeps button_border from bag' );
flowbie_assert( $brand_part['form_border'] === '#778899', 'site branding keeps form_border from bag' );
flowbie_assert( $brand_part['input_text'] === '#101010', 'site branding keeps input_text from bag' );
flowbie_assert( $brand_part['accent'] === '#112233', 'site branding still overlays kit accent' );

// ── Legacy migration ─────────────────────────────────────────
$GLOBALS['flowbie_test_options'] = array(
	'flowbie_wp_chat_settings'   => array( 'color' => '#84BC00' ),
	'flowbie_wp_search_settings' => array(
		'primary_color' => '#3b82f6',
		'bg_color'      => '#ffffff',
		'border_radius' => 10,
		'font_size'     => 18,
	),
);
Flowbie_Wp_Ai_Widget_Design::clear_resolve_cache();
Flowbie_Wp_Ai_Widget_Design::maybe_migrate();
flowbie_assert( get_option( Flowbie_Wp_Ai_Widget_Design::MIGRATION_KEY ) === '1', 'migration flag set' );
$migrated = get_option( Flowbie_Wp_Ai_Widget_Design::OPTION_KEY );
flowbie_assert( is_array( $migrated ), 'migration wrote design option' );
flowbie_assert( ( $migrated['shared']['accent'] ?? '' ) === '#3b82f6' || ( $migrated['shared']['accent'] ?? '' ) === '#84BC00', 'migration mapped accent' );
flowbie_assert( (int) ( $migrated['shared']['radius'] ?? 0 ) === 10, 'migration mapped radius' );
flowbie_assert( (int) ( $migrated['shared']['font_size'] ?? 0 ) === 18, 'migration mapped font_size' );
flowbie_assert( ( $migrated['color_source'] ?? '' ) === 'site_branding', 'migration keeps site_branding default' );

echo "\nAll AI widget design tests passed.\n";
exit( 0 );
