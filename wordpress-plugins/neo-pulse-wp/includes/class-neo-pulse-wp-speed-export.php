<?php
/**
 * Speed module settings JSON export.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Builds a shareable JSON snapshot of Speed + Speed Images settings.
 */
class Neo_Pulse_Wp_Speed_Export {

	/**
	 * @return array<string, mixed>
	 */
	public static function collect(): array {
		return array(
			'meta'         => self::meta(),
			'speed'        => Neo_Pulse_Wp_Speed_Settings::get_config(),
			'speed_images' => Neo_Pulse_Wp_Speed_Image_Settings::get_config(),
			'cache'        => Neo_Pulse_Wp_Speed_Cache::stats(),
		);
	}

	/**
	 * @return string
	 */
	public static function build_json(): string {
		$data = self::redact_secrets( self::collect() );
		$json = wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
		return is_string( $json ) ? $json : '{}';
	}

	/**
	 * @return string
	 */
	public static function download_filename(): string {
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		if ( ! is_string( $host ) || $host === '' ) {
			$host = 'site';
		}
		$host = sanitize_file_name( $host );
		return 'neo-pulse-speed-settings-' . $host . '-' . gmdate( 'Y-m-d' ) . '.json';
	}

	/**
	 * @return array<string, mixed>
	 */
	private static function meta(): array {
		$meta = array(
			'plugin_version' => defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '',
			'site_url'       => home_url( '/' ),
			'exported_at'    => gmdate( 'c' ),
			'wp_version'     => get_bloginfo( 'version' ),
		);
		if ( defined( 'ELEMENTOR_VERSION' ) ) {
			$meta['elementor_version'] = ELEMENTOR_VERSION;
		}
		return $meta;
	}

	/**
	 * @param mixed $value Value to redact recursively.
	 * @return mixed
	 */
	public static function redact_secrets( $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}
		$out = array();
		foreach ( $value as $key => $item ) {
			$key_str = is_string( $key ) ? strtolower( $key ) : '';
			if ( $key_str !== '' && self::is_secret_key( $key_str ) && is_scalar( $item ) && (string) $item !== '' ) {
				$out[ $key ] = '__REDACTED__';
				continue;
			}
			$out[ $key ] = is_array( $item ) ? self::redact_secrets( $item ) : $item;
		}
		return $out;
	}

	/**
	 * @param string $key Lowercase key name.
	 */
	private static function is_secret_key( string $key ): bool {
		$needles = array( 'api_key', 'secret', 'token', 'password', 'private_key' );
		foreach ( $needles as $needle ) {
			if ( strpos( $key, $needle ) !== false ) {
				return true;
			}
		}
		return false;
	}
}
