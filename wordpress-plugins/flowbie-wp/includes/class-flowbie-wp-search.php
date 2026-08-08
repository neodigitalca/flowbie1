<?php
/**
 * AI-powered search: settings, shortcode, REST endpoint, and ranking.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Search {

	const OPTION_KEY = 'flowbie_wp_search_settings';

	const SETTINGS_MIGRATION_KEY = 'flowbie_wp_search_settings_migrated_v2';

	const REST_NAMESPACE = 'flowbie/v1';

	const RATE_LIMIT_TTL = 2;

	/** @var array<string,mixed>|null */
	private static ?array $settings_cache = null;

	/** @var bool */
	private static bool $front_page_search_rendered = false;

	// ── Settings CRUD ────────────────────────────────────────────

	/**
	 * @return array<string,mixed>
	 */
	public static function get_search_settings(): array {
		if ( self::$settings_cache !== null ) {
			return self::$settings_cache;
		}

		$defaults = array(
			'placeholder'         => 'Search this site…',
			'max_results'         => 8,
			'post_types'          => array( 'post', 'page' ),
			'content_type_labels' => array(
				'post' => 'Blogs',
			),
			'button_label'        => 'Search',
			'primary_color'       => '#3b82f6',
			'bg_color'            => '#ffffff',
			'border_radius'       => 8,
			'font_size'           => 16,
			'auto_front_page'     => false,
		);

		$saved = get_option( self::OPTION_KEY, array() );
		self::$settings_cache = wp_parse_args( is_array( $saved ) ? $saved : array(), $defaults );
		self::$settings_cache['font_size']       = max( 16, (int) self::$settings_cache['font_size'] );
		self::$settings_cache['auto_front_page'] = ! empty( self::$settings_cache['auto_front_page'] );
		if ( ! is_array( self::$settings_cache['content_type_labels'] ) ) {
			self::$settings_cache['content_type_labels'] = $defaults['content_type_labels'];
		}

		return self::$settings_cache;
	}

	/**
	 * @param array<string,mixed> $data Settings to merge.
	 */
	public static function save_search_settings( array $data ): void {
		$current = self::get_search_settings();
		$merged  = wp_parse_args( $data, $current );

		$merged['placeholder']   = sanitize_text_field( (string) $merged['placeholder'] );
		$merged['button_label']  = sanitize_text_field( (string) $merged['button_label'] );
		$merged['max_results']   = max( 1, min( 20, (int) $merged['max_results'] ) );
		$merged['primary_color'] = sanitize_hex_color( (string) $merged['primary_color'] ) ?: '#3b82f6';
		$merged['bg_color']      = sanitize_hex_color( (string) $merged['bg_color'] ) ?: '#ffffff';
		$merged['border_radius'] = max( 0, min( 50, (int) $merged['border_radius'] ) );
		$merged['font_size']     = max( 16, min( 24, (int) $merged['font_size'] ) );

		if ( ! is_array( $merged['post_types'] ) ) {
			$merged['post_types'] = array( 'post', 'page' );
		}
		$merged['post_types'] = array_values( array_filter(
			array_map( 'sanitize_key', $merged['post_types'] )
		) );
		if ( empty( $merged['post_types'] ) ) {
			$merged['post_types'] = array( 'post', 'page' );
		}

		$labels = array();
		if ( isset( $merged['content_type_labels'] ) && is_array( $merged['content_type_labels'] ) ) {
			foreach ( $merged['content_type_labels'] as $slug => $label ) {
				$key = sanitize_key( (string) $slug );
				$text = sanitize_text_field( (string) $label );
				if ( $key !== '' && $text !== '' ) {
					$labels[ $key ] = $text;
				}
			}
		}
		$merged['content_type_labels'] = $labels;

		if ( array_key_exists( 'auto_front_page', $data ) ) {
			$merged['auto_front_page'] = ! empty( $data['auto_front_page'] );
		}

		update_option( self::OPTION_KEY, $merged, false );
		self::$settings_cache = $merged;
		self::purge_public_caches();
	}

	public static function reset_search_settings(): void {
		delete_option( self::OPTION_KEY );
		self::$settings_cache = null;
		self::purge_public_caches();
	}

	/**
	 * Built-in label overrides (e.g. post → Blogs).
	 *
	 * @return array<string,string>
	 */
	public static function default_content_type_labels(): array {
		return array(
			'post' => 'Blogs',
		);
	}

	/**
	 * Fallback label when no custom name is saved.
	 */
	public static function default_content_type_label( string $post_type ): string {
		$builtins = self::default_content_type_labels();
		if ( isset( $builtins[ $post_type ] ) ) {
			return $builtins[ $post_type ];
		}
		$obj = get_post_type_object( $post_type );
		if ( $obj && ! empty( $obj->labels->singular_name ) ) {
			return (string) $obj->labels->singular_name;
		}
		return ucwords( str_replace( array( '-', '_' ), ' ', $post_type ) );
	}

	/**
	 * Display label for a result content type (search dropdown).
	 */
	public static function content_type_label( string $post_type ): string {
		$settings = self::get_search_settings();
		$labels   = isset( $settings['content_type_labels'] ) && is_array( $settings['content_type_labels'] )
			? $settings['content_type_labels']
			: array();
		if ( ! empty( $labels[ $post_type ] ) ) {
			return (string) $labels[ $post_type ];
		}
		return self::default_content_type_label( $post_type );
	}

	// ── Bootstrap ────────────────────────────────────────────────

	public static function init(): void {
		add_shortcode( 'flowbie_search', array( __CLASS__, 'render_shortcode' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		add_action( 'plugins_loaded', array( __CLASS__, 'maybe_migrate_settings' ), 30 );
		add_action( 'init', array( __CLASS__, 'register_search_assets' ), 5 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'register_search_assets' ) );

		if ( defined( 'ELEMENTOR_VERSION' ) ) {
			add_action( 'elementor/theme/after_do_header', array( __CLASS__, 'maybe_render_front_page_search' ), 5 );
		} else {
			add_action( 'wp_body_open', array( __CLASS__, 'maybe_render_front_page_search' ), 5 );
		}

		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/search/integrations/class-flowbie-wp-search-elementor.php';
		Flowbie_Wp_Search_Elementor::init();
	}

	/**
	 * One-time: disable auto front-page search for existing installs and purge caches.
	 */
	public static function maybe_migrate_settings(): void {
		if ( get_option( self::SETTINGS_MIGRATION_KEY, '' ) === '1' ) {
			return;
		}

		$saved = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		if ( ! array_key_exists( 'auto_front_page', $saved ) ) {
			$saved['auto_front_page'] = false;
			update_option( self::OPTION_KEY, $saved, false );
			self::$settings_cache = null;
		}

		update_option( self::SETTINGS_MIGRATION_KEY, '1', false );
		self::purge_public_caches();
	}

	/**
	 * Flush asset caches so logged-in and guest HTML stay in sync after search changes.
	 */
	public static function purge_public_caches(): void {
		if ( class_exists( 'Flowbie_Wp_Cache_Flush', false ) ) {
			Flowbie_Wp_Cache_Flush::flush_all();
			return;
		}
		if ( class_exists( 'Flowbie_Wp_Speed', false ) ) {
			Flowbie_Wp_Speed::flush_cache();
		}
		if ( function_exists( 'wp_cache_flush' ) ) {
			wp_cache_flush();
		}
	}

	/**
	 * Whether the hero search should auto-render on the front page.
	 */
	public static function should_auto_display_front_page_search(): bool {
		if ( is_admin() || ! is_front_page() ) {
			return false;
		}

		$settings = self::get_search_settings();
		if ( empty( $settings['auto_front_page'] ) ) {
			return false;
		}

		return (bool) apply_filters( 'flowbie_wp_search_auto_display_front_page', false );
	}

	/**
	 * Output hero search after the theme header (Elementor) or at body open (fallback).
	 */
	public static function maybe_render_front_page_search(): void {
		if ( ! self::should_auto_display_front_page_search() ) {
			return;
		}
		if ( self::$front_page_search_rendered ) {
			return;
		}

		self::$front_page_search_rendered = true;
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Markup from render_instance().
		echo self::render_instance(
			array(
				'layout' => 'hero',
				'slot'   => 'header',
			)
		);
	}

	// ── Shortcode ────────────────────────────────────────────────

	/**
	 * @param array<string,string>|string $atts Shortcode attributes.
	 * @return string
	 */
	public static function render_shortcode( $atts = array() ): string {
		$atts = shortcode_atts(
			array(
				'layout' => '',
				'slot'   => '',
			),
			is_array( $atts ) ? $atts : array(),
			'flowbie_search'
		);

		return self::render_instance( $atts );
	}

	/**
	 * Render a search instance (shortcode, Elementor widget, or programmatic).
	 *
	 * @param array<string,mixed> $instance Per-instance overrides.
	 * @return string
	 */
	public static function render_instance( array $instance = array() ): string {
		$settings   = self::merge_instance_settings( $instance );
		$sidebar    = Flowbie_Wp_Ai_Widget_Design::resolve_sidebar_config( 'search', $instance );
		$insights   = Flowbie_Wp_Ai_Widget_Design::resolve_search_insights( $instance );
		$wrap_class = self::build_wrap_class( $instance, $sidebar );
		$css_vars   = self::build_css_vars( $settings, $instance, $sidebar );
		$rest_url   = esc_url( rest_url( self::REST_NAMESPACE . '/search' ) );
		$nonce      = wp_create_nonce( 'wp_rest' );

		self::enqueue_search_assets( $sidebar );

		return self::render_search_markup(
			$wrap_class,
			$css_vars,
			$rest_url,
			$nonce,
			$settings,
			$instance,
			$sidebar,
			$insights
		);
	}

	/**
	 * Merge global search settings with per-instance overrides.
	 *
	 * @param array<string,mixed> $instance
	 * @return array<string,mixed>
	 */
	private static function merge_instance_settings( array $instance ): array {
		$global    = self::get_search_settings();
		$use_global = ! isset( $instance['use_global_settings'] )
			|| $instance['use_global_settings'] === 'yes'
			|| $instance['use_global_settings'] === true;

		if ( $use_global ) {
			$merged = $global;
		} else {
			$merged = wp_parse_args( $instance, $global );
		}

		$content_keys = array( 'placeholder', 'button_label', 'max_results' );
		foreach ( $content_keys as $key ) {
			if ( isset( $instance[ $key ] ) && $instance[ $key ] !== '' ) {
				$merged[ $key ] = $instance[ $key ];
			}
		}

		$style_keys = array(
			'primary_color',
			'bg_color',
			'text_color',
			'text_muted_color',
			'border_color',
			'hover_color',
			'dropdown_bg',
			'border_radius',
			'font_size',
			'dropdown_radius',
		);
		foreach ( $style_keys as $key ) {
			if ( ! $use_global && isset( $instance[ $key ] ) && $instance[ $key ] !== '' ) {
				$merged[ $key ] = $instance[ $key ];
			}
		}

		$merged['placeholder']   = sanitize_text_field( (string) $merged['placeholder'] );
		$merged['button_label']  = sanitize_text_field( (string) $merged['button_label'] );
		$merged['max_results']   = max( 1, min( 20, (int) $merged['max_results'] ) );
		$merged['primary_color'] = sanitize_hex_color( (string) $merged['primary_color'] ) ?: '#3b82f6';
		$merged['bg_color']      = sanitize_hex_color( (string) $merged['bg_color'] ) ?: '#ffffff';
		$merged['border_radius'] = max( 0, min( 50, (int) $merged['border_radius'] ) );
		$merged['font_size']     = max( 16, min( 24, (int) $merged['font_size'] ) );

		if ( isset( $merged['text_color'] ) && $merged['text_color'] !== '' ) {
			$merged['text_color'] = sanitize_hex_color( (string) $merged['text_color'] ) ?: '#1e293b';
		}
		if ( isset( $merged['text_muted_color'] ) && $merged['text_muted_color'] !== '' ) {
			$merged['text_muted_color'] = sanitize_hex_color( (string) $merged['text_muted_color'] ) ?: '#64748b';
		}
		if ( isset( $merged['border_color'] ) && $merged['border_color'] !== '' ) {
			$merged['border_color'] = sanitize_hex_color( (string) $merged['border_color'] ) ?: '#cbd5e1';
		}
		if ( isset( $merged['hover_color'] ) && $merged['hover_color'] !== '' ) {
			$merged['hover_color'] = sanitize_hex_color( (string) $merged['hover_color'] ) ?: '#f1f5f9';
		}
		if ( isset( $merged['dropdown_bg'] ) && $merged['dropdown_bg'] !== '' ) {
			$merged['dropdown_bg'] = sanitize_hex_color( (string) $merged['dropdown_bg'] ) ?: $merged['bg_color'];
		}
		if ( isset( $merged['dropdown_radius'] ) && $merged['dropdown_radius'] !== '' ) {
			$merged['dropdown_radius'] = max( 0, min( 50, (int) $merged['dropdown_radius'] ) );
		}

		return $merged;
	}

	/**
	 * @param array<string,mixed> $instance
	 * @param array<string,mixed> $sidebar
	 */
	private static function build_wrap_class( array $instance, array $sidebar = array() ): string {
		$wrap_class = 'flowbie-search-wrap';

		$layout = isset( $instance['layout'] ) ? (string) $instance['layout'] : '';
		if ( $layout === '' && isset( $instance['layout_preset'] ) ) {
			$layout = (string) $instance['layout_preset'];
		}
		if ( isset( $instance['slot'] ) && (string) $instance['slot'] === 'header' ) {
			$layout = $layout !== '' ? $layout : 'header_slot';
		}

		switch ( $layout ) {
			case 'hero':
				$wrap_class .= ' flowbie-search-wrap--hero';
				break;
			case 'compact':
				$wrap_class .= ' flowbie-search-wrap--compact';
				break;
			case 'header_slot':
				$wrap_class .= ' flowbie-search-wrap--hero flowbie-search-wrap--header-slot';
				break;
		}

		if ( ! empty( $instance['full_width'] ) && $instance['full_width'] === 'yes' ) {
			$wrap_class .= ' flowbie-search-wrap--full-width';
		}

		if ( ! empty( $sidebar['display_mode'] ) && $sidebar['display_mode'] === 'sidebar' ) {
			$wrap_class .= ' flowbie-search-wrap--sidebar fai-sidebar-root';
			$side = ( $sidebar['sidebar_side'] ?? 'right' ) === 'left' ? 'left' : 'right';
			$wrap_class .= ' fai-sidebar-root--' . $side;
			$transition = (string) ( $sidebar['sidebar_transition'] ?? 'slide' );
			if ( ! in_array( $transition, array( 'slide', 'fade', 'none' ), true ) ) {
				$transition = 'slide';
			}
			$wrap_class .= ' fai-sidebar-root--transition-' . $transition;
		}

		if ( ! empty( $sidebar['display_mode'] ) && $sidebar['display_mode'] === 'icon_only' ) {
			$wrap_class .= ' flowbie-search-wrap--icon-only';
			$open_as = (string) ( $sidebar['icon_open_as'] ?? 'sidebar_right' );
			if ( $open_as === 'expand_inline' ) {
				$wrap_class .= ' flowbie-search-wrap--icon-expand';
			} elseif ( $open_as === 'modal_center' ) {
				$wrap_class .= ' fbs-modal-root';
			} else {
				// In-flow launcher (header/toolbar). Do not use fai-sidebar-root — it fixed-positions the wrap off-layout.
				$wrap_class .= ' fbs-icon-panel-root fai-sidebar-root--inline-launcher';
				$side = ( $sidebar['sidebar_side'] ?? 'right' ) === 'left' ? 'left' : 'right';
				$wrap_class .= ' fai-sidebar-root--' . $side;
				$transition = (string) ( $sidebar['sidebar_transition'] ?? 'slide' );
				if ( ! in_array( $transition, array( 'slide', 'fade', 'none' ), true ) ) {
					$transition = 'slide';
				}
				$wrap_class .= ' fai-sidebar-root--transition-' . $transition;
			}
		}

		$panel_modes = ! empty( $sidebar['display_mode'] ) && in_array( $sidebar['display_mode'], array( 'sidebar', 'icon_only' ), true );
		if ( $panel_modes && (string) ( $sidebar['panel_content_align'] ?? 'left' ) === 'center' ) {
			$wrap_class .= ' flowbie-search-wrap--panel-align-center';
		}

		return $wrap_class;
	}

	/**
	 * @param array<string,mixed> $settings
	 * @param array<string,mixed> $instance
	 * @param array<string,mixed> $sidebar
	 */
	private static function build_css_vars( array $settings, array $instance, array $sidebar = array() ): string {
		$tokens = Flowbie_Wp_Ai_Widget_Design::resolve( 'search' );

		// Instance style overrides when not using global settings.
		$use_global = ! isset( $instance['use_global_settings'] )
			|| $instance['use_global_settings'] === 'yes'
			|| $instance['use_global_settings'] === true;

		if ( ! $use_global ) {
			$map = array(
				'primary_color'    => 'accent',
				'bg_color'         => 'bg',
				'text_color'       => 'text',
				'text_muted_color' => 'text_muted',
				'border_color'     => 'border',
				'hover_color'      => 'result_hover',
				'dropdown_bg'      => 'dropdown_bg',
			);
			foreach ( $map as $inst_key => $token_key ) {
				if ( isset( $instance[ $inst_key ] ) && $instance[ $inst_key ] !== '' ) {
					$san = Flowbie_Wp_Ai_Widget_Design::sanitize_color_value( (string) $instance[ $inst_key ] );
					if ( $san !== '' ) {
						$tokens[ $token_key ] = $san;
					}
				}
			}
			if ( isset( $instance['border_radius'] ) && $instance['border_radius'] !== '' ) {
				$tokens['radius'] = max( 0, min( 50, (int) $instance['border_radius'] ) );
			}
			if ( isset( $instance['font_size'] ) && $instance['font_size'] !== '' ) {
				$tokens['font_size'] = max( 16, min( 24, (int) $instance['font_size'] ) );
			}
		}

		$vars = Flowbie_Wp_Ai_Widget_Design::build_search_css_vars( $tokens, $instance );
		$panel_mode = ! empty( $sidebar['display_mode'] ) ? (string) $sidebar['display_mode'] : '';
		if ( $panel_mode === 'sidebar' || $panel_mode === 'icon_only' ) {
			$vars .= Flowbie_Wp_Ai_Widget_Design::build_sidebar_css_vars( $sidebar, $tokens );
		}
		if ( $panel_mode === 'icon_only' ) {
			$modal_width = max( 320, min( 720, (int) ( $sidebar['modal_max_width'] ?? 560 ) ) );
			$vars .= '--fbs-modal-max-width:' . $modal_width . 'px;';
			$vars .= '--fbs-launcher-bg:var(--fai-sidebar-launcher-bg);';
			$vars .= '--fbs-launcher-color:var(--fai-sidebar-launcher-text);';
		}
		return $vars;
	}

	/**
	 * Register shared sidebar shell assets.
	 */
	public static function register_sidebar_assets(): void {
		$base_url = plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE );
		$ver      = self::search_asset_version();

		wp_register_style(
			'flowbie-ai-sidebar-shell',
			$base_url . 'assets/shared/flowbie-ai-sidebar-shell.css',
			array(),
			$ver
		);

		wp_register_script(
			'flowbie-ai-sidebar-shell',
			$base_url . 'assets/shared/flowbie-ai-sidebar-shell.js',
			array(),
			$ver,
			true
		);

		wp_register_style(
			'flowbie-ai-sidebar-unify',
			$base_url . 'assets/shared/flowbie-ai-sidebar-unify.css',
			array( 'flowbie-ai-sidebar-shell' ),
			$ver
		);

		wp_register_script(
			'flowbie-ai-sidebar-unify',
			$base_url . 'assets/shared/flowbie-ai-sidebar-unify.js',
			array( 'flowbie-ai-sidebar-shell' ),
			$ver,
			true
		);
	}

	/**
	 * Register front-end search assets (for Elementor depends + lazy enqueue).
	 */
	public static function register_search_assets(): void {
		$asset_ver = self::search_asset_version();
		$base_url  = plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE );

		self::register_sidebar_assets();

		wp_register_style(
			'flowbie-wp-lato',
			'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,600;0,700;1,400&display=swap',
			array(),
			null
		);

		wp_register_style(
			'flowbie-search',
			$base_url . 'assets/search/flowbie-search.css',
			array( 'flowbie-wp-lato' ),
			$asset_ver
		);

		wp_register_script(
			'flowbie-search',
			$base_url . 'assets/search/flowbie-search.js',
			array(),
			$asset_ver,
			true
		);
	}

	/**
	 * Enqueue registered search assets.
	 *
	 * @param array<string,mixed> $sidebar Optional sidebar config.
	 */
	public static function enqueue_search_assets( array $sidebar = array() ): void {
		$display_mode = ! empty( $sidebar['display_mode'] ) ? (string) $sidebar['display_mode'] : '';
		$is_sidebar   = $display_mode === 'sidebar';
		$icon_open_as = (string) ( $sidebar['icon_open_as'] ?? 'sidebar_right' );
		$needs_shell  = $is_sidebar || ( $display_mode === 'icon_only' && $icon_open_as !== 'expand_inline' );
		self::register_search_assets();
		if ( $needs_shell ) {
			self::register_sidebar_assets();
			wp_deregister_script( 'flowbie-search' );
			wp_register_script(
				'flowbie-search',
				plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/search/flowbie-search.js',
				array( 'flowbie-ai-sidebar-shell', 'flowbie-ai-sidebar-unify' ),
				self::search_asset_version(),
				true
			);
		}
		wp_enqueue_style( 'flowbie-wp-lato' );
		wp_enqueue_style( 'flowbie-search' );
		if ( $needs_shell ) {
			wp_enqueue_style( 'flowbie-ai-sidebar-shell' );
			wp_enqueue_style( 'flowbie-ai-sidebar-unify' );
			wp_enqueue_script( 'flowbie-ai-sidebar-shell' );
			wp_enqueue_script( 'flowbie-ai-sidebar-unify' );
		}
		wp_enqueue_script( 'flowbie-search' );
	}

	/**
	 * Cache-bust front-end search assets when files change.
	 */
	public static function search_asset_version(): string {
		$css = FLOWBIE_WP_PLUGIN_DIR . 'assets/search/flowbie-search.css';
		$js  = FLOWBIE_WP_PLUGIN_DIR . 'assets/search/flowbie-search.js';
		$ver = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '1';
		if ( is_readable( $css ) ) {
			$ver .= '.' . (string) filemtime( $css );
		}
		if ( is_readable( $js ) ) {
			$ver .= '.' . (string) filemtime( $js );
		}
		return $ver;
	}

	/**
	 * Server-rendered markup so theme CSS cannot collapse a JS-only form.
	 *
	 * @param string               $wrap_class
	 * @param string               $css_vars
	 * @param string               $rest_url
	 * @param string               $nonce
	 * @param array<string,mixed>  $settings
	 * @param array<string,mixed>  $instance
	 */
	public static function render_search_markup(
		string $wrap_class,
		string $css_vars,
		string $rest_url,
		string $nonce,
		array $settings,
		array $instance = array(),
		array $sidebar = array(),
		array $insights = array()
	): string {
		$placeholder  = isset( $settings['placeholder'] ) ? (string) $settings['placeholder'] : '';
		$button_label = isset( $settings['button_label'] ) ? (string) $settings['button_label'] : '';
		$max_results  = isset( $settings['max_results'] ) ? (int) $settings['max_results'] : 8;

		$hide_ai      = self::instance_flag_is_off( $instance, 'show_ai_banner', true );
		$hide_scores  = self::instance_flag_is_off( $instance, 'show_relevance_scores', true );
		$hide_powered = self::instance_flag_is_off( $instance, 'show_powered_by', true );

		$design_ui = Flowbie_Wp_Ai_Widget_Design::get_settings()['search_ui'];
		if ( empty( $design_ui['ai_banner'] ) ) {
			$hide_ai = true;
		}
		if ( empty( $design_ui['relevance_scores'] ) ) {
			$hide_scores = true;
		}
		if ( empty( $design_ui['powered_by'] ) ) {
			$hide_powered = true;
		}
		$hide_icon     = empty( $design_ui['search_icon'] );
		$hide_submit   = empty( $design_ui['submit_button'] );
		$hide_shadow   = empty( $design_ui['dropdown_shadow'] );
		$hide_empty    = empty( $design_ui['empty_state'] );

		$icon_id   = Flowbie_Wp_Search_Icons::sanitize_id( (string) ( $sidebar['launcher_icon'] ?? 'search' ) );
		$icon_svg  = Flowbie_Wp_Search_Icons::render( $icon_id );

		$hide_clear = empty( $design_ui['clear_button'] );

		$is_sidebar   = ! empty( $sidebar['display_mode'] ) && $sidebar['display_mode'] === 'sidebar';
		$is_icon_only = ! empty( $sidebar['display_mode'] ) && $sidebar['display_mode'] === 'icon_only';
		$icon_open_as = (string) ( $sidebar['icon_open_as'] ?? 'sidebar_right' );
		$layout       = isset( $sidebar['sidebar_layout'] ) && is_array( $sidebar['sidebar_layout'] )
			? $sidebar['sidebar_layout']
			: array( 'heading', 'search', 'results' );
		$show_heading = in_array( 'heading', $layout, true ) && ! empty( $sidebar['sidebar_heading'] );
		$show_search  = in_array( 'search', $layout, true );
		$show_results = in_array( 'results', $layout, true );
		if ( ! $show_search && ! $show_results ) {
			$show_search  = true;
			$show_results = true;
		}

		$is_panel_search = $is_sidebar || ( $is_icon_only && $icon_open_as !== 'expand_inline' );
		if ( $is_panel_search ) {
			$layout = self::normalize_sidebar_panel_layout( $layout );
		}
		if ( $is_panel_search && $show_search ) {
			if ( ! in_array( 'results', $layout, true ) ) {
				$layout[] = 'results';
			}
			$show_results = true;
		}

		if ( empty( $insights ) ) {
			$insights = Flowbie_Wp_Ai_Widget_Design::resolve_search_insights( $instance );
		}

		$log_url       = esc_url( rest_url( self::REST_NAMESPACE . '/search/log' ) );
		$accept_url    = esc_url( rest_url( self::REST_NAMESPACE . '/search/accept' ) );
		$insights_url  = esc_url( rest_url( self::REST_NAMESPACE . '/search/insights' ) );
		$word_ready_url = esc_url( rest_url( self::REST_NAMESPACE . '/search/word-ready' ) );
		$logging_on    = ! empty( $insights['logging_enabled'] );
		$insight_order = ( $is_sidebar || ( $is_icon_only && $icon_open_as !== 'expand_inline' ) ) ? $layout : array( 'popular_terms' );

		$extra_classes = '';
		if ( $hide_shadow ) {
			$extra_classes .= ' fbs--no-shadow';
		}
		if ( $hide_empty ) {
			$extra_classes .= ' fbs--no-empty';
		}
		if ( $hide_icon ) {
			$extra_classes .= ' fbs--no-icon';
		}
		if ( $hide_submit ) {
			$extra_classes .= ' fbs--no-submit';
		}
		if ( $hide_powered ) {
			$extra_classes .= ' fbs--no-powered';
		}
		if ( $hide_clear ) {
			$extra_classes .= ' fbs--no-clear';
		}
		if ( $is_sidebar ) {
			$extra_classes .= ' flowbie-search-wrap--sidebar-mode';
		}
		if ( $is_icon_only ) {
			$extra_classes .= ' flowbie-search-wrap--icon-only-mode';
			if ( $icon_open_as !== 'expand_inline' ) {
				$extra_classes .= ' flowbie-search-wrap--sidebar-mode';
			}
		}

		$launcher_label = self::launcher_aria_label( $sidebar, $button_label );
		$fbs_modifiers  = $extra_classes;
		$panel_layout   = (string) ( $sidebar['panel_layout'] ?? 'compact' );
		$elementor_edit_context = ! empty( $instance['elementor_edit_context'] );

		if ( $elementor_edit_context ) {
			$extra_classes .= ' flowbie-search-wrap--elementor-edit';
		}

		$panel_markup_hidden = $is_panel_search && $elementor_edit_context;

		$panel_align_class = '';
		if ( $is_panel_search && (string) ( $sidebar['panel_content_align'] ?? 'left' ) === 'center' ) {
			$panel_align_class = ' fai-sidebar-panel--align-center';
		}

		if ( $elementor_edit_context ) {
			$css_vars = preg_replace( '/--fbs-panel-offset-top:\s*[^;]+;?/', '', $css_vars ) ?? $css_vars;
		}

		ob_start();
		?>
		<div
			class="<?php echo esc_attr( $wrap_class . $extra_classes ); ?>"
			style="<?php echo esc_attr( $css_vars ); ?>"
			data-rest-url="<?php echo esc_url( $rest_url ); ?>"
			data-log-url="<?php echo esc_url( $log_url ); ?>"
			data-accept-url="<?php echo esc_url( $accept_url ); ?>"
			data-insights-url="<?php echo esc_url( $insights_url ); ?>"
			data-word-ready-url="<?php echo esc_url( $word_ready_url ); ?>"
			data-nonce="<?php echo esc_attr( $nonce ); ?>"
			<?php if ( $logging_on ) : ?>
				data-logging-enabled="1"
			<?php endif; ?>
			<?php if ( ! empty( $insights['show_popular_terms'] ) ) : ?>
				data-show-popular-terms="1"
			<?php endif; ?>
			<?php if ( ! empty( $insights['show_popular_pages_overseer'] ) ) : ?>
				data-show-popular-pages-overseer="1"
			<?php endif; ?>
			<?php if ( ! empty( $insights['show_popular_pages_search'] ) ) : ?>
				data-show-popular-pages-search="1"
			<?php endif; ?>
			data-insights-days="<?php echo (int) ( $insights['insights_days'] ?? 30 ); ?>"
			data-popular-terms-limit="<?php echo (int) ( $insights['popular_terms_limit'] ?? 5 ); ?>"
			data-placeholder="<?php echo esc_attr( $placeholder ); ?>"
			data-button-label="<?php echo esc_attr( $button_label ); ?>"
			data-max-results="<?php echo (int) $max_results; ?>"
			<?php if ( $is_sidebar || ( $is_icon_only && $icon_open_as !== 'expand_inline' ) ) : ?>
				data-sidebar-mode="1"
			<?php endif; ?>
			<?php if ( $is_icon_only ) : ?>
				data-icon-mode="1"
				data-icon-open-as="<?php echo esc_attr( $icon_open_as ); ?>"
			<?php endif; ?>
			<?php if ( $hide_ai ) : ?>
				data-hide-ai-banner="1"
			<?php endif; ?>
			<?php if ( $hide_scores ) : ?>
				data-hide-scores="1"
			<?php endif; ?>
			<?php if ( $hide_powered ) : ?>
				data-hide-powered="1"
			<?php endif; ?>
			<?php if ( $hide_clear ) : ?>
				data-hide-clear="1"
			<?php endif; ?>
			<?php if ( $is_panel_search ) : ?>
				data-panel-layout="<?php echo esc_attr( $panel_layout ); ?>"
				data-topics-limit="4"
				data-fbs-icon-ids="<?php echo esc_attr( implode( ',', Flowbie_Wp_Search_Icons::ids() ) ); ?>"
			<?php endif; ?>
			<?php if ( $elementor_edit_context ) : ?>
				data-elementor-edit-preview="1"
			<?php endif; ?>
		>
			<?php if ( $is_icon_only ) : ?>
				<button type="button" class="fbs__icon-launcher" aria-label="<?php echo esc_attr( $launcher_label ); ?>" aria-expanded="false">
					<?php echo $icon_svg; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- inline SVG ?>
				</button>
				<?php if ( $icon_open_as === 'expand_inline' ) : ?>
					<div class="fbs__icon-panel fbs__icon-panel--expand"<?php echo $panel_markup_hidden ? ' hidden' : ''; ?>>
						<div class="fbs">
							<?php
							// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
							echo self::render_inline_search_body(
								$placeholder,
								$button_label,
								$icon_svg,
								$insight_order,
								$insights,
								false
							);
							?>
						</div>
					</div>
				<?php else : ?>
					<?php
					$backdrop_class = $icon_open_as === 'modal_center' ? 'fbs-modal-backdrop fai-sidebar-backdrop' : 'fai-sidebar-backdrop';
					$panel_class    = $icon_open_as === 'modal_center' ? 'fbs-modal-panel fai-sidebar-panel' : 'fai-sidebar-panel';
					?>
					<div class="<?php echo esc_attr( $backdrop_class ); ?>" aria-hidden="true"<?php echo $panel_markup_hidden ? ' hidden' : ''; ?>></div>
					<div class="<?php echo esc_attr( $panel_class . $panel_align_class ); ?>" style="<?php echo esc_attr( $css_vars ); ?>" role="dialog" aria-modal="true" aria-label="<?php esc_attr_e( 'Site search', 'flowbie-wp' ); ?>"<?php echo $panel_markup_hidden ? ' hidden' : ''; ?>>
						<?php
						// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
						echo self::render_panel_close_button();
						// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
						echo self::render_sidebar_panel_body(
							$css_vars,
							$fbs_modifiers,
							true,
							$layout,
							$placeholder,
							$button_label,
							$icon_svg,
							$insights,
							$show_search,
							$show_results,
							$sidebar,
							false
						);
						?>
					</div>
				<?php endif; ?>
			<?php elseif ( $is_sidebar ) : ?>
				<button type="button" class="fai-sidebar-launcher" aria-label="<?php esc_attr_e( 'Open search', 'flowbie-wp' ); ?>">
					<?php echo $icon_svg; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- inline SVG ?>
				</button>
				<div class="fai-sidebar-backdrop" aria-hidden="true"<?php echo $panel_markup_hidden ? ' hidden' : ''; ?>></div>
				<div class="fai-sidebar-panel<?php echo esc_attr( $panel_align_class ); ?>" style="<?php echo esc_attr( $css_vars ); ?>" role="dialog" aria-modal="true" aria-label="<?php esc_attr_e( 'Site search', 'flowbie-wp' ); ?>"<?php echo $panel_markup_hidden ? ' hidden' : ''; ?>>
					<?php
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					echo self::render_panel_close_button();
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					echo self::render_sidebar_panel_body(
						$css_vars,
						$fbs_modifiers,
						false,
						$layout,
						$placeholder,
						$button_label,
						$icon_svg,
						$insights,
						$show_search,
						$show_results,
						$sidebar,
						false
					);
					?>
				</div>
			<?php else : ?>
			<div class="fbs">
				<?php
				// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				echo self::render_inline_search_body(
					$placeholder,
					$button_label,
					$icon_svg,
					$insight_order,
					$insights,
					true
				);
				?>
			</div>
			<?php endif; ?>
			<?php if ( $is_panel_search ) : ?>
				<div class="fbs__icon-sprites" hidden aria-hidden="true">
					<?php
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					echo self::render_icon_sprite_templates();
					?>
				</div>
			<?php endif; ?>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * @param array<string,mixed> $sidebar
	 */
	private static function launcher_aria_label( array $sidebar, string $button_label ): string {
		$custom = isset( $sidebar['launcher_label'] ) ? trim( (string) $sidebar['launcher_label'] ) : '';
		if ( $custom !== '' ) {
			return $custom;
		}
		if ( $button_label !== '' ) {
			return $button_label;
		}
		return __( 'Open search', 'flowbie-wp' );
	}

	/**
	 * Sidebar / icon panel body with scoped search shell (survives portal to body).
	 *
	 * @param array<int,string>   $layout
	 * @param array<string,mixed> $insights
	 */
	private static function render_sidebar_panel_body(
		string $css_vars,
		string $modifier_classes,
		bool $is_icon_panel,
		array $layout,
		string $placeholder,
		string $button_label,
		string $icon_svg,
		array $insights,
		bool $show_search,
		bool $show_results,
		array $sidebar,
		bool $panel_editor_open = false
	): string {
		$panel_layout     = (string) ( $sidebar['panel_layout'] ?? 'compact' );
		$is_discovery     = $panel_layout === 'discovery';
		$sidebar_heading  = (string) ( $sidebar['sidebar_heading'] ?? '' );
		$sidebar_subtitle = trim( (string) ( $sidebar['sidebar_subtitle'] ?? '' ) );
		$intro_text       = $sidebar_subtitle;
		if ( $panel_editor_open && $intro_text === '' ) {
			$intro_text = __( 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', 'flowbie-wp' );
		}
		$show_heading     = in_array( 'heading', $layout, true ) && $sidebar_heading !== '';

		$shell_class = 'flowbie-search-wrap flowbie-search-wrap--sidebar-mode flowbie-search-wrap--panel-inner';
		if ( $is_icon_panel ) {
			$shell_class .= ' flowbie-search-wrap--icon-only-mode';
		}
		if ( $is_discovery ) {
			$shell_class .= ' flowbie-search-wrap--panel-layout-discovery';
		}

		ob_start();
		?>
		<div class="fai-sidebar-panel__body">
			<?php if ( $is_discovery && ( $show_heading || $intro_text !== '' ) ) : ?>
				<div class="fbs__panel-hero">
					<?php if ( $show_heading ) : ?>
						<h2 class="fbs__panel-title"><?php echo esc_html( $sidebar_heading ); ?></h2>
					<?php endif; ?>
					<?php if ( $intro_text !== '' ) : ?>
						<p class="fbs__panel-subtitle"><?php echo esc_html( $intro_text ); ?></p>
					<?php endif; ?>
				</div>
			<?php elseif ( $show_heading ) : ?>
				<h2 class="fai-sidebar-heading fbs__heading"><?php echo esc_html( $sidebar_heading ); ?></h2>
				<?php if ( $intro_text !== '' ) : ?>
					<p class="fbs__sidebar-intro"><?php echo esc_html( $intro_text ); ?></p>
				<?php endif; ?>
			<?php endif; ?>
			<div class="<?php echo esc_attr( $shell_class . $modifier_classes ); ?>" style="<?php echo esc_attr( $css_vars ); ?>">
				<div class="fbs fbs--sidebar-inner">
					<?php
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					echo self::render_sidebar_layout_sections(
						$layout,
						$placeholder,
						$button_label,
						$icon_svg,
						$insights,
						$show_search,
						$show_results,
						$panel_editor_open,
						$is_discovery
					);
					?>
					<?php
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					echo self::render_powered_by_markup();
					?>
				</div>
			</div>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * @param array<int,string>   $layout
	 * @param array<string,mixed> $insights
	 */
	private static function render_sidebar_layout_sections(
		array $layout,
		string $placeholder,
		string $button_label,
		string $icon_svg,
		array $insights,
		bool $show_search,
		bool $show_results,
		bool $panel_editor_open = false,
		bool $is_discovery = false
	): string {
		$insight_sections = array( 'popular_terms', 'popular_topics' );
		$has_query_search = $show_search && in_array( 'search', $layout, true );
		$has_query_results = $show_results && in_array( 'results', $layout, true );
		ob_start();

		if ( $has_query_search ) {
			?>
			<section class="fbs__sidebar-search" aria-label="<?php esc_attr_e( 'Search', 'flowbie-wp' ); ?>">
				<?php
				// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				echo self::render_search_form( $placeholder, $button_label, $icon_svg );
				?>
			</section>
			<?php
		}

		if ( $has_query_results ) {
			echo '<div class="fbs__sidebar-query-scroll">';
			?>
			<section class="fbs__sidebar-results" aria-label="<?php esc_attr_e( 'Search results', 'flowbie-wp' ); ?>">
				<div class="fbs__results-slot">
					<div class="fbs__results-slot-empty" data-elementor-preview-placeholder="1">
						<p class="fbs__results-slot-empty-label"><?php esc_html_e( 'Search results appear here', 'flowbie-wp' ); ?></p>
					</div>
					<div class="fbs__panel fbs__panel--sidebar">
						<div class="fbs__dropdown" role="listbox" hidden></div>
						<div class="fbs__status" aria-live="polite" hidden></div>
					</div>
				</div>
			</section>
			<?php
			echo '</div>';
		}

		$insights_open         = false;
		$pages_group_open      = false;
		$page_sections         = array( 'popular_pages_overseer', 'popular_pages_search' );
		$page_sections_rendered = 0;
		$has_both_page_sections = in_array( 'popular_pages_overseer', $layout, true ) && in_array( 'popular_pages_search', $layout, true );
		foreach ( $insight_sections as $section ) {
			if ( ! in_array( $section, $layout, true ) ) {
				continue;
			}
			if ( ! $insights_open ) {
				?>
				<aside class="fbs__sidebar-insights" aria-label="<?php esc_attr_e( 'Suggestions', 'flowbie-wp' ); ?>">
				<?php
				$insights_open = true;
			}

			$is_page_section = in_array( $section, $page_sections, true );
			if ( $is_page_section && ! $pages_group_open ) {
				$group_class = 'fbs__insights-pages-group';
				if ( $has_both_page_sections ) {
					$group_class .= ' fbs__insights-pages-group--paired';
				}
				echo '<div class="' . esc_attr( $group_class ) . '">';
				$pages_group_open = true;
			}
			if ( ! $is_page_section && $pages_group_open ) {
				echo '</div>';
				$pages_group_open = false;
				$page_sections_rendered = 0;
			}

			if ( $is_page_section && $page_sections_rendered > 0 ) {
				echo '<span class="fbs__insights-pages-separator" aria-hidden="true">,</span>';
			}

			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo self::render_insight_block( $section, $insights, $panel_editor_open, $is_discovery, true );
			if ( $is_page_section ) {
				$page_sections_rendered += 1;
			}
		}
		if ( $pages_group_open ) {
			echo '</div>';
		}
		if ( $insights_open ) {
			?>
			</aside>
			<?php
		}

		return (string) ob_get_clean();
	}

	/**
	 * Panel sidebar order: heading → search → results → insight modules.
	 *
	 * @param array<int,string> $layout Raw layout keys.
	 * @return array<int,string>
	 */
	private static function normalize_sidebar_panel_layout( array $layout ): array {
		$ordered = array( 'heading', 'search', 'results' );
		$insight = array( 'popular_terms', 'popular_topics' );
		$out     = array();
		foreach ( $ordered as $key ) {
			if ( in_array( $key, $layout, true ) ) {
				$out[] = $key;
			}
		}
		foreach ( $insight as $key ) {
			if ( in_array( $key, $layout, true ) ) {
				$out[] = $key;
			}
		}
		return $out;
	}

	/**
	 * @param array<int,string>   $insight_order
	 * @param array<string,mixed> $insights
	 */
	private static function render_inline_search_body(
		string $placeholder,
		string $button_label,
		string $icon_svg,
		array $insight_order,
		array $insights,
		bool $include_powered
	): string {
		ob_start();
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo self::render_search_form( $placeholder, $button_label, $icon_svg );
		$page_sections          = array( 'popular_pages_overseer', 'popular_pages_search' );
		$pages_group_open       = false;
		$page_sections_rendered = 0;
		$has_both_page_sections = in_array( 'popular_pages_overseer', $insight_order, true ) && in_array( 'popular_pages_search', $insight_order, true );
		foreach ( $insight_order as $section ) {
			if ( ! in_array( $section, array( 'popular_terms', 'popular_pages_overseer', 'popular_pages_search' ), true ) ) {
				continue;
			}
			$is_page_section = in_array( $section, $page_sections, true );
			if ( $is_page_section && ! $pages_group_open ) {
				$group_class = 'fbs__insights-pages-group';
				if ( $has_both_page_sections ) {
					$group_class .= ' fbs__insights-pages-group--paired';
				}
				echo '<div class="' . esc_attr( $group_class ) . '">';
				$pages_group_open = true;
			}
			if ( ! $is_page_section && $pages_group_open ) {
				echo '</div>';
				$pages_group_open = false;
				$page_sections_rendered = 0;
			}
			if ( $is_page_section && $page_sections_rendered > 0 ) {
				echo '<span class="fbs__insights-pages-separator" aria-hidden="true">,</span>';
			}
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo self::render_insight_block( $section, $insights );
			if ( $is_page_section ) {
				$page_sections_rendered += 1;
			}
		}
		if ( $pages_group_open ) {
			echo '</div>';
		}
		?>
		<div class="fbs__panel">
			<div class="fbs__dropdown" role="listbox" hidden style="display:none;"></div>
			<div class="fbs__status" aria-live="polite" style="display:none;"></div>
		</div>
		<?php
		if ( $include_powered ) {
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo self::render_powered_by_markup();
		}
		return (string) ob_get_clean();
	}

	private static function render_search_form( string $placeholder, string $button_label, string $icon_svg ): string {
		ob_start();
		?>
		<form class="fbs__form" role="search" action="#" method="get" autocomplete="off">
			<input
				type="text"
				class="fbs__input"
				name="flowbie_search_query"
				value=""
				placeholder="<?php echo esc_attr( $placeholder ); ?>"
				aria-label="<?php echo esc_attr( $placeholder ); ?>"
				autocomplete="off"
				inputmode="search"
				enterkeyhint="search"
			/>
			<button type="submit" class="fbs__btn fbs__btn--icon" aria-label="<?php echo esc_attr( $button_label ); ?>">
				<span class="fbs__btn-icon"><?php echo $icon_svg; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- inline SVG ?></span>
				<span class="fbs__btn-label"><?php echo esc_html( $button_label ); ?></span>
			</button>
		</form>
		<?php
		return (string) ob_get_clean();
	}

	private static function render_powered_by_markup(): string {
		ob_start();
		?>
		<a class="fbs__powered" href="https://flowbie.ca" target="_blank" rel="noopener noreferrer">
			<svg class="fbs__powered-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M11.3 1.05a1 1 0 0 0-1.6 0L5.7 7H2a1 1 0 0 0-.8 1.6l4 5.5a1 1 0 0 0 .8.4h2.2l-1.1 3.9a.75.75 0 0 0 1.3.7l6-7A1 1 0 0 0 14.6 11H12l1.9-5.2A1 1 0 0 0 13 4.5h-1.8l.1-3.45z"/></svg>
			<?php esc_html_e( 'Powered by', 'flowbie-wp' ); ?> <strong>Flowbie</strong>
		</a>
		<?php
		return (string) ob_get_clean();
	}

	private static function render_panel_close_button(): string {
		ob_start();
		?>
		<button type="button" class="fai-sidebar-close" aria-label="<?php esc_attr_e( 'Close search', 'flowbie-wp' ); ?>">
			<?php echo Flowbie_Wp_Search_Icons::render_close(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- inline SVG ?>
		</button>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * @param array<string,mixed> $instance
	 */
	private static function instance_flag_is_off( array $instance, string $key, bool $default_on ): bool {
		if ( ! array_key_exists( $key, $instance ) ) {
			return ! $default_on;
		}
		$value = $instance[ $key ];
		if ( $value === 'yes' || $value === true || $value === 1 || $value === '1' ) {
			return false;
		}
		if ( $value === 'no' || $value === false || $value === 0 || $value === '0' || $value === '' ) {
			return true;
		}
		return ! $default_on;
	}

	// ── REST API ─────────────────────────────────────────────────

	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/search',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle_search' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'query' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'per_page' => array(
						'type'              => 'integer',
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/search/log',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle_search_log' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/search/accept',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle_search_accept' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/search/insights',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'handle_search_insights' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/search/word-ready',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle_search_word_ready' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'query' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function handle_search_word_ready( WP_REST_Request $request ): WP_REST_Response {
		$query_text = trim( (string) $request->get_param( 'query' ) );
		if ( $query_text === '' ) {
			return new WP_REST_Response( array( 'ready' => false ), 200 );
		}

		$ip_key = 'fbs_wrl_' . md5( $_SERVER['REMOTE_ADDR'] ?? 'unknown' );
		if ( get_transient( $ip_key ) ) {
			return new WP_REST_Response( array( 'ready' => false ), 200 );
		}
		set_transient( $ip_key, 1, self::RATE_LIMIT_TTL );

		return new WP_REST_Response(
			array(
				'ready' => self::openrouter_query_has_complete_word( $query_text ),
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public static function handle_search( WP_REST_Request $request ) {
		$query_text = trim( (string) $request->get_param( 'query' ) );
		if ( $query_text === '' ) {
			return new WP_Error( 'flowbie_search_empty', 'Query cannot be empty.', array( 'status' => 400 ) );
		}

		$ip_key = 'fbs_rl_' . md5( $_SERVER['REMOTE_ADDR'] ?? 'unknown' );
		if ( get_transient( $ip_key ) ) {
			return new WP_Error( 'flowbie_search_rate', 'Too many requests. Please wait a moment.', array( 'status' => 429 ) );
		}
		set_transient( $ip_key, 1, self::RATE_LIMIT_TTL );

		$settings  = self::get_search_settings();
		$per_page  = (int) $request->get_param( 'per_page' );
		if ( $per_page < 1 || $per_page > 20 ) {
			$per_page = (int) $settings['max_results'];
		}

		$ai_analysis = self::openrouter_analyze( $query_text );

		$search_terms = self::build_search_queries( $query_text, $ai_analysis );

		$all_results = array();
		$seen_ids    = array();

		foreach ( $search_terms as $term ) {
			$batch = self::wp_query_search( $term, $per_page * 2, $settings['post_types'] );
			foreach ( $batch as $item ) {
				if ( ! isset( $seen_ids[ $item['id'] ] ) ) {
					$seen_ids[ $item['id'] ] = true;
					$all_results[]            = $item;
				}
			}
		}

		$ranked = self::rank_results( $all_results, $ai_analysis, $per_page );

		return new WP_REST_Response(
			array(
				'results'  => $ranked,
				'analysis' => array(
					'intent'    => isset( $ai_analysis['intent'] ) ? $ai_analysis['intent'] : 'unknown',
					'sentiment' => isset( $ai_analysis['sentiment'] ) ? $ai_analysis['sentiment'] : 'neutral',
					'keywords'  => isset( $ai_analysis['keywords'] ) ? $ai_analysis['keywords'] : array(),
				),
				'meta'     => array(
					'query' => $query_text,
					'total' => count( $ranked ),
				),
			),
			200
		);
	}

	// ── Build search queries from AI analysis ────────────────────

	/**
	 * Build multiple search queries: the AI keywords first, then the original.
	 *
	 * @param string $original_query
	 * @param array{intent:string,keywords:array<string>,sentiment:string} $ai
	 * @return array<int,string>
	 */
	private static function build_search_queries( string $original_query, array $ai ): array {
		$queries  = array();
		$keywords = isset( $ai['keywords'] ) ? $ai['keywords'] : array();

		if ( ! empty( $keywords ) ) {
			$queries[] = implode( ' ', $keywords );
		}

		$queries[] = $original_query;

		foreach ( $keywords as $kw ) {
			$kw = trim( $kw );
			if ( $kw !== '' && stripos( $original_query, $kw ) === false ) {
				$queries[] = $kw;
			}
		}

		return array_unique( $queries );
	}

	// ── WP_Query search ──────────────────────────────────────────

	/**
	 * @param string        $query
	 * @param int           $limit
	 * @param array<string> $post_types
	 * @return array<int,array<string,mixed>>
	 */
	private static function wp_query_search( string $query, int $limit, array $post_types ): array {
		$args = array(
			's'              => $query,
			'post_type'      => $post_types,
			'post_status'    => 'publish',
			'posts_per_page' => $limit,
			'orderby'        => 'relevance',
			'order'          => 'DESC',
			'no_found_rows'  => true,
		);

		$wp_query = new WP_Query( $args );
		$results  = array();
		$position = 0;

		foreach ( $wp_query->posts as $post ) {
			++$position;
			$results[] = array(
				'id'         => $post->ID,
				'title'      => html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' ),
				'url'        => get_permalink( $post ),
				'slug'       => $post->post_name,
				'excerpt'    => html_entity_decode( wp_trim_words( $post->post_excerpt !== '' ? $post->post_excerpt : $post->post_content, 30, '…' ), ENT_QUOTES, 'UTF-8' ),
				'type'       => $post->post_type,
				'type_label' => self::content_type_label( $post->post_type ),
				'base_rank'  => $position,
			);
		}

		return $results;
	}

	// ── OpenRouter sentiment / intent ────────────────────────────

	/**
	 * @param string $query
	 * @return array{intent:string,keywords:array<string>,sentiment:string}
	 */
	private static function openrouter_analyze( string $query ): array {
		$fallback = array(
			'intent'    => 'informational',
			'keywords'  => array_filter( explode( ' ', strtolower( $query ) ) ),
			'sentiment' => 'neutral',
		);

		if ( Flowbie_Wp_OpenRouter::get_api_key() === '' ) {
			return $fallback;
		}

		$system = 'You are a WordPress site search assistant. Given a user search query, respond with ONLY valid JSON (no markdown, no explanation): {"intent":"informational|navigational|transactional","keywords":["keyword1","keyword2"],"sentiment":"positive|neutral|negative"}. Rules for keywords: extract 2-4 terms that should be used to FIND the right WordPress content. Prefer terms that match static PAGES and service/location URLs (contact, services, service-area city names), not blog post topics, unless the user clearly wants articles. For navigational queries like "contact page", keywords should be the page name (e.g. ["contact"]). For location queries, include city or "service area" terms. Think: page TITLE, SLUG, or URL path segment.';

		$result = Flowbie_Wp_OpenRouter::complete( $system, $query, 150, 0.1 );

		if ( is_wp_error( $result ) ) {
			return $fallback;
		}

		$text = trim( (string) $result );
		if ( strpos( $text, '```' ) !== false ) {
			$text = preg_replace( '/```(?:json)?\s*/i', '', $text );
			$text = preg_replace( '/```/', '', $text );
			$text = trim( $text );
		}

		$parsed = json_decode( $text, true );
		if ( ! is_array( $parsed ) ) {
			return $fallback;
		}

		return array(
			'intent'    => isset( $parsed['intent'] ) && is_string( $parsed['intent'] ) ? $parsed['intent'] : $fallback['intent'],
			'keywords'  => isset( $parsed['keywords'] ) && is_array( $parsed['keywords'] ) ? array_map( 'strval', $parsed['keywords'] ) : $fallback['keywords'],
			'sentiment' => isset( $parsed['sentiment'] ) && is_string( $parsed['sentiment'] ) ? $parsed['sentiment'] : $fallback['sentiment'],
		);
	}

	/**
	 * @param string $query Raw search input.
	 */
	private static function openrouter_query_has_complete_word( string $query ): bool {
		if ( Flowbie_Wp_OpenRouter::get_api_key() === '' ) {
			return false;
		}

		$system = 'You judge whether a search box input contains at least one complete, correctly spelled real word (English or a proper noun). Partial mid-word typing is not ready. Trailing space is optional. Respond with ONLY valid JSON (no markdown): {"ready": true} or {"ready": false}. Examples: "plu" false, "plumber" true, "plumber edmonton" true, "plumber ed" true when "plumber" is complete, "asdfgh" false.';

		$result = Flowbie_Wp_OpenRouter::complete( $system, $query, 64, 0.0 );
		if ( is_wp_error( $result ) ) {
			return false;
		}

		$text = trim( (string) $result );
		if ( strpos( $text, '```' ) !== false ) {
			$text = preg_replace( '/```(?:json)?\s*/i', '', $text );
			$text = preg_replace( '/```/', '', $text );
			$text = trim( (string) $text );
		}

		$parsed = json_decode( $text, true );
		if ( ! is_array( $parsed ) || ! array_key_exists( 'ready', $parsed ) ) {
			return false;
		}

		return (bool) $parsed['ready'];
	}

	// ── Ranking ──────────────────────────────────────────────────

	/**
	 * Boost pages and service-area URLs over blog posts (filterable).
	 *
	 * @param array<string,mixed> $item Result row with type, slug, url.
	 * @return int
	 */
	private static function content_priority_boost( array $item ): int {
		$type = isset( $item['type'] ) ? (string) $item['type'] : '';
		$url  = isset( $item['url'] ) ? strtolower( (string) $item['url'] ) : '';
		$slug = isset( $item['slug'] ) ? strtolower( (string) $item['slug'] ) : '';

		$boost = 0;

		if ( $type === 'page' ) {
			$boost += 45;
			if ( self::is_money_page_slug( $slug ) ) {
				$boost += 25;
			}
		} elseif ( $type === 'service-area' || self::is_service_area_url( $url, $slug ) ) {
			$boost += 32;
		} elseif ( $type === 'post' ) {
			$boost -= 18;
		} else {
			$boost += 10;
		}

		/**
		 * Adjust content-type priority boost for a search result.
		 *
		 * @param int                 $boost Points added to relevance score.
		 * @param array<string,mixed> $item  Result row.
		 */
		return (int) apply_filters( 'flowbie_wp_search_content_boost', $boost, $item );
	}

	/**
	 * @param string $slug Post slug.
	 */
	private static function is_money_page_slug( string $slug ): bool {
		if ( $slug === '' ) {
			return false;
		}

		$money_slugs = apply_filters(
			'flowbie_wp_search_money_page_slugs',
			array(
				'contact',
				'about',
				'about-us',
				'services',
				'our-services',
				'service',
				'pricing',
				'quote',
				'get-started',
				'locations',
				'team',
				'careers',
				'work-with-us',
				'portfolio',
				'our-work',
			)
		);

		foreach ( $money_slugs as $needle ) {
			$needle = strtolower( (string) $needle );
			if ( $needle === '' ) {
				continue;
			}
			if ( $slug === $needle || strpos( $slug, $needle ) !== false ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * @param string $url  Permalink.
	 * @param string $slug Post slug.
	 */
	private static function is_service_area_url( string $url, string $slug ): bool {
		if ( strpos( $url, '/service-area/' ) !== false || strpos( $url, '/service-areas/' ) !== false ) {
			return true;
		}
		if ( strpos( $slug, 'service-area' ) !== false || strpos( $slug, 'service_area' ) !== false ) {
			return true;
		}
		return false;
	}

	/**
	 * @param array<int,array<string,mixed>> $wp_results
	 * @param array{intent:string,keywords:array<string>,sentiment:string} $ai
	 * @param int $limit
	 * @return array<int,array<string,mixed>>
	 */
	private static function rank_results( array $wp_results, array $ai, int $limit ): array {
		if ( empty( $wp_results ) ) {
			return array();
		}

		$keywords = array_map( 'strtolower', $ai['keywords'] );
		$intent   = $ai['intent'];

		foreach ( $wp_results as &$item ) {
			$score       = max( 0, 100 - ( (int) $item['base_rank'] * 3 ) );
			$title_lower = strtolower( (string) $item['title'] );
			$url_lower   = isset( $item['url'] ) ? strtolower( (string) $item['url'] ) : '';
			$slug_lower  = isset( $item['slug'] ) ? strtolower( (string) $item['slug'] ) : '';
			$haystack    = $title_lower . ' ' . strtolower( (string) $item['excerpt'] ) . ' ' . $slug_lower;

			$score += self::content_priority_boost( $item );

			foreach ( $keywords as $kw ) {
				if ( $kw === '' ) {
					continue;
				}
				if ( stripos( $title_lower, $kw ) !== false ) {
					$score += 40;
				}
				if ( stripos( $haystack, $kw ) !== false ) {
					$score += 15;
				}
				if ( stripos( $url_lower, $kw ) !== false ) {
					$score += 20;
				}
			}

			if ( $intent === 'navigational' ) {
				if ( $item['type'] === 'page' || self::is_service_area_url( $url_lower, $slug_lower ) ) {
					$score += 25;
				}
				if ( $item['type'] === 'post' ) {
					$score -= 12;
				}
				foreach ( $keywords as $kw ) {
					if ( $kw !== '' && stripos( $title_lower, $kw ) !== false ) {
						$score += 30;
					}
				}
			}

			if ( $intent === 'transactional' ) {
				if ( $item['type'] === 'page' || self::is_service_area_url( $url_lower, $slug_lower ) ) {
					$score += 22;
				}
				if ( in_array( $item['type'], array( 'product', 'download' ), true ) ) {
					$score += 25;
				}
				if ( $item['type'] === 'post' ) {
					$score -= 10;
				}
			}

			if ( $intent === 'informational' && $item['type'] === 'post' ) {
				$score += 8;
			}

			$item['score'] = $score;
			unset( $item['base_rank'] );
		}
		unset( $item );

		usort( $wp_results, static function ( $a, $b ) {
			return (int) $b['score'] - (int) $a['score'];
		} );

		return array_slice( $wp_results, 0, $limit );
	}

	private static function render_icon_sprite_templates(): string {
		ob_start();
		foreach ( Flowbie_Wp_Search_Icons::ids() as $icon_id ) {
			?>
			<template class="fbs__icon-sprite" data-icon="<?php echo esc_attr( $icon_id ); ?>">
				<?php echo Flowbie_Wp_Search_Icons::render( $icon_id, array( 'width' => 20, 'height' => 20 ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- inline SVG ?>
			</template>
			<?php
		}
		return (string) ob_get_clean();
	}

	/**
	 * @param string              $section Insight section key.
	 * @param array<string,mixed> $insights Resolved insights config.
	 */
	private static function render_insight_block( string $section, array $insights, bool $preview_demo = false, bool $is_discovery = false, bool $reserve_slot = false ): string {
		$toggles = array(
			'popular_terms'          => 'show_popular_terms',
			'popular_pages_overseer' => 'show_popular_pages_overseer',
			'popular_pages_search'   => 'show_popular_pages_search',
			'popular_topics'         => 'show_popular_pages_overseer',
		);
		if ( ! isset( $toggles[ $section ] ) ) {
			return '';
		}
		if ( ! $preview_demo && ! $reserve_slot && empty( $insights[ $toggles[ $section ] ] ) ) {
			return '';
		}

		$labels = array(
			'popular_terms'          => __( 'Popular searches', 'flowbie-wp' ),
			'popular_pages_overseer' => __( 'General pages', 'flowbie-wp' ),
			'popular_pages_search'   => __( 'From search', 'flowbie-wp' ),
			'popular_topics'         => __( 'Popular Topics', 'flowbie-wp' ),
		);

		$list_class  = $section === 'popular_topics' ? 'fbs__insights-list fbs__topics-grid' : 'fbs__insights-list';
		$label_class = $section === 'popular_topics' ? 'fbs__insights-label fbs__insights-label--topics' : 'fbs__insights-label';
		if ( $section === 'popular_terms' ) {
			$list_class .= ' fbs__insights-list--terms';
		}
		if ( in_array( $section, array( 'popular_pages_overseer', 'popular_pages_search' ), true ) ) {
			$list_class .= ' fbs__insights-list--links';
		}

		$block_class = 'fbs__insights-block';
		if ( $reserve_slot ) {
			$block_class .= ' fbs__insights-block--slot';
		}
		$hidden_attr = ( $preview_demo || $reserve_slot ) ? '' : ' hidden';
		$demo_attr   = $preview_demo ? ' data-elementor-demo="1"' : '';

		$list_markup = '';
		if ( $preview_demo ) {
			$list_markup = self::render_elementor_preview_insight_list( $section );
		}

		return sprintf(
			'<div class="%8$s" data-insight="%1$s"%5$s%6$s><div class="%3$s">%2$s</div><div class="%4$s" role="list">%7$s</div></div>',
			esc_attr( $section ),
			esc_html( $labels[ $section ] ),
			esc_attr( $label_class ),
			esc_attr( $list_class ),
			$hidden_attr,
			$demo_attr,
			$list_markup,
			esc_attr( $block_class )
		);
	}

	private static function render_elementor_preview_insight_list( string $section ): string {
		if ( $section === 'popular_terms' ) {
			$terms = array( 'Lorem ipsum', 'Dolor sit amet', 'Consectetur', 'Adipiscing elit', 'Sed eiusmod' );
			$out   = '';
			foreach ( $terms as $term ) {
				$out .= sprintf(
					'<button type="button" class="fbs__insight-chip" tabindex="-1">%s</button>',
					esc_html( $term )
				);
			}
			return $out;
		}

		if ( $section === 'popular_topics' ) {
			$topics = array( 'Lorem Topic', 'Ipsum Pages', 'Dolor Guides', 'Sit Resources' );
			$out    = '';
			foreach ( $topics as $topic ) {
				$out .= sprintf(
					'<a class="fbs__topic-tile" href="#" tabindex="-1"><span class="fbs__topic-label">%s</span></a>',
					esc_html( $topic )
				);
			}
			return $out;
		}

		$pages = array(
			'Lorem ipsum dolor',
			'Sit amet consectetur',
			'Adipiscing elit sed',
			'Eiusmod tempor incididunt',
		);
		$out   = '';
		foreach ( $pages as $page ) {
			$out .= sprintf(
				'<a class="fbs__insight-link" href="#" tabindex="-1">%s</a>',
				esc_html( $page )
			);
		}
		return $out;
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function handle_search_log( WP_REST_Request $request ) {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			$body = array();
		}

		$result = Flowbie_Wp_Search_Logs::insert(
			array(
				'session_id'   => isset( $body['session_id'] ) ? (string) $body['session_id'] : '',
				'page_url'     => isset( $body['page_url'] ) ? (string) $body['page_url'] : '',
				'query'        => isset( $body['query'] ) ? (string) $body['query'] : '',
				'result_count' => isset( $body['result_count'] ) ? (int) $body['result_count'] : 0,
				'intent'       => isset( $body['intent'] ) ? (string) $body['intent'] : '',
				'sentiment'    => isset( $body['sentiment'] ) ? (string) $body['sentiment'] : '',
				'results'      => isset( $body['results'] ) && is_array( $body['results'] ) ? $body['results'] : array(),
			)
		);

		if ( empty( $result['ok'] ) ) {
			$status = ( isset( $result['error'] ) && $result['error'] === 'logging_disabled' ) ? 200 : 400;
			return new WP_REST_Response( $result, $status );
		}

		return new WP_REST_Response(
			array(
				'ok'       => true,
				'eventUid' => $result['event_uid'],
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function handle_search_accept( WP_REST_Request $request ) {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			$body = array();
		}

		$result = Flowbie_Wp_Search_Logs::record_accept(
			array(
				'event_uid' => isset( $body['eventUid'] ) ? (string) $body['eventUid'] : '',
				'url'       => isset( $body['url'] ) ? (string) $body['url'] : '',
				'title'     => isset( $body['title'] ) ? (string) $body['title'] : '',
				'rank'      => isset( $body['rank'] ) ? (int) $body['rank'] : 0,
			)
		);

		if ( empty( $result['ok'] ) ) {
			$status = ( isset( $result['error'] ) && $result['error'] === 'logging_disabled' ) ? 200 : 400;
			return new WP_REST_Response( $result, $status );
		}

		return new WP_REST_Response( array( 'ok' => true ), 200 );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function handle_search_insights( WP_REST_Request $request ): WP_REST_Response {
		$days  = (int) $request->get_param( 'days' );
		$limit = (int) $request->get_param( 'limit' );
		if ( $days < 1 ) {
			$days = 30;
		}
		if ( $limit < 1 ) {
			$limit = 5;
		}

		$insights = Flowbie_Wp_Ai_Widget_Design::resolve_search_insights( array() );

		$payload = array(
			'popularTerms'            => array(),
			'popularPagesOverseer'    => array(),
			'popularPagesFromSearch'  => array(),
		);

		if ( ! empty( $insights['show_popular_terms'] ) ) {
			$payload['popularTerms'] = Flowbie_Wp_Search_Logs::aggregate_popular_terms_curated( $days, $limit );
		}
		if ( ! empty( $insights['show_popular_pages_overseer'] ) ) {
			$payload['popularPagesOverseer'] = Flowbie_Wp_Search_Logs::aggregate_popular_pages_overseer( $days, $limit );
		}
		if ( ! empty( $insights['show_popular_pages_search'] ) ) {
			$payload['popularPagesFromSearch'] = Flowbie_Wp_Search_Logs::aggregate_popular_pages_from_search( $days, $limit );
		}

		return new WP_REST_Response( $payload, 200 );
	}
}
