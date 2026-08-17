<?php
/**
 * Speed module settings storage.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Manages neo_pulse_wp_speed_settings option.
 */
class Neo_Pulse_Wp_Speed_Settings {

	const OPTION_KEY = 'neo_pulse_wp_speed_settings';

	const ELEMENTOR_SAFE_MIGRATION_KEY = 'neo_pulse_wp_speed_elementor_safe_defaults';

	const ELEMENTOR_SAFE_MIGRATION_V2_KEY = 'neo_pulse_wp_speed_elementor_safe_defaults_v2';

	const SIMPLE_ENABLED_REPAIR_KEY = 'neo_pulse_wp_speed_simple_enabled_repair_v1';

	const SIMPLE_ENABLED_REPAIR_V2_KEY = 'neo_pulse_wp_speed_simple_enabled_repair_v2';

	const SIMPLE_ENABLED_REPAIR_V3_KEY = 'neo_pulse_wp_speed_simple_enabled_repair_v3';

	const DEFAULT_ON_MIGRATION_KEY = 'neo_pulse_wp_speed_default_on_v4';

	/**
	 * @return array<string, mixed>
	 */
	public static function get_config(): array {
		$raw = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}
		return self::sanitize_config( self::merge_with_defaults( $raw ) );
	}

	/**
	 * @param array<string, mixed> $config Config.
	 */
	public static function save_config( array $config ): void {
		$sanitized = self::sanitize_config( self::merge_with_defaults( $config ) );
		if ( get_option( self::OPTION_KEY, null ) === null ) {
			add_option( self::OPTION_KEY, $sanitized, '', false );
		} else {
			update_option( self::OPTION_KEY, $sanitized, false );
		}
	}

	/**
	 * Safe transform flags when Speed is enabled from the simple admin UI.
	 *
	 * @param array<string, mixed> $config Config.
	 * @return array<string, mixed>
	 */
	public static function apply_simple_enabled_config( array $config ): array {
		$config['enabled']              = true;
		$config['optimize_css']         = true;
		$config['optimize_js']          = true;
		$config['minify_html']          = ! defined( 'ELEMENTOR_VERSION' );
		$config['aggregate_css']        = false;
		$config['aggregate_js']         = false;
		$config['defer_js']             = true;
		$config['font_display_swap']    = true;
		$config['preconnect_fonts']     = true;
		$config['async_google_fonts']   = true;
		$config['remove_query_strings'] = false;
		$config['bypass_elementor']     = defined( 'ELEMENTOR_VERSION' );
		return $config;
	}

	/**
	 * @return bool
	 */
	public static function is_enabled(): bool {
		$config = self::get_config();
		return ! empty( $config['enabled'] );
	}

	/**
	 * Fresh-install / merge baseline (Speed off until enabled in admin).
	 *
	 * @return array<string, mixed>
	 */
	public static function default_config(): array {
		return array(
			'enabled'              => false,
			'optimize_css'         => true,
			'optimize_js'          => true,
			'minify_html'          => ! defined( 'ELEMENTOR_VERSION' ),
			'aggregate_css'        => false,
			'aggregate_js'         => false,
			'defer_js'             => true,
			'font_display_swap'    => true,
			'preconnect_fonts'     => true,
			'async_google_fonts'   => true,
			'skip_logged_in'       => true,
			'bypass_elementor'     => defined( 'ELEMENTOR_VERSION' ),
			'cache_ttl'            => WEEK_IN_SECONDS,
			'remove_query_strings' => false,
			'js_exclude'           => '',
			'css_exclude'          => '',
			'imported_autoptimize' => false,
		);
	}

	/**
	 * Sanitized config for activation and default-on migration.
	 *
	 * @return array<string, mixed>
	 */
	public static function default_enabled_config(): array {
		return self::sanitize_config( self::apply_simple_enabled_config( self::default_config() ) );
	}

	/**
	 * Seed Speed settings on first plugin activation when no option exists.
	 */
	public static function seed_default_config_if_missing(): void {
		if ( get_option( self::OPTION_KEY, null ) !== null ) {
			return;
		}
		self::save_config( self::sanitize_config( self::merge_with_defaults( array() ) ) );
	}

	/**
	 * Legacy hook: no longer auto-enables Speed on existing sites.
	 */
	public static function maybe_enable_speed_by_default(): void {
		if ( get_option( self::DEFAULT_ON_MIGRATION_KEY, '' ) === '1' ) {
			return;
		}
		update_option( self::DEFAULT_ON_MIGRATION_KEY, '1', false );
	}

	/**
	 * @param array<string, mixed> $raw Raw saved config.
	 * @return array<string, mixed>
	 */
	public static function merge_with_defaults( array $raw ): array {
		return wp_parse_args( $raw, self::default_config() );
	}

	/**
	 * @param array<string, mixed> $raw Raw config.
	 * @return array<string, mixed>
	 */
	public static function sanitize_config( array $raw ): array {
		$merged = self::merge_with_defaults( $raw );

		$ttl = (int) ( $merged['cache_ttl'] ?? WEEK_IN_SECONDS );
		if ( $ttl < HOUR_IN_SECONDS ) {
			$ttl = HOUR_IN_SECONDS;
		}
		if ( $ttl > 30 * DAY_IN_SECONDS ) {
			$ttl = 30 * DAY_IN_SECONDS;
		}

		return array(
			'enabled'              => ! empty( $merged['enabled'] ),
			'optimize_css'         => ! empty( $merged['optimize_css'] ),
			'optimize_js'          => ! empty( $merged['optimize_js'] ),
			'minify_html'          => ! empty( $merged['minify_html'] ),
			'aggregate_css'        => ! empty( $merged['aggregate_css'] ),
			'aggregate_js'         => ! empty( $merged['aggregate_js'] ),
			'defer_js'             => ! empty( $merged['defer_js'] ),
			'font_display_swap'    => ! empty( $merged['font_display_swap'] ),
			'preconnect_fonts'     => ! empty( $merged['preconnect_fonts'] ),
			'async_google_fonts'   => ! empty( $merged['async_google_fonts'] ),
			'skip_logged_in'       => ! empty( $merged['skip_logged_in'] ),
			'bypass_elementor'     => ! empty( $merged['bypass_elementor'] ),
			'cache_ttl'            => $ttl,
			'remove_query_strings' => ! empty( $merged['remove_query_strings'] ),
			'js_exclude'           => self::sanitize_exclude_lines( (string) ( $merged['js_exclude'] ?? '' ) ),
			'css_exclude'          => self::sanitize_exclude_lines( (string) ( $merged['css_exclude'] ?? '' ) ),
			'imported_autoptimize' => ! empty( $merged['imported_autoptimize'] ),
		);
	}

	/**
	 * @param string $raw Comma or newline separated patterns.
	 */
	public static function sanitize_exclude_lines( string $raw ): string {
		$parts = preg_split( '/[\r\n,]+/', $raw );
		if ( ! is_array( $parts ) ) {
			return '';
		}
		$lines = array();
		foreach ( $parts as $part ) {
			$line = trim( (string) $part );
			if ( $line !== '' ) {
				$lines[] = $line;
			}
		}
		return implode( "\n", array_unique( $lines ) );
	}

	/**
	 * @param string $raw Exclude string.
	 * @return array<int, string>
	 */
	public static function parse_exclude_lines( string $raw ): array {
		if ( trim( $raw ) === '' ) {
			return array();
		}
		$out = array();
		foreach ( preg_split( '/[\r\n,]+/', $raw ) ?: array() as $line ) {
			$line = trim( (string) $line );
			if ( $line !== '' ) {
				$out[] = $line;
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * Detect conflicting optimization plugins.
	 *
	 * @return array<int, string>
	 */
	public static function conflicting_plugins(): array {
		$conflicts = array();
		if ( defined( 'AUTOPTIMIZE_PLUGIN_VERSION' ) || class_exists( 'autoptimizeMain', false ) ) {
			$conflicts[] = 'Autoptimize';
		}
		if ( defined( 'WP_ROCKET_VERSION' ) ) {
			$conflicts[] = 'WP Rocket';
		}
		if ( defined( 'W3TC' ) ) {
			$conflicts[] = 'W3 Total Cache';
		}
		if ( defined( 'LSCWP_V' ) ) {
			$conflicts[] = 'LiteSpeed Cache';
		}
		return $conflicts;
	}

	/**
	 * One-time import from Autoptimize options when enabling.
	 */
	public static function maybe_import_autoptimize(): void {
		$config = self::get_config();
		if ( ! empty( $config['imported_autoptimize'] ) ) {
			return;
		}

		$ao_css = get_option( 'autoptimize_css', '' );
		$ao_js  = get_option( 'autoptimize_js', '' );
		if ( $ao_css === '' && $ao_js === '' && ! get_option( 'autoptimize_html', false ) ) {
			return;
		}

		$config['optimize_css']  = ( 'on' === $ao_css || '1' === $ao_css );
		$config['optimize_js']   = ( 'on' === $ao_js || '1' === $ao_js );
		$config['minify_html']   = (bool) get_option( 'autoptimize_html', false );
		$config['aggregate_css'] = (bool) get_option( 'autoptimize_css_aggregate', false );
		$config['aggregate_js']  = (bool) get_option( 'autoptimize_js_aggregate', false );
		$config['defer_js']      = (bool) get_option( 'autoptimize_js_defer', false );

		$js_exclude = get_option( 'autoptimize_js_exclude', '' );
		if ( is_string( $js_exclude ) && trim( $js_exclude ) !== '' ) {
			$existing = self::parse_exclude_lines( (string) ( $config['js_exclude'] ?? '' ) );
			$ao_parts = array_map( 'trim', explode( ',', $js_exclude ) );
			$config['js_exclude'] = self::sanitize_exclude_lines(
				implode( "\n", array_unique( array_merge( $existing, array_filter( $ao_parts ) ) ) )
			);
		}

		$css_exclude = get_option( 'autoptimize_css_exclude', '' );
		if ( is_string( $css_exclude ) && trim( $css_exclude ) !== '' ) {
			$existing = self::parse_exclude_lines( (string) ( $config['css_exclude'] ?? '' ) );
			$ao_parts = array_map( 'trim', explode( ',', $css_exclude ) );
			$config['css_exclude'] = self::sanitize_exclude_lines(
				implode( "\n", array_unique( array_merge( $existing, array_filter( $ao_parts ) ) ) )
			);
		}

		$config['imported_autoptimize'] = true;
		self::save_config( $config );

		if ( defined( 'ELEMENTOR_VERSION' ) ) {
			self::maybe_migrate_elementor_safe_defaults();
		}
	}

	/**
	 * One-time: turn off combine/defer flags on Elementor sites (breaks inner pages for guests).
	 */
	public static function maybe_migrate_elementor_safe_defaults(): void {
		if ( get_option( self::ELEMENTOR_SAFE_MIGRATION_KEY, '' ) === '1' ) {
			return;
		}

		if ( ! defined( 'ELEMENTOR_VERSION' ) ) {
			update_option( self::ELEMENTOR_SAFE_MIGRATION_KEY, '1', false );
			return;
		}

		$raw = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}

		$changed = false;
		foreach ( array( 'aggregate_css', 'aggregate_js', 'defer_js' ) as $key ) {
			if ( ! empty( $raw[ $key ] ) ) {
				$raw[ $key ] = false;
				$changed     = true;
			}
		}

		if ( $changed ) {
			update_option( self::OPTION_KEY, self::sanitize_config( self::merge_with_defaults( $raw ) ), false );
			if ( class_exists( 'Neo_Pulse_Wp_Speed', false ) ) {
				Neo_Pulse_Wp_Speed::flush_cache();
			}
		}

		update_option( self::ELEMENTOR_SAFE_MIGRATION_KEY, '1', false );

		self::maybe_migrate_elementor_safe_defaults_v2();
	}

	/**
	 * Second pass: disable per-file/HTML optimization and enable Elementor page bypass.
	 */
	public static function maybe_migrate_elementor_safe_defaults_v2(): void {
		if ( get_option( self::ELEMENTOR_SAFE_MIGRATION_V2_KEY, '' ) === '1' ) {
			return;
		}

		if ( ! defined( 'ELEMENTOR_VERSION' ) ) {
			update_option( self::ELEMENTOR_SAFE_MIGRATION_V2_KEY, '1', false );
			return;
		}

		$raw = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}

		$raw['bypass_elementor'] = true;
		foreach ( array( 'optimize_css', 'optimize_js', 'minify_html', 'aggregate_css', 'aggregate_js', 'defer_js' ) as $key ) {
			$raw[ $key ] = false;
		}

		update_option( self::OPTION_KEY, self::sanitize_config( self::merge_with_defaults( $raw ) ), false );

		if ( class_exists( 'Neo_Pulse_Wp_Speed', false ) ) {
			Neo_Pulse_Wp_Speed::flush_cache();
		}
		if ( class_exists( 'Neo_Pulse_Wp_Search', false ) ) {
			Neo_Pulse_Wp_Search::purge_public_caches();
		}

		update_option( self::ELEMENTOR_SAFE_MIGRATION_V2_KEY, '1', false );
	}

	/**
	 * Repair sites where Speed was enabled from the simple UI but all transforms were off (no disk cache).
	 */
	public static function maybe_repair_simple_enabled_config(): void {
		if ( get_option( self::SIMPLE_ENABLED_REPAIR_KEY, '' ) === '1' ) {
			return;
		}

		$config = self::get_config();
		if ( empty( $config['enabled'] ) ) {
			update_option( self::SIMPLE_ENABLED_REPAIR_KEY, '1', false );
			return;
		}

		if ( class_exists( 'Neo_Pulse_Wp_Speed_Gate', false ) && Neo_Pulse_Wp_Speed_Gate::config_has_active_transforms( $config ) ) {
			update_option( self::SIMPLE_ENABLED_REPAIR_KEY, '1', false );
			return;
		}

		self::save_config( self::apply_simple_enabled_config( $config ) );
		update_option( self::SIMPLE_ENABLED_REPAIR_KEY, '1', false );
	}

	/**
	 * Repair Elementor sites stuck with bypass on or transforms off while Speed is enabled.
	 */
	public static function maybe_repair_simple_enabled_config_v2(): void {
		if ( get_option( self::SIMPLE_ENABLED_REPAIR_V2_KEY, '' ) === '1' ) {
			return;
		}

		$config = self::get_config();
		if ( empty( $config['enabled'] ) ) {
			update_option( self::SIMPLE_ENABLED_REPAIR_V2_KEY, '1', false );
			return;
		}

		$needs_repair = ! empty( $config['bypass_elementor'] )
			|| empty( $config['optimize_css'] )
			|| empty( $config['optimize_js'] );

		if ( ! $needs_repair ) {
			update_option( self::SIMPLE_ENABLED_REPAIR_V2_KEY, '1', false );
			return;
		}

		self::save_config( self::apply_simple_enabled_config( $config ) );
		if ( class_exists( 'Neo_Pulse_Wp_Speed_Warm', false ) ) {
			Neo_Pulse_Wp_Speed_Warm::warm_disk_cache();
		}
		update_option( self::SIMPLE_ENABLED_REPAIR_V2_KEY, '1', false );
	}

	/**
	 * Enable safe font/defer defaults on sites that enabled Speed before perf flags existed.
	 */
	public static function maybe_repair_simple_enabled_config_v3(): void {
		if ( get_option( self::SIMPLE_ENABLED_REPAIR_V3_KEY, '' ) === '1' ) {
			return;
		}

		$config = self::get_config();
		if ( empty( $config['enabled'] ) ) {
			update_option( self::SIMPLE_ENABLED_REPAIR_V3_KEY, '1', false );
			return;
		}

		$needs_repair = empty( $config['font_display_swap'] )
			|| empty( $config['preconnect_fonts'] )
			|| empty( $config['async_google_fonts'] )
			|| empty( $config['defer_js'] );

		if ( ! $needs_repair ) {
			update_option( self::SIMPLE_ENABLED_REPAIR_V3_KEY, '1', false );
			return;
		}

		self::save_config( self::apply_simple_enabled_config( $config ) );
		if ( class_exists( 'Neo_Pulse_Wp_Speed_Warm', false ) ) {
			Neo_Pulse_Wp_Speed_Warm::warm_disk_cache();
		}
		update_option( self::SIMPLE_ENABLED_REPAIR_V3_KEY, '1', false );
	}
}
