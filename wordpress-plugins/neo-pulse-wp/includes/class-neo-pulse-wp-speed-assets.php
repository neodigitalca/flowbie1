<?php
/**
 * Per-file and aggregate CSS/JS processing in HTML output.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Rewrites link/script tags using disk cache.
 */
class Neo_Pulse_Wp_Speed_Assets {

	/**
	 * @param string $html HTML document.
	 * @param array<string, mixed> $config Settings.
	 */
	public static function process( string $html, array $config ): string {
		if ( ! empty( $config['optimize_css'] ) ) {
			if ( ! empty( $config['aggregate_css'] ) ) {
				$html = Neo_Pulse_Wp_Speed_Aggregator::aggregate_stylesheets( $html, $config );
			} else {
				$html = self::minify_stylesheet_tags( $html, $config );
			}
		}

		if ( ! empty( $config['optimize_js'] ) ) {
			if ( ! empty( $config['aggregate_js'] ) ) {
				$html = Neo_Pulse_Wp_Speed_Aggregator::aggregate_scripts( $html, $config );
			} else {
				$html = self::minify_script_tags( $html, $config );
			}
			if ( ! empty( $config['defer_js'] ) ) {
				$html = self::defer_scripts( $html, $config );
			}
		}

		if ( ! empty( $config['remove_query_strings'] ) ) {
			$html = self::strip_version_query_strings( $html );
		}

		return $html;
	}

	/**
	 * @param string $url URL from tag.
	 */
	public static function resolve_local_path( string $url ): ?string {
		$url = trim( $url );
		if ( $url === '' || 0 === strpos( $url, 'data:' ) ) {
			return null;
		}
		if ( 0 === strpos( $url, '//' ) ) {
			$url = ( is_ssl() ? 'https:' : 'http:' ) . $url;
		}
		$home = home_url( '/' );
		$content = content_url( '/' );
		$site = site_url( '/' );
		$path = null;
		if ( 0 === strpos( $url, $home ) ) {
			$path = ABSPATH . ltrim( str_replace( $home, '', $url ), '/' );
		} elseif ( 0 === strpos( $url, $content ) ) {
			$path = WP_CONTENT_DIR . '/' . ltrim( str_replace( $content, '', $url ), '/' );
		} elseif ( 0 === strpos( $url, $site ) ) {
			$path = ABSPATH . ltrim( str_replace( $site, '', $url ), '/' );
		} elseif ( 0 === strpos( $url, '/' ) && ! preg_match( '#^//#', $url ) ) {
			$path = ABSPATH . ltrim( $url, '/' );
		}
		if ( $path === null ) {
			return null;
		}
		$path = wp_normalize_path( $path );
		if ( ! is_readable( $path ) || ! is_file( $path ) ) {
			return null;
		}
		$real = realpath( $path );
		if ( $real === false ) {
			return null;
		}
		$allowed_roots = array(
			wp_normalize_path( ABSPATH ),
			wp_normalize_path( WP_CONTENT_DIR ),
		);
		foreach ( $allowed_roots as $root ) {
			if ( 0 === strpos( $real, $root ) ) {
				return $real;
			}
		}
		return null;
	}

	/**
	 * @param string $path Local file path.
	 * @param string $type css|js.
	 * @param array<string, mixed> $config Settings.
	 * @return string|null Cached public URL.
	 */
	public static function minify_file_to_cache( string $path, string $type, array $config ): ?string {
		$mtime = (int) filemtime( $path );
		$key   = Neo_Pulse_Wp_Speed_Cache::build_hash( $path . ':' . $mtime, $type, $config );
		$url   = Neo_Pulse_Wp_Speed_Cache::get_url( $type, $key );
		if ( $url !== null ) {
			return $url;
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$raw = file_get_contents( $path );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return null;
		}
		$min = 'css' === $type ? Neo_Pulse_Wp_Speed_Minify::css( $raw ) : Neo_Pulse_Wp_Speed_Minify::js( $raw );
		if ( 'css' === $type && ! empty( $config['font_display_swap'] ) ) {
			$min = Neo_Pulse_Wp_Speed_Minify::ensure_font_display_swap( $min );
		}
		return Neo_Pulse_Wp_Speed_Cache::write( $type, $key, $min );
	}

