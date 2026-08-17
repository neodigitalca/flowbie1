<?php
/**
 * Flo Sheet — master JSON workbook for NEO Pulse WP settings + third-party crawls.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Neo_Pulse_Sheet {

	const VERSION     = 1;
	const OPTION_KEY  = 'neo_pulse_wp_flo_sheet';

	/**
	 * @return array<string, mixed>
	 */
	public static function empty_sheet(): array {
		return array(
			'version'          => self::VERSION,
			'collectedAt'      => '',
			'site'             => self::site_meta(),
			'sources_detected' => array(),
			'sheets'           => array(
				'fields'       => array(
					'groups'        => array(),
					'post_types'    => array(),
					'taxonomies'    => array(),
					'options_pages' => array(),
				),
				'field_values' => array(
					'posts' => array(),
				),
				'redirects'    => array(),
				'scripts'        => array(),
				'speed'          => array(),
				'sitemap'        => array(),
				'seo_meta'       => array(
					'posts' => array(),
				),
				'neo-pulse_native' => array(),
				'seo_blocks'     => array(),
				'elementor'      => array(
					'globals' => array(),
				),
			),
			'apply_log'        => array(),
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function get(): array {
		$stored = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $stored ) || empty( $stored['version'] ) ) {
			return self::empty_sheet();
		}
		return self::normalize( $stored );
	}

	/**
	 * @param array<string, mixed> $sheet Sheet payload.
	 */
	public static function save( array $sheet ): void {
		$sheet = self::normalize( $sheet );
		update_option( self::OPTION_KEY, $sheet, false );
	}

	/**
	 * @param array<string, mixed> $sheet Sheet payload.
	 * @return array<string, mixed>
	 */
	public static function normalize( array $sheet ): array {
		$base = self::empty_sheet();
		$out  = wp_parse_args( $sheet, $base );
		$out['version'] = self::VERSION;
		if ( empty( $out['site'] ) || ! is_array( $out['site'] ) ) {
			$out['site'] = self::site_meta();
		}
		if ( ! is_array( $out['sheets'] ) ) {
			$out['sheets'] = $base['sheets'];
		} else {
			$out['sheets'] = array_replace_recursive( $base['sheets'], $out['sheets'] );
		}
		if ( ! is_array( $out['sources_detected'] ) ) {
			$out['sources_detected'] = array();
		}
		if ( ! is_array( $out['apply_log'] ) ) {
			$out['apply_log'] = array();
		}
		return $out;
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function site_meta(): array {
		$meta = array(
			'url'             => home_url( '/' ),
			'wp_version'      => get_bloginfo( 'version' ),
			'neo-pulse_version' => defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '',
		);
		if ( defined( 'ELEMENTOR_VERSION' ) ) {
			$meta['elementor_version'] = ELEMENTOR_VERSION;
		}
		return $meta;
	}

	/**
	 * Refresh crawl timestamp and site meta on an in-memory sheet.
	 *
	 * @param array<string, mixed> $sheet Sheet payload.
	 * @return array<string, mixed>
	 */
	public static function touch_collected( array $sheet ): array {
		$sheet['collectedAt'] = gmdate( 'c' );
		$sheet['site']        = self::site_meta();
		return self::normalize( $sheet );
	}

	/**
	 * @param array<string, mixed> $sheet Sheet payload.
	 * @return string
	 */
	public static function to_json( array $sheet ): string {
		$redacted = self::redact_secrets( self::normalize( $sheet ) );
		$json     = wp_json_encode( $redacted, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		return is_string( $json ) ? $json : '{}';
	}

	/**
	 * @param string $json Raw JSON.
	 * @return array{ok: bool, sheet?: array<string, mixed>, error?: string}
	 */
	public static function from_json( string $json ): array {
		$json = trim( $json );
		if ( strncmp( $json, "\xEF\xBB\xBF", 3 ) === 0 ) {
			$json = substr( $json, 3 );
		}
		if ( $json === '' ) {
			return array(
				'ok'    => false,
				'error' => __( 'Flo Sheet JSON is empty.', 'neo-pulse-wp' ),
			);
		}
		$data = json_decode( $json, true );
		if ( ! is_array( $data ) ) {
			return array(
				'ok'    => false,
				'error' => sprintf(
					/* translators: %s: json_last_error_msg() */
					__( 'Invalid Flo Sheet JSON (%s).', 'neo-pulse-wp' ),
					json_last_error_msg()
				),
			);
		}
		if ( empty( $data['version'] ) || (int) $data['version'] !== self::VERSION ) {
			return array(
				'ok'    => false,
				'error' => __( 'Unsupported Flo Sheet version.', 'neo-pulse-wp' ),
			);
		}
		return array(
			'ok'    => true,
			'sheet' => self::normalize( $data ),
		);
	}

	/**
	 * @return string
	 */
	public static function download_filename(): string {
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		if ( ! is_string( $host ) || $host === '' ) {
			$host = 'site';
		}
		return 'neo-pulse-flo-sheet-' . sanitize_file_name( $host ) . '-' . gmdate( 'Y-m-d' ) . '.json';
	}

	/**
	 * @param array<string, mixed> $entry Log entry.
	 */
	public static function append_apply_log( array &$sheet, array $entry ): void {
		if ( ! isset( $sheet['apply_log'] ) || ! is_array( $sheet['apply_log'] ) ) {
			$sheet['apply_log'] = array();
		}
		$entry['at'] = gmdate( 'c' );
		$sheet['apply_log'][] = $entry;
	}

	/**
	 * @param mixed $value Value to redact recursively.
	 * @return mixed
	 */
	public static function redact_secrets( $value ) {
		if ( class_exists( 'Neo_Pulse_Wp_Speed_Export', false ) ) {
			return Neo_Pulse_Wp_Speed_Export::redact_secrets( $value );
		}
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
		foreach ( array( 'password', 'secret', 'api_key', 'apikey', 'token', 'private_key', 'app_password' ) as $needle ) {
			if ( strpos( $key, $needle ) !== false ) {
				return true;
			}
		}
		return false;
	}
}
