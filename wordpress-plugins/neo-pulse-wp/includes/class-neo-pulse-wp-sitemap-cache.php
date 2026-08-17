<?php
/**
 * Sitemap transient cache.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Caches generated sitemap XML in transients.
 */
class Neo_Pulse_Wp_Sitemap_Cache {

	const PREFIX = 'neo_pulse_wp_sitemap_';

	/**
	 * @param string $key Cache key suffix.
	 */
	public static function get( string $key ): ?string {
		$value = get_transient( self::PREFIX . $key );
		return is_string( $value ) && $value !== '' ? $value : null;
	}

	/**
	 * @param string $key Cache key suffix.
	 * @param string $xml XML content.
	 * @param int    $ttl TTL in seconds.
	 */
	public static function set( string $key, string $xml, int $ttl = DAY_IN_SECONDS ): void {
		set_transient( self::PREFIX . $key, $xml, $ttl );
	}

	/**
	 * Flush all sitemap transients.
	 */
	public static function flush_all(): void {
		global $wpdb;

		if ( ! isset( $wpdb ) ) {
			return;
		}

		$like = $wpdb->esc_like( '_transient_' . self::PREFIX ) . '%';
		$rows = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
				$like,
				$wpdb->esc_like( '_transient_timeout_' . self::PREFIX ) . '%'
			)
		);

		if ( ! is_array( $rows ) ) {
			return;
		}

		foreach ( $rows as $option_name ) {
			$name = (string) $option_name;
			if ( 0 === strpos( $name, '_transient_timeout_' . self::PREFIX ) ) {
				delete_option( $name );
				continue;
			}
			if ( 0 === strpos( $name, '_transient_' . self::PREFIX ) ) {
				$key = substr( $name, strlen( '_transient_' ) );
				delete_transient( $key );
			}
		}
	}

	/**
	 * Build cache key from request parts.
	 *
	 * @param string $kind index|post_type|taxonomy
	 * @param string $slug Slug.
	 * @param int    $page Page number.
	 */
	public static function cache_key( string $kind, string $slug = '', int $page = 1 ): string {
		$config = Neo_Pulse_Wp_Sitemap_Settings::get_config();
		$hash   = md5( wp_json_encode( $config ) );
		return sanitize_key( $kind . '_' . $slug . '_' . $page . '_' . $hash );
	}
}
