<?php
/**
 * Disk cache for minified/aggregated assets.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Stores optimized CSS/JS under wp-content/cache/neo-pulse-speed/.
 */
class Neo_Pulse_Wp_Speed_Cache {

	const DIR_NAME = 'neo-pulse-speed';

	const LAST_WRITE_OPTION = 'neo_pulse_wp_speed_last_write';

	/**
	 * @return string Absolute cache directory path.
	 */
	public static function cache_dir(): string {
		if ( defined( 'WP_CONTENT_DIR' ) ) {
			return trailingslashit( WP_CONTENT_DIR ) . 'cache/' . self::DIR_NAME;
		}
		return trailingslashit( WP_CONTENT_DIR ) . 'cache/' . self::DIR_NAME;
	}

	/**
	 * @return string Public URL base for cached files.
	 */
	public static function cache_url_base(): string {
		return trailingslashit( content_url( 'cache/' . self::DIR_NAME ) );
	}

	/**
	 * Ensure cache directories exist.
	 */
	public static function ensure_dirs(): void {
		$base = self::cache_dir();
		foreach ( array( $base, $base . '/css', $base . '/js' ) as $dir ) {
			if ( ! is_dir( $dir ) ) {
				wp_mkdir_p( $dir );
			}
		}
		self::maybe_write_htaccess( $base );
	}

	/**
	 * @param string $base Cache root.
	 */
	private static function maybe_write_htaccess( string $base ): void {
		$file = $base . '/.htaccess';
		$rules = "# NEO Pulse Speed cache\n<Files *.php>\n deny from all\n</Files>\n";
		$rules .= "<IfModule mod_headers.c>\n";
		$rules .= "  <FilesMatch \"\\.(css|js)$\">\n";
		$rules .= "    Header set Cache-Control \"public, max-age=31536000, immutable\"\n";
		$rules .= "  </FilesMatch>\n";
		$rules .= "</IfModule>\n";
		if ( file_exists( $file ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$existing = file_get_contents( $file );
			if ( is_string( $existing ) && strpos( $existing, 'NEO Pulse-Cache-Control' ) !== false ) {
				return;
			}
			if ( is_string( $existing ) && strpos( $existing, 'Cache-Control' ) === false ) {
				$rules = rtrim( $existing ) . "\n\n# NEO Pulse-Cache-Control\n" . $rules;
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
				@file_put_contents( $file, $rules );
			}
			return;
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		@file_put_contents( $file, $rules );
	}

	/**
	 * @param string $type css|js.
	 * @param string $hash File basename without extension.
	 * @return string|null Absolute path if exists.
	 */
	public static function get_path( string $type, string $hash ): ?string {
		$hash = preg_replace( '/[^a-f0-9]/', '', strtolower( $hash ) );
		if ( strlen( $hash ) < 8 ) {
			return null;
		}
		$ext  = 'css' === $type ? 'css' : 'js';
		$path = self::cache_dir() . '/' . $type . '/' . $hash . '.' . $ext;
		return is_readable( $path ) ? $path : null;
	}

	/**
	 * @param string $type css|js.
	 * @param string $hash File basename.
	 * @return string|null Public URL.
	 */
	public static function get_url( string $type, string $hash ): ?string {
		$path = self::get_path( $type, $hash );
		if ( $path === null ) {
			return null;
		}
		$hash = preg_replace( '/[^a-f0-9]/', '', strtolower( $hash ) );
		$ext  = 'css' === $type ? 'css' : 'js';
		return self::cache_url_base() . $type . '/' . $hash . '.' . $ext;
	}

	/**
	 * @param string $type css|js.
	 * @param string $hash File basename.
	 * @param string $content File contents.
	 * @return string|null Public URL on success.
	 */
	public static function write( string $type, string $hash, string $content ): ?string {
		self::ensure_dirs();
		$hash = preg_replace( '/[^a-f0-9]/', '', strtolower( $hash ) );
		if ( strlen( $hash ) < 8 || $content === '' ) {
			return null;
		}
		$ext  = 'css' === $type ? 'css' : 'js';
		$path = self::cache_dir() . '/' . $type . '/' . $hash . '.' . $ext;
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		if ( false === @file_put_contents( $path, $content, LOCK_EX ) ) {
			return null;
		}
		self::record_write();
		return self::cache_url_base() . $type . '/' . $hash . '.' . $ext;
	}

	/**
	 * @return array{time: int, total_writes: int}
	 */
	public static function last_write_stats(): array {
		$raw = get_option( self::LAST_WRITE_OPTION, array() );
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}
		return array(
			'time'          => (int) ( $raw['time'] ?? 0 ),
			'total_writes'  => (int) ( $raw['total_writes'] ?? 0 ),
		);
	}

	private static function record_write(): void {
		$prev = self::last_write_stats();
		update_option(
			self::LAST_WRITE_OPTION,
			array(
				'time'         => time(),
				'total_writes' => $prev['total_writes'] + 1,
			),
			false
		);
	}

	/**
	 * @param string $source_key Unique key for source bundle.
	 * @param string $type css|js.
	 * @param array<string, mixed> $config Settings.
	 */
	public static function build_hash( string $source_key, string $type, array $config ): string {
		return md5( $type . '|' . NEO_PULSE_WP_VERSION . '|' . wp_json_encode( $config ) . '|' . $source_key );
	}

	/**
	 * Delete all cached asset files.
	 */
	public static function flush_all(): void {
		$base = self::cache_dir();
		if ( ! is_dir( $base ) ) {
			update_option( 'neo_pulse_wp_speed_last_flush', time(), false );
			return;
		}
		self::delete_dir_contents( $base . '/css' );
		self::delete_dir_contents( $base . '/js' );
		update_option( 'neo_pulse_wp_speed_last_flush', time(), false );
	}

	/**
	 * @param string $dir Directory.
	 */
	private static function delete_dir_contents( string $dir ): void {
		if ( ! is_dir( $dir ) ) {
			return;
		}
		$files = glob( trailingslashit( $dir ) . '*' );
		if ( ! is_array( $files ) ) {
			return;
		}
		foreach ( $files as $file ) {
			if ( is_file( $file ) ) {
				wp_delete_file( $file );
			}
		}
	}

	/**
	 * @return array{file_count: int, bytes: int, last_flush: int}
	 */
	public static function stats(): array {
		$count = 0;
		$bytes = 0;
		foreach ( array( 'css', 'js' ) as $type ) {
			$dir = self::cache_dir() . '/' . $type;
			if ( ! is_dir( $dir ) ) {
				continue;
			}
			$files = glob( trailingslashit( $dir ) . '*' );
			if ( ! is_array( $files ) ) {
				continue;
			}
			foreach ( $files as $file ) {
				if ( is_file( $file ) ) {
					++$count;
					$bytes += (int) filesize( $file );
				}
			}
		}
		return array(
			'file_count' => $count,
			'bytes'      => $bytes,
			'last_flush' => (int) get_option( 'neo_pulse_wp_speed_last_flush', 0 ),
		);
	}
}
