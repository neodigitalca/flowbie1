<?php
/**
 * Speed image optimization settings.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Manages neo_pulse_wp_speed_image_settings option.
 */
class Neo_Pulse_Wp_Speed_Image_Settings {

	const OPTION_KEY = 'neo_pulse_wp_speed_image_settings';

	const META_KEY = '_neo_pulse_speed_img';

	const VERSION_META = '_neo_pulse_speed_img_version';

	const META_VERSION = '1';

	/**
	 * @return array<string, mixed>
	 */
	public static function default_config(): array {
		return array(
			'enabled'         => false,
			'auto_on_upload'  => true,
			'jpeg_quality'    => 82,
			'png_compression' => 6,
			'max_width'       => 2560,
			'max_height'      => 2560,
			'generate_webp'   => true,
			'serve_webp'      => true,
			'optimize_sizes'  => 'full',
			'max_file_mb'     => 10,
			'skip_mimes'      => "image/svg+xml\nimage/gif",
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function get_config(): array {
		$raw = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}
		return self::sanitize_config( wp_parse_args( $raw, self::default_config() ) );
	}

	/**
	 * @param array<string, mixed> $config Config.
	 */
	public static function save_config( array $config ): void {
		$sanitized = self::sanitize_config( wp_parse_args( $config, self::default_config() ) );
		if ( get_option( self::OPTION_KEY, null ) === null ) {
			add_option( self::OPTION_KEY, $sanitized, '', false );
		} else {
			update_option( self::OPTION_KEY, $sanitized, false );
		}
	}

	/**
	 * @return bool
	 */
	public static function is_enabled(): bool {
		$config = self::get_config();
		return ! empty( $config['enabled'] );
	}

	/**
	 * @return bool
	 */
	public static function supports_webp_editor(): bool {
		return function_exists( 'wp_image_editor_supports' )
			&& wp_image_editor_supports( array( 'mime_type' => 'image/webp' ) );
	}

	/**
	 * @param array<string, mixed> $raw Raw config.
	 * @return array<string, mixed>
	 */
	public static function sanitize_config( array $raw ): array {
		$jpeg = isset( $raw['jpeg_quality'] ) ? (int) $raw['jpeg_quality'] : 82;
		$jpeg = max( 1, min( 100, $jpeg ) );

		$png = isset( $raw['png_compression'] ) ? (int) $raw['png_compression'] : 6;
		$png = max( 0, min( 9, $png ) );

		$max_w = isset( $raw['max_width'] ) ? (int) $raw['max_width'] : 2560;
		$max_h = isset( $raw['max_height'] ) ? (int) $raw['max_height'] : 2560;
		$max_w = max( 0, min( 10000, $max_w ) );
		$max_h = max( 0, min( 10000, $max_h ) );

		$mb = isset( $raw['max_file_mb'] ) ? (int) $raw['max_file_mb'] : 10;
		$mb = max( 1, min( 100, $mb ) );

		$sizes = isset( $raw['optimize_sizes'] ) ? sanitize_key( (string) $raw['optimize_sizes'] ) : 'full';
		if ( ! in_array( $sizes, array( 'full', 'all' ), true ) ) {
			$sizes = 'full';
		}

		return array(
			'enabled'         => ! empty( $raw['enabled'] ),
			'auto_on_upload'  => ! empty( $raw['auto_on_upload'] ),
			'jpeg_quality'    => $jpeg,
			'png_compression' => $png,
			'max_width'       => $max_w,
			'max_height'      => $max_h,
			'generate_webp'   => ! empty( $raw['generate_webp'] ),
			'serve_webp'      => ! empty( $raw['serve_webp'] ),
			'optimize_sizes'  => $sizes,
			'max_file_mb'     => $mb,
			'skip_mimes'      => self::sanitize_mime_lines( (string) ( $raw['skip_mimes'] ?? '' ) ),
		);
	}

	/**
	 * @param string $raw Mime lines.
	 */
	public static function sanitize_mime_lines( string $raw ): string {
		$lines = preg_split( '/[\r\n,]+/', $raw );
		if ( ! is_array( $lines ) ) {
			return '';
		}
		$out = array();
		foreach ( $lines as $line ) {
			$line = sanitize_text_field( trim( (string) $line ) );
			if ( $line !== '' && strpos( $line, 'image/' ) === 0 ) {
				$out[] = $line;
			}
		}
		return implode( "\n", array_unique( $out ) );
	}

	/**
	 * @return array<int, string>
	 */
	public static function skip_mime_list(): array {
		$config = self::get_config();
		$raw    = (string) ( $config['skip_mimes'] ?? '' );
		if ( trim( $raw ) === '' ) {
			return array();
		}
		$list = array();
		foreach ( preg_split( '/[\r\n,]+/', $raw ) ?: array() as $line ) {
			$line = trim( (string) $line );
			if ( $line !== '' ) {
				$list[] = $line;
			}
		}
		return $list;
	}

	/**
	 * @return array<int, string>
	 */
	public static function conflicting_plugins(): array {
		$conflicts = array();
		if ( defined( 'SHORTPIXEL_API_KEY' ) || class_exists( 'ShortPixelAI', false ) ) {
			$conflicts[] = 'ShortPixel';
		}
		if ( defined( 'WP_SMUSH_VERSION' ) ) {
			$conflicts[] = 'Smush';
		}
		if ( defined( 'EWWW_IMAGE_OPTIMIZER_VERSION' ) ) {
			$conflicts[] = 'EWWW Image Optimizer';
		}
		if ( defined( 'IMAGIFY_VERSION' ) ) {
			$conflicts[] = 'Imagify';
		}
		if ( defined( 'WPCF7_VERSION' ) && class_exists( 'Tiny_Compress', false ) ) {
			$conflicts[] = 'TinyPNG';
		}
		return $conflicts;
	}
}
