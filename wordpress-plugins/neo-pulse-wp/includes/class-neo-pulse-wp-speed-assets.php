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
	 * Rewrite an enqueued script or stylesheet URL to a Speed cache file.
	 *
	 * @param string $src  Enqueued URL.
	 * @param string $type css|js.
	 */
	public static function rewrite_enqueued_src( string $src, string $type ): string {
		if ( $src === '' || is_admin() ) {
			return $src;
		}
		if ( self::is_speed_cache_url( $src ) ) {
			return $src;
		}
		if ( ! Neo_Pulse_Wp_Speed_Gate::should_optimize() ) {
			return $src;
		}
		$config = Neo_Pulse_Wp_Speed_Settings::get_config();
		if ( 'css' === $type && empty( $config['optimize_css'] ) ) {
			return $src;
		}
		if ( 'js' === $type && empty( $config['optimize_js'] ) ) {
			return $src;
		}
		if ( Neo_Pulse_Wp_Speed_Excludes::is_excluded( $src, $type, $config ) ) {
			return $src;
		}
		$path = self::resolve_local_path( $src );
		if ( $path === null ) {
			return $src;
		}
		$cached = self::minify_file_to_cache( $path, $type, $config, $src );
		return null !== $cached ? $cached : $src;
	}

	/**
	 * @param string $src    Enqueued script URL.
	 * @param string $handle Script handle.
	 */
	public static function filter_script_loader_src( string $src, string $handle = '' ): string {
		unset( $handle );
		return self::rewrite_enqueued_src( $src, 'js' );
	}

	/**
	 * @param string $src    Enqueued style URL.
	 * @param string $handle Style handle.
	 */
	public static function filter_style_loader_src( string $src, string $handle = '' ): string {
		unset( $handle );
		return self::rewrite_enqueued_src( $src, 'css' );
	}

	/**
	 * Keep Speed cache CSS off Nitro's font rewriter (origin urls stay valid).
	 *
	 * @param string $tag    Link tag.
	 * @param string $handle Style handle.
	 * @param string $href   Stylesheet URL.
	 */
	public static function filter_style_loader_tag( string $tag, string $handle = '', string $href = '' ): string {
		unset( $handle );
		if ( ! self::is_speed_cache_url( $href ) && ! self::is_speed_cache_url( $tag ) ) {
			return $tag;
		}
		return self::with_nitro_exclude( $tag );
	}

	/**
	 * @param string $tag HTML link or script tag.
	 */
	public static function with_nitro_exclude( string $tag ): string {
		if ( $tag === '' || stripos( $tag, 'nitro-exclude' ) !== false ) {
			return $tag;
		}
		$pos = stripos( $tag, '<link' );
		if ( $pos === false ) {
			return $tag;
		}
		return substr( $tag, 0, $pos ) . '<link nitro-exclude' . substr( $tag, $pos + 5 );
	}

	/**
	 * Cached Speed output must not be remminified (wrong url() base).
	 *
	 * @param string $url Asset URL.
	 */
	public static function is_speed_cache_url( string $url ): bool {
		return strpos( $url, '/cache/neo-pulse-speed/' ) !== false;
	}

	/**
	 * @param string $url URL from tag.
	 */
	public static function resolve_local_path( string $url ): ?string {
		$url = trim( $url );
		if ( $url === '' || 0 === strpos( $url, 'data:' ) ) {
			return null;
		}
		$qpos = strpos( $url, '?' );
		if ( false !== $qpos ) {
			$url = substr( $url, 0, $qpos );
		}
		$hpos = strpos( $url, '#' );
		if ( false !== $hpos ) {
			$url = substr( $url, 0, $hpos );
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
	 * @param string $path       Local file path.
	 * @param string $type       css|js.
	 * @param array<string, mixed> $config Settings.
	 * @param string $source_url Original public URL (used to fix relative CSS urls).
	 * @return string|null Cached public URL.
	 */
	public static function minify_file_to_cache( string $path, string $type, array $config, string $source_url = '' ): ?string {
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
		if ( 'css' === $type && $source_url !== '' ) {
			$min = Neo_Pulse_Wp_Speed_Minify::rewrite_relative_urls( $min, $source_url );
		}
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
				if ( self::is_speed_cache_url( $url ) ) {
					return self::with_nitro_exclude( $full );
				}
				if ( Neo_Pulse_Wp_Speed_Excludes::is_excluded( $url, 'css', $config ) ) {
					return $full;
				}
				$path = self::resolve_local_path( $url );
				if ( $path === null ) {
					return $full;
				}
				$cached = self::minify_file_to_cache( $path, 'css', $config, $url );
				if ( $cached === null ) {
					return $full;
				}
				return self::with_nitro_exclude( '<link' . $before . 'href="' . esc_url( $cached ) . '"' . $after . '>' );
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
				if ( self::is_speed_cache_url( $url ) ) {
					return $m[0];
				}
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
