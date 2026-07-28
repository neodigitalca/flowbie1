<?php
/**
 * Build Speed disk cache without requiring a manual guest browser visit.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Speed_Warm {

	const WARM_HEADER = 'X-Flowbie-Speed-Warm';

	const AUTO_WARM_LOCK = 'flowbie_wp_speed_auto_warm_lock';

	/**
	 * Shared secret for loopback warm requests (guest context, Speed enabled).
	 */
	public static function warm_header_token(): string {
		return hash_hmac( 'sha256', 'flowbie_speed_warm_v1', wp_salt( 'auth' ) );
	}

	/**
	 * Loopback request that must run Speed as for a logged-out visitor.
	 */
	public static function is_warm_request(): bool {
		if ( empty( $_SERVER['HTTP_X_FLOWBIE_SPEED_WARM'] ) ) {
			return false;
		}
		return hash_equals( self::warm_header_token(), (string) $_SERVER['HTTP_X_FLOWBIE_SPEED_WARM'] );
	}

	/**
	 * Fetch public URLs as a guest so minified assets are written to disk.
	 *
	 * @param array<int, string> $urls Optional URLs; defaults to homepage.
	 * @return array{file_count: int, bytes: int}
	 */
	public static function warm_disk_cache( array $urls = array() ): array {
		if ( ! Flowbie_Wp_Speed_Settings::is_enabled() ) {
			return Flowbie_Wp_Speed_Cache::stats();
		}

		$config = Flowbie_Wp_Speed_Settings::get_config();
		if ( ! Flowbie_Wp_Speed_Gate::config_has_active_transforms( $config ) ) {
			return Flowbie_Wp_Speed_Cache::stats();
		}

		Flowbie_Wp_Speed_Cache::ensure_dirs();

		if ( empty( $urls ) ) {
			$urls = array( home_url( '/' ) );
		}

		$headers = array(
			self::WARM_HEADER => self::warm_header_token(),
			'Cache-Control'   => 'no-cache',
		);

		foreach ( $urls as $url ) {
			$url = esc_url_raw( (string) $url );
			if ( $url === '' ) {
				continue;
			}
			wp_remote_get(
				$url,
				array(
					'timeout'     => 45,
					'sslverify'   => false,
					'redirection' => 3,
					'headers'     => $headers,
				)
			);
		}

		return Flowbie_Wp_Speed_Cache::stats();
	}

	/**
	 * Populate cache when empty (admin Speed screen, after migrations, etc.).
	 */
	public static function maybe_auto_warm(): void {
		if ( ! Flowbie_Wp_Speed_Settings::is_enabled() ) {
			return;
		}

		$stats = Flowbie_Wp_Speed_Cache::stats();
		if ( (int) $stats['file_count'] > 0 ) {
			return;
		}

		if ( get_transient( self::AUTO_WARM_LOCK ) ) {
			return;
		}

		set_transient( self::AUTO_WARM_LOCK, '1', 30 );
		self::warm_disk_cache();
		delete_transient( self::AUTO_WARM_LOCK );
	}
}