	/**
	 * @param string $html HTML.
	 * @param array<string, mixed> $config Settings.
	 */
	private static function minify_stylesheet_tags( string $html, array $config ): string {
		return (string) preg_replace_callback(
			'#<link\b([^>]*)\bhref=(["\'])([^"\']+)\2([^>]*)>#i',
			static function ( $m ) use ( $config ) {
				$before = $m[1];
				$url    = $m[3];
				$after  = $m[4];
				$full   = $m[0];
				if ( stripos( $full, 'stylesheet' ) === false ) {
					return $full;
				}
				if ( Neo_Pulse_Wp_Speed_Excludes::is_excluded( $url, 'css', $config ) ) {
					return $full;
				}
				$path = self::resolve_local_path( $url );
				if ( $path === null ) {
					return $full;
				}
				$cached = self::minify_file_to_cache( $path, 'css', $config );
				if ( $cached === null ) {
					return $full;
				}
				return '<link' . $before . 'href="' . esc_url( $cached ) . '"' . $after . '>';
			},
			$html
		);
	}

	/**
	 * @param string $html HTML.
	 * @param array<string, mixed> $config Settings.
	 */
	private static function minify_script_tags( string $html, array $config ): string {
		return (string) preg_replace_callback(
			'#<script\b([^>]*)\bsrc=(["\'])([^"\']+)\2([^>]*)>\s*</script>#i',
			static function ( $m ) use ( $config ) {
				$before = $m[1];
				$url    = $m[3];
				$after  = $m[4];
				if ( Neo_Pulse_Wp_Speed_Excludes::is_excluded( $url, 'js', $config ) ) {
					return $m[0];
				}
				$path = self::resolve_local_path( $url );
				if ( $path === null ) {
					return $m[0];
				}
				$cached = self::minify_file_to_cache( $path, 'js', $config );
				if ( $cached === null ) {
					return $m[0];
				}
				return '<script' . $before . 'src="' . esc_url( $cached ) . '"' . $after . '></script>';
			},
			$html
		);
	}

	/**
	 * @param string $html HTML.
	 * @param array<string, mixed> $config Settings.
	 */
	private static function defer_scripts( string $html, array $config ): string {
		return (string) preg_replace_callback(
			'#<script\b([^>]*)\bsrc=(["\'])([^"\']+)\2([^>]*)>\s*</script>#i',
			static function ( $m ) use ( $config ) {
				$tag = $m[0];
				$url = $m[3];
				if ( stripos( $tag, ' defer' ) !== false || stripos( $tag, ' async' ) !== false ) {
					return $tag;
				}
				if ( Neo_Pulse_Wp_Speed_Excludes::is_defer_excluded( $url, $config ) ) {
					return $tag;
				}
				return preg_replace( '#\s*/?\s*>$#', ' defer></script>', rtrim( $tag, '>' ) . '>' ) ?? $tag;
			},
			$html
		);
	}

	/**
	 * @param string $html HTML.
	 */
	private static function strip_version_query_strings( string $html ): string {
		$home_host = wp_parse_url( home_url(), PHP_URL_HOST );
		return (string) preg_replace_callback(
			'#(\b(?:href|src)=["\'])([^"\']+)(["\'])#i',
			static function ( $m ) use ( $home_host ) {
				$url = $m[2];
				if ( strpos( $url, 'ver=' ) === false ) {
					return $m[0];
				}
				$host = wp_parse_url( $url, PHP_URL_HOST );
				if ( $host && $home_host && $host !== $home_host ) {
					return $m[0];
				}
				$clean = remove_query_arg( 'ver', $url );
				return $m[1] . $clean . $m[3];
			},
			$html
		);
	}
}
