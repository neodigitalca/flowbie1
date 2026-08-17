<?php
/**
 * AI widget design: Site Branding, scope, migration, visibility.
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

$GLOBALS['neo-pulse_test_options'] = array();
$GLOBALS['neo-pulse_test_post_meta'] = array();

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
		return $GLOBALS['neo-pulse_test_options'][ $key ] ?? $default;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( $key, $value, $autoload = null ) {
		unset( $autoload );
		$GLOBALS['neo-pulse_test_options'][ $key ] = $value;
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

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/class-neo-pulse-wp-migrate-elementor-global-css.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/search/class-neo-pulse-wp-search-icons.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-widget-design.php';

function neo_pulse_assert( $cond, $msg ) {
	if ( ! $cond ) {
		fwrite( STDERR, "FAIL: $msg\n" );
		exit( 1 );
	}
	echo "OK: $msg\n";
}

// Reset
$GLOBALS['neo-pulse_test_options'] = array(
	Neo_Pulse_Wp_Ai_Widget_Design::MIGRATION_KEY => '1',
);
Neo_Pulse_Wp_Ai_Widget_Design::clear_resolve_cache();

// ── Defaults ─────────────────────────────────────────────────
$defaults = Neo_Pulse_Wp_Ai_Widget_Design::get_settings();
neo-pulse_assert( $defaults['color_source'] === 'site_branding', 'default color_source is site_branding' );
neo-pulse_assert( $defaults['style_scope'] === 'both', 'default style_scope is both' );
neo-pulse_assert( ! empty( $defaults['chat_ui']['header'] ), 'chat visibility defaults true' );
neo-pulse_assert( ! empty( $defaults['search_ui']['powered_by'] ), 'search visibility defaults true' );

// ── Color sanitize ───────────────────────────────────────────
neo-pulse_assert( Neo_Pulse_Wp_Ai_Widget_Design::sanitize_color_value( '#3b82f6' ) === '#3b82f6', 'hex sanitize' );
neo-pulse_assert( Neo_Pulse_Wp_Ai_Widget_Design::sanitize_color_value( 'rgba(1,2,3,0.5)' ) === 'rgba(1,2,3,0.5)', 'rgba sanitize' );
neo-pulse_assert( Neo_Pulse_Wp_Ai_Widget_Design::sanitize_color_value( 'not-a-color' ) === '', 'reject junk color' );

// ── Elementor kit → palette ──────────────────────────────────
$GLOBALS['neo-pulse_test_options']['elementor_active_kit'] = 42;
$GLOBALS['neo-pulse_test_post_meta'][42]['_elementor_page_settings'] = array(
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

$branded = Neo_Pulse_Wp_Ai_Widget_Design::palette_from_elementor_kit();
neo-pulse_assert( ( $branded['accent'] ?? '' ) === '#112233', 'kit primary maps to accent' );
neo-pulse_assert( ( $branded['bg_elevated'] ?? '' ) === '#445566', 'kit secondary maps to bg_elevated' );
neo-pulse_assert( ( $branded['highlight'] ?? '' ) === '#778899', 'kit accent maps to highlight' );
neo-pulse_assert( ( $branded['text'] ?? '' ) === '#101010', 'kit text maps to text' );

$swatches = Neo_Pulse_Wp_Ai_Widget_Design::elementor_color_swatches();
neo-pulse_assert( count( $swatches ) === 5, 'swatches include system + custom' );

Neo_Pulse_Wp_Ai_Widget_Design::clear_resolve_cache();
$resolved = Neo_Pulse_Wp_Ai_Widget_Design::resolve( 'chat' );
neo-pulse_assert( $resolved['accent'] === '#112233', 'resolve overlays Site Branding accent' );

// ── Custom color source ──────────────────────────────────────
Neo_Pulse_Wp_Ai_Widget_Design::save(
	array(
		'color_source' => 'custom',
		'style_scope'  => 'both',
		'shared'       => array_merge(
			Neo_Pulse_Wp_Ai_Widget_Design::fallback_palette(),
			array( 'accent' => '#ff0000', 'radius' => 12 )
		),
	)
);
Neo_Pulse_Wp_Ai_Widget_Design::clear_resolve_cache();
$custom = Neo_Pulse_Wp_Ai_Widget_Design::resolve( 'search' );
neo-pulse_assert( $custom['accent'] === '#ff0000', 'custom source uses stored accent' );
neo-pulse_assert( (int) $custom['radius'] === 12, 'custom radius preserved' );

// ── Individual scope ─────────────────────────────────────────
Neo_Pulse_Wp_Ai_Widget_Design::save(
	array(
		'style_scope' => 'individual',
		'chat'        => array_merge( Neo_Pulse_Wp_Ai_Widget_Design::fallback_palette(), array( 'accent' => '#00ff00' ) ),
		'search'      => array_merge( Neo_Pulse_Wp_Ai_Widget_Design::fallback_palette(), array( 'accent' => '#0000ff' ) ),
	)
);
Neo_Pulse_Wp_Ai_Widget_Design::clear_resolve_cache();
$chat_t   = Neo_Pulse_Wp_Ai_Widget_Design::resolve( 'chat' );
$search_t = Neo_Pulse_Wp_Ai_Widget_Design::resolve( 'search' );
neo-pulse_assert( $chat_t['accent'] === '#00ff00', 'individual chat accent' );
neo-pulse_assert( $search_t['accent'] === '#0000ff', 'individual search accent' );

// ── Visibility sanitize from admin post ──────────────────────
Neo_Pulse_Wp_Ai_Widget_Design::save_from_admin_post(
	array(
		'style_scope'  => 'both',
		'color_source' => 'custom',
		'tokens'       => array( 'accent' => '#123456' ),
		'ui'           => array( 'header' => '1', 'powered_by' => '1' ),
	),
	'chat'
);
$after = Neo_Pulse_Wp_Ai_Widget_Design::get_settings();
neo-pulse_assert( ! empty( $after['chat_ui']['header'] ), 'posted header visible' );
neo-pulse_assert( empty( $after['chat_ui']['mic_button'] ), 'unposted mic hidden' );

// ── Sidebar config sanitize ───────────────────────────────────
$search_sidebar = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array(
		'display_mode'       => 'sidebar',
		'sidebar_side'       => 'left',
		'sidebar_transition' => 'fade',
		'sidebar_width'      => 420,
		'sidebar_heading'    => 'Search KWB',
		'sidebar_layout'     => array( 'heading', 'search', 'results' ),
	),
	'search'
);
neo-pulse_assert( $search_sidebar['display_mode'] === 'sidebar', 'search sidebar display mode' );
neo-pulse_assert( $search_sidebar['sidebar_side'] === 'left', 'search sidebar side' );
neo-pulse_assert( $search_sidebar['sidebar_transition'] === 'fade', 'search sidebar transition' );
neo-pulse_assert( (int) $search_sidebar['sidebar_width'] === 420, 'search sidebar width' );
neo-pulse_assert( $search_sidebar['sidebar_heading'] === 'Search KWB', 'search sidebar heading' );

$discovery_sidebar = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array(
		'panel_layout'           => 'discovery',
		'sidebar_subtitle'       => 'Looking for financial advice?',
	'panel_offset_top'       => 20,
	'panel_offset_top_unit'  => 'vh',
		'sidebar_layout'         => array( 'heading', 'search', 'popular_terms', 'popular_pages_overseer', 'popular_topics', 'results' ),
	),
	'search'
);
neo-pulse_assert( $discovery_sidebar['panel_layout'] === 'discovery', 'panel_layout discovery' );
neo-pulse_assert( $discovery_sidebar['sidebar_subtitle'] === 'Looking for financial advice?', 'sidebar_subtitle sanitize' );
neo-pulse_assert( (int) $discovery_sidebar['panel_offset_top'] === 20, 'panel_offset_top default' );
neo-pulse_assert( $discovery_sidebar['panel_offset_top_unit'] === 'vh', 'panel_offset_top_unit default' );
neo-pulse_assert( in_array( 'popular_topics', $discovery_sidebar['sidebar_layout'], true ), 'sidebar layout accepts popular_topics' );

$offset_px = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array( 'panel_offset_top' => 999, 'panel_offset_top_unit' => 'px' ),
	'search'
);
neo-pulse_assert( (int) $offset_px['panel_offset_top'] === 400, 'panel_offset_top px clamp' );

$default_offset = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array( 'display_mode' => 'sidebar' ),
	'search'
);
neo-pulse_assert( (int) $default_offset['panel_offset_top'] === 64, 'panel_offset_top default 64' );
neo-pulse_assert( $default_offset['panel_offset_top_unit'] === 'px', 'panel_offset_top_unit default px' );
neo-pulse_assert( $default_offset['panel_content_align'] === 'left', 'panel_content_align default left' );

$align_center = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array( 'panel_content_align' => 'center' ),
	'search'
);
neo-pulse_assert( $align_center['panel_content_align'] === 'center', 'panel_content_align center' );

$align_invalid = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array( 'panel_content_align' => 'right' ),
	'search'
);
neo-pulse_assert( $align_invalid['panel_content_align'] === 'left', 'panel_content_align invalid to left' );

$backdrop_sidebar = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array( 'backdrop_opacity' => 150 ),
	'search'
);
neo-pulse_assert( (int) $backdrop_sidebar['backdrop_opacity'] === 100, 'backdrop_opacity clamp' );
neo-pulse_assert( strpos( Neo_Pulse_Wp_Ai_Widget_Design::build_sidebar_css_vars( $backdrop_sidebar ), '--fbs-backdrop-opacity:100%' ) !== false, 'sidebar css vars include backdrop opacity' );

$sidebar_css = Neo_Pulse_Wp_Ai_Widget_Design::build_sidebar_css_vars( $discovery_sidebar );
neo-pulse_assert( strpos( $sidebar_css, '--fbs-panel-offset-top:20vh' ) !== false, 'sidebar css vars include panel offset' );

$icon_sidebar = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array(
		'display_mode'    => 'icon_only',
		'launcher_icon'   => 'sparkles',
		'icon_open_as'    => 'modal_center',
		'modal_max_width' => 600,
		'launcher_label'  => 'Find answers',
	),
	'search'
);
neo-pulse_assert( $icon_sidebar['display_mode'] === 'icon_only', 'icon_only display mode' );
neo-pulse_assert( $icon_sidebar['launcher_icon'] === 'sparkles', 'launcher icon slug' );
neo-pulse_assert( $icon_sidebar['icon_open_as'] === 'modal_center', 'icon open as modal' );
neo-pulse_assert( (int) $icon_sidebar['modal_max_width'] === 600, 'modal max width' );
neo-pulse_assert( $icon_sidebar['launcher_label'] === 'Find answers', 'launcher label' );

$icon_left = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array( 'display_mode' => 'icon_only', 'icon_open_as' => 'sidebar_left' ),
	'search'
);
neo-pulse_assert( $icon_left['sidebar_side'] === 'left', 'icon sidebar left sets side' );

foreach ( Neo_Pulse_Wp_Search_Icons::ids() as $icon_id ) {
	$svg = Neo_Pulse_Wp_Search_Icons::render( $icon_id );
	neo-pulse_assert( strpos( $svg, '<svg' ) !== false, 'icon renders svg: ' . $icon_id );
}
neo-pulse_assert( Neo_Pulse_Wp_Search_Icons::sanitize_id( 'invalid' ) === 'search', 'invalid icon falls back to search' );

$insights_layout = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array(
		'sidebar_layout' => array( 'heading', 'search', 'popular_terms', 'popular_pages_overseer', 'popular_pages_search', 'results' ),
	),
	'search'
);
neo-pulse_assert( in_array( 'popular_terms', $insights_layout['sidebar_layout'], true ), 'sidebar layout accepts popular_terms' );
neo-pulse_assert( ! in_array( 'popular_pages_overseer', $insights_layout['sidebar_layout'], true ), 'sidebar layout strips popular_pages_overseer' );
neo-pulse_assert( ! in_array( 'popular_pages_search', $insights_layout['sidebar_layout'], true ), 'sidebar layout strips popular_pages_search' );

$insights = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_search_insights_config(
	array(
		'show_popular_terms'          => '1',
		'show_popular_pages_overseer' => '0',
		'insights_days'               => 14,
		'popular_terms_limit'         => 8,
	)
);
neo-pulse_assert( ! empty( $insights['show_popular_terms'] ), 'insights popular terms on' );
neo-pulse_assert( empty( $insights['show_popular_pages_overseer'] ), 'insights overseer pages off' );
neo-pulse_assert( (int) $insights['insights_days'] === 14, 'insights days clamped' );
neo-pulse_assert( (int) $insights['popular_terms_limit'] === 8, 'insights terms limit' );

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-search-logs.php';

$resolved_insights = Neo_Pulse_Wp_Ai_Widget_Design::resolve_search_insights(
	array( 'show_popular_terms' => 'no', 'insights_days' => 7 )
);
neo-pulse_assert( empty( $resolved_insights['show_popular_terms'] ), 'instance overrides popular terms off' );
neo-pulse_assert( (int) $resolved_insights['insights_days'] === 7, 'instance overrides insights days' );

neo-pulse_assert(
	Neo_Pulse_Wp_Search_Logs::normalize_query( '  Hello   World  ') === 'hello world',
	'search log normalize query'
);
neo-pulse_assert(
	! Neo_Pulse_Wp_Search_Logs::insert( array( 'session_id' => 'bad', 'query' => 'test' ) )['ok'],
	'search log rejects invalid session'
);

$empty_layout = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array( 'sidebar_layout' => array() ),
	'chat'
);
neo-pulse_assert( $empty_layout['sidebar_layout'] === array( 'chat' ), 'empty chat layout falls back to chat' );

$contact_human_layout = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array( 'sidebar_layout' => array( 'contact_human', 'chat' ) ),
	'chat'
);
neo-pulse_assert( in_array( 'contact_human', $contact_human_layout['sidebar_layout'], true ), 'sidebar layout accepts contact_human' );

$sidebar_vars = Neo_Pulse_Wp_Ai_Widget_Design::build_sidebar_css_vars(
	array( 'sidebar_width' => 400 ),
	Neo_Pulse_Wp_Ai_Widget_Design::fallback_palette()
);
neo-pulse_assert( strpos( $sidebar_vars, '--fai-sidebar-width:400px' ) !== false, 'sidebar css vars width' );

Neo_Pulse_Wp_Ai_Widget_Design::save_from_admin_post(
	array(
		'style_scope' => 'both',
		'sidebar'     => array(
			'sidebar_side'       => 'right',
			'sidebar_transition' => 'slide',
			'sidebar_width'      => 380,
			'sidebar_heading'    => 'Ask NEO Pulse',
			'sidebar_layout'     => array( 'chat' ),
		),
	),
	'chat'
);
$with_sidebar = Neo_Pulse_Wp_Ai_Widget_Design::get_settings();
neo-pulse_assert( $with_sidebar['chat_sidebar']['sidebar_heading'] === 'Ask NEO Pulse', 'admin post saves chat sidebar' );
neo-pulse_assert( (int) $with_sidebar['chat_sidebar']['sidebar_width'] === 380, 'admin post saves chat sidebar width' );

$chat_sidebar_bubble = Neo_Pulse_Wp_Ai_Widget_Design::sanitize_sidebar_config(
	array( 'display_mode' => 'bubble', 'sidebar_side' => 'left' ),
	'chat'
);
neo-pulse_assert( ! isset( $chat_sidebar_bubble['display_mode'] ), 'chat sidebar drops display_mode' );
neo-pulse_assert( $chat_sidebar_bubble['sidebar_side'] === 'left', 'chat sidebar keeps side' );

// ── CSS var builders ─────────────────────────────────────────
$chat_vars = Neo_Pulse_Wp_Ai_Widget_Design::build_chat_css_vars( Neo_Pulse_Wp_Ai_Widget_Design::fallback_palette() );
neo-pulse_assert( strpos( $chat_vars, '--fcw-accent:' ) !== false, 'chat css vars include accent' );
neo-pulse_assert( strpos( $chat_vars, '--fcw-powered:' ) !== false, 'chat css vars include powered' );
neo-pulse_assert( strpos( $chat_vars, '--fcw-icon:' ) !== false, 'chat css vars include icon' );
neo-pulse_assert( strpos( $chat_vars, '--fcw-button-border:' ) !== false, 'chat css vars include button-border' );
$search_vars = Neo_Pulse_Wp_Ai_Widget_Design::build_search_css_vars( Neo_Pulse_Wp_Ai_Widget_Design::fallback_palette() );
neo-pulse_assert( strpos( $search_vars, '--fbs-primary:' ) !== false, 'search css vars include primary' );
neo-pulse_assert( strpos( $search_vars, '--fbs-powered:' ) !== false, 'search css vars include powered' );
neo-pulse_assert( strpos( $search_vars, '--fbs-powered-icon:' ) !== false, 'search css vars include powered-icon' );
neo-pulse_assert( strpos( $search_vars, '--fbs-icon:' ) !== false, 'search css vars include icon' );
neo-pulse_assert( strpos( $search_vars, '--fbs-button-border:' ) !== false, 'search css vars include button-border' );
neo-pulse_assert( strpos( $search_vars, '--fbs-form-border:' ) !== false, 'search css vars include form-border' );
neo-pulse_assert( strpos( $search_vars, '--fbs-input-text:' ) !== false, 'search css vars include input-text' );

$palette = Neo_Pulse_Wp_Ai_Widget_Design::fallback_palette();
neo-pulse_assert( ( $palette['powered_text'] ?? '' ) === '#64748b', 'fallback powered_text' );
neo-pulse_assert( ( $palette['powered_icon'] ?? '' ) === '#3b82f6', 'fallback powered_icon' );
neo-pulse_assert( ( $palette['icon_color'] ?? '' ) === '#3b82f6', 'fallback icon_color' );
neo-pulse_assert( ( $palette['button_border'] ?? '' ) === '#cbd5e1', 'fallback button_border' );
neo-pulse_assert( ( $palette['form_border'] ?? '' ) === '#cbd5e1', 'fallback form_border' );
neo-pulse_assert( ( $palette['input_text'] ?? '' ) === '#1e293b', 'fallback input_text' );
neo-pulse_assert( in_array( 'powered_text', Neo_Pulse_Wp_Ai_Widget_Design::color_token_keys(), true ), 'powered_text is a color token' );

// ── Site Branding preserves part tokens ──────────────────────
Neo_Pulse_Wp_Ai_Widget_Design::save(
	array(
		'color_source' => 'site_branding',
		'style_scope'  => 'both',
		'shared'       => array_merge(
			Neo_Pulse_Wp_Ai_Widget_Design::fallback_palette(),
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
Neo_Pulse_Wp_Ai_Widget_Design::clear_resolve_cache();
$brand_part = Neo_Pulse_Wp_Ai_Widget_Design::resolve( 'search' );
neo-pulse_assert( $brand_part['powered_text'] === '#abcdef', 'site branding keeps powered_text from bag' );
neo-pulse_assert( $brand_part['powered_icon'] === '#fedcba', 'site branding keeps powered_icon from bag' );
neo-pulse_assert( $brand_part['icon_color'] === '#112233', 'site branding keeps icon_color from bag' );
neo-pulse_assert( $brand_part['button_border'] === '#445566', 'site branding keeps button_border from bag' );
neo-pulse_assert( $brand_part['form_border'] === '#778899', 'site branding keeps form_border from bag' );
neo-pulse_assert( $brand_part['input_text'] === '#101010', 'site branding keeps input_text from bag' );
neo-pulse_assert( $brand_part['accent'] === '#112233', 'site branding still overlays kit accent' );

// ── Legacy migration ─────────────────────────────────────────
$GLOBALS['neo-pulse_test_options'] = array(
	'neo_pulse_wp_chat_settings'   => array( 'color' => '#84BC00' ),
	'neo_pulse_wp_search_settings' => array(
		'primary_color' => '#3b82f6',
		'bg_color'      => '#ffffff',
		'border_radius' => 10,
		'font_size'     => 18,
	),
);
Neo_Pulse_Wp_Ai_Widget_Design::clear_resolve_cache();
Neo_Pulse_Wp_Ai_Widget_Design::maybe_migrate();
neo-pulse_assert( get_option( Neo_Pulse_Wp_Ai_Widget_Design::MIGRATION_KEY ) === '1', 'migration flag set' );
$migrated = get_option( Neo_Pulse_Wp_Ai_Widget_Design::OPTION_KEY );
neo-pulse_assert( is_array( $migrated ), 'migration wrote design option' );
neo-pulse_assert( ( $migrated['shared']['accent'] ?? '' ) === '#3b82f6' || ( $migrated['shared']['accent'] ?? '' ) === '#84BC00', 'migration mapped accent' );
neo-pulse_assert( (int) ( $migrated['shared']['radius'] ?? 0 ) === 10, 'migration mapped radius' );
neo-pulse_assert( (int) ( $migrated['shared']['font_size'] ?? 0 ) === 18, 'migration mapped font_size' );
neo-pulse_assert( ( $migrated['color_source'] ?? '' ) === 'site_branding', 'migration keeps site_branding default' );

echo "\nAll AI widget design tests passed.\n";
exit( 0 );
