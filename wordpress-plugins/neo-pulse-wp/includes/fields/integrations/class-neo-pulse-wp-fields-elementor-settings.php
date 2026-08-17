<?php
/**
 * Elementor dynamic tags settings for NEO Pulse Fields.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Elementor_Settings {

	const OPTION_KEY = 'neo_pulse_wp_fields_elementor_settings';

	/** @var bool */
	private static $force_options_tags = false;

	public static function force_options_tags_for_migration( bool $force ): void {
		self::$force_options_tags = $force;
	}

	public static function force_options_tags_active(): bool {
		return self::$force_options_tags;
	}

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

	public static function is_enabled(): bool {
		$config = self::get_config();
		return ! empty( $config['enabled'] );
	}

	public static function post_tags_enabled(): bool {
		$config = self::get_config();
		return self::is_enabled() && ! empty( $config['enable_post_tags'] );
	}

	public static function options_tags_enabled(): bool {
		if ( self::$force_options_tags ) {
			return true;
		}
		$config = self::get_config();
		return self::is_enabled() && ! empty( $config['enable_options_tags'] );
	}

	public static function show_layout_fields(): bool {
		$config = self::get_config();
		return ! empty( $config['show_layout_fields'] );
	}

	public static function field_picker_scope(): string {
		$config = self::get_config();
		$scope  = (string) ( $config['field_picker_scope'] ?? 'all' );
		return $scope === 'location' ? 'location' : 'all';
	}

	public static function use_unified_field_picker(): bool {
		return self::field_picker_scope() === 'all';
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function default_config(): array {
		return array(
			'enabled'              => true,
			'enable_post_tags'     => true,
			'enable_options_tags'  => true,
			'show_layout_fields'   => false,
			'field_picker_scope'   => 'all',
		);
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
		$scope  = (string) ( $merged['field_picker_scope'] ?? 'all' );
		return array(
			'enabled'              => ! empty( $merged['enabled'] ),
			'enable_post_tags'       => ! empty( $merged['enable_post_tags'] ),
			'enable_options_tags'    => ! empty( $merged['enable_options_tags'] ),
			'show_layout_fields'     => ! empty( $merged['show_layout_fields'] ),
			'field_picker_scope'     => $scope === 'location' ? 'location' : 'all',
		);
	}

	public static function expected_registered_tag_count(): int {
		$count = 0;
		if ( self::post_tags_enabled() ) {
			$count += 4;
		}
		if ( self::options_tags_enabled() ) {
			$count += 4;
		}
		if ( self::$force_options_tags && $count < 4 ) {
			$count += 4;
		}
		return $count;
	}

	public static function maybe_bootstrap_defaults(): void {
		if ( get_option( self::OPTION_KEY, null ) !== null ) {
			return;
		}
		self::save_config( self::default_config() );
	}
}
