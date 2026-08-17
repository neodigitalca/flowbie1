<?php
/**
 * NEO Pulse + WordPress cache flush (no host / WP Engine purge).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Clears NEO Pulse disk cache, NEO Pulse transients, and WordPress object cache.
 */
class Neo_Pulse_Wp_Cache_Flush {

	const VERSION_OPTION = 'neo_pulse_wp_cache_flush_version';

	const NOCACHE_UNTIL_OPTION = 'neo_pulse_wp_send_nocache_until';

	const NOCACHE_SECONDS = 600;

	/**
	 * Register front-end no-cache headers after a flush (helps browsers refetch for guests).
	 */
	public static function init(): void {
		add_action( 'template_redirect', array( __CLASS__, 'maybe_send_nocache_headers' ), 0 );
		add_filter( 'style_loader_src', array( __CLASS__, 'append_version_to_neo_pulse_src' ), 999, 2 );
		add_filter( 'script_loader_src', array( __CLASS__, 'append_version_to_neo_pulse_src' ), 999, 2 );
	}

	/**
	 * Full WordPress + NEO Pulse flush. Does not call WP Engine or other host APIs.
	 *
	 * @return array<string, mixed> Summary for admin notices.
	 */
	public static function flush_all(): array {
		$summary = array(
			'speed_files'     => 0,
			'transients'      => 0,
			'object_cache'    => false,
			'flush_version'   => 0,
			'nocache_seconds' => self::NOCACHE_SECONDS,
		);

		if ( class_exists( 'Neo_Pulse_Wp_Speed_Cache', false ) ) {
			$before = Neo_Pulse_Wp_Speed_Cache::stats();
			Neo_Pulse_Wp_Speed_Cache::flush_all();
			$summary['speed_files'] = (int) ( $before['file_count'] ?? 0 );
		}

		if ( class_exists( 'Neo_Pulse_Wp_Sitemap_Cache', false ) ) {
			Neo_Pulse_Wp_Sitemap_Cache::flush_all();
		}

		if ( class_exists( 'Neo_Pulse_Wp_Chat_Rag', false ) && is_callable( array( 'Neo_Pulse_Wp_Chat_Rag', 'invalidate_cache' ) ) ) {
			Neo_Pulse_Wp_Chat_Rag::invalidate_cache();
		}

		if ( class_exists( 'Neo_Pulse_Wp_Gsc', false ) && is_callable( array( 'Neo_Pulse_Wp_Gsc', 'flush_stats_cache' ) ) ) {
			Neo_Pulse_Wp_Gsc::flush_stats_cache();
		}

		$summary['transients'] = self::delete_neo_pulse_transients();

		if ( function_exists( 'wp_cache_flush' ) ) {
			wp_cache_flush();
			$summary['object_cache'] = true;
		}

		if ( function_exists( 'wp_cache_flush_group' ) ) {
			wp_cache_flush_group( 'posts' );
			wp_cache_flush_group( 'post_meta' );
			wp_cache_flush_group( 'themes' );
		}

		$version = time();
		update_option( self::VERSION_OPTION, $version, false );
		update_option( self::NOCACHE_UNTIL_OPTION, $version + self::NOCACHE_SECONDS, false );
		$summary['flush_version'] = $version;

		/**
		 * After NEO Pulse + WordPress caches are cleared.
		 *
		 * @param array<string, mixed> $summary Flush summary.
		 */
		do_action( 'neo_pulse_wp_cache_flushed', $summary );

		return $summary;
	}

	/**
	 * @return int Bumped on each flush; appended to NEO Pulse asset URLs.
	 */
	public static function version(): int {
		return (int) get_option( self::VERSION_OPTION, 0 );
	}

	/**
	 * @param string $src    Asset URL.
	 * @param string $handle Script/style handle.
	 */
	public static function append_version_to_neo_pulse_src( string $src, string $handle ): string {
		if ( strpos( $handle, 'neo-pulse' ) === false ) {
			return $src;
		}
		$ver = self::version();
		if ( $ver < 1 ) {
			return $src;
		}
		return add_query_arg( 'neo-pulse_cv', (string) $ver, $src );
	}

	public static function maybe_send_nocache_headers(): void {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
			return;
		}
		$until = (int) get_option( self::NOCACHE_UNTIL_OPTION, 0 );
		if ( $until < time() ) {
			return;
		}
		nocache_headers();
	}

	/**
	 * Delete NEO Pulse-related transients from wp_options.
	 */
	public static function delete_neo_pulse_transients(): int {
		global $wpdb;

		if ( ! isset( $wpdb ) ) {
			return 0;
		}

		$patterns = array(
			$wpdb->esc_like( '_transient_neo_pulse%' ) . '%',
			$wpdb->esc_like( '_transient_timeout_neo_pulse%' ) . '%',
			$wpdb->esc_like( '_transient_neo_pulse_wp%' ) . '%',
			$wpdb->esc_like( '_transient_timeout_neo_pulse_wp%' ) . '%',
		);

		$deleted = 0;
		foreach ( $patterns as $like ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$rows = $wpdb->get_col(
				$wpdb->prepare(
					"SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s",
					$like
				)
			);
			if ( ! is_array( $rows ) ) {
				continue;
			}
			foreach ( $rows as $option_name ) {
				if ( delete_option( (string) $option_name ) ) {
					++$deleted;
				}
			}
		}

		return $deleted;
	}
}
