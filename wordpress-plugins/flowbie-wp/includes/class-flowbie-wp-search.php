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
		$settings  = self::merge_instance_settings( $instance );
		$wrap_class = self::build_wrap_class( $instance );
		$css_vars   = self::build_css_vars( $settings, $instance );
		$rest_url   = esc_url( rest_url( self::REST_NAMESPACE . '/search' ) );
		$nonce      = wp_create_nonce( 'wp_rest' );

		self::enqueue_search_assets();

		return self::render_search_markup(
			$wrap_class,
			$css_vars,
			$rest_url,
			$nonce,
			$settings,
			$instance
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
	 */
	private static function build_wrap_class( array $instance ): string {
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

		return $wrap_class;
	}

	/**
	 * @param array<string,mixed> $settings
	 * @param array<string,mixed> $instance
	 */
	private static function build_css_vars( array $settings, array $instance ): string {
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

		return Flowbie_Wp_Ai_Widget_Design::build_search_css_vars( $tokens, $instance );
	}

	/**
	 * Register front-end search assets (for Elementor depends + lazy enqueue).
	 */
	public static function register_search_assets(): void {
		$asset_ver = self::search_asset_version();
		$base_url  = plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE );

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
	 */
	public static function enqueue_search_assets(): void {
		self::register_search_assets();
		wp_enqueue_style( 'flowbie-wp-lato' );
		wp_enqueue_style( 'flowbie-search' );
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
		array $instance = array()
	): string {
		$placeholder  = isset( $settings['placeholder'] ) ? (string) $settings['placeholder'] : '';
		$button_label = isset( $settings['button_label'] ) ? (string) $settings['button_label'] : '';
		$max_results  = isset( $settings['max_results'] ) ? (int) $settings['max_results'] : 8;
		$min_query    = isset( $instance['min_query'] ) ? max( 1, min( 5, (int) $instance['min_query'] ) ) : 2;

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

		$icon_svg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>';

		$hide_clear = empty( $design_ui['clear_button'] );

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

		ob_start();
		?>
		<div
			class="<?php echo esc_attr( $wrap_class . $extra_classes ); ?>"
			style="<?php echo esc_attr( $css_vars ); ?>"
			data-rest-url="<?php echo esc_url( $rest_url ); ?>"
			data-nonce="<?php echo esc_attr( $nonce ); ?>"
			data-placeholder="<?php echo esc_attr( $placeholder ); ?>"
			data-button-label="<?php echo esc_attr( $button_label ); ?>"
			data-max-results="<?php echo (int) $max_results; ?>"
			data-min-query="<?php echo (int) $min_query; ?>"
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
		>
			<div class="fbs">
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
				<div class="fbs__panel">
					<div class="fbs__dropdown" role="listbox" hidden style="display:none;"></div>
					<div class="fbs__status" aria-live="polite" style="display:none;"></div>
				</div>
				<a class="fbs__powered" href="https://flowbie.ca" target="_blank" rel="noopener noreferrer">
					<svg class="fbs__powered-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M11.3 1.05a1 1 0 0 0-1.6 0L5.7 7H2a1 1 0 0 0-.8 1.6l4 5.5a1 1 0 0 0 .8.4h2.2l-1.1 3.9a.75.75 0 0 0 1.3.7l6-7A1 1 0 0 0 14.6 11H12l1.9-5.2A1 1 0 0 0 13 4.5h-1.8l.1-3.45z"/></svg>
					<?php esc_html_e( 'Powered by', 'flowbie-wp' ); ?> <strong>Flowbie</strong>
				</a>
			</div>
		</div>
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
}
