<?php
/**
 * Safe front-end HTML optimizations (fonts, preconnect, render-blocking CSS).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Head-level optimizations that do not combine or strip theme/builder assets.
 */
class Neo_Pulse_Wp_Speed_Front {

	/**
	 * @param string               $html   Buffered HTML.
	 * @param array<string, mixed> $config Speed settings.
	 */
	public static function process( string $html, array $config ): string {
		if ( empty( $config['enabled'] ) ) {
			return $html;
		}

		if ( ! empty( $config['font_display_swap'] ) ) {
			$html = self::ensure_google_fonts_display_swap( $html );
			$html = self::ensure_inline_font_display_swap( $html );
		}

		if ( ! empty( $config['preconnect_fonts'] ) ) {
			$html = self::inject_font_preconnect( $html );
		}

		if ( ! empty( $config['async_google_fonts'] ) ) {
			$html = self::async_google_font_stylesheets( $html );
		}

		return $html;
	}

	/**
	 * Add display=swap to Google Fonts stylesheet URLs.
	 *
	 * @param string $html HTML.
	 */
	private static function ensure_google_fonts_display_swap( string $html ): string {
		return (string) preg_replace_callback(
			'#<link\b([^>]*)\bhref=(["\'])(https?://fonts\.googleapis\.com/[^"\']+)\2([^>]*)>#i',
			static function ( $m ) {
				$url = self::url_with_display_swap( $m[3] );
				return '<link' . $m[1] . 'href="' . esc_url( $url ) . '"' . $m[4] . '>';
			},
			$html
		);
	}

	/**
	 * @param string $url Google Fonts CSS URL.
	 */
	public static function url_with_display_swap( string $url ): string {
		if ( stripos( $url, 'display=' ) !== false ) {
			return $url;
		}
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return $url;
		}
		$query = array();
		if ( ! empty( $parts['query'] ) ) {
			parse_str( $parts['query'], $query );
		}
		$query['display'] = 'swap';
		$parts['query']   = http_build_query( $query, '', '&', PHP_QUERY_RFC3986 );
		return self::build_url( $parts );
	}

	/**
	 * @param array<string, mixed> $parts wp_parse_url parts.
	 */
	private static function build_url( array $parts ): string {
		$scheme = isset( $parts['scheme'] ) ? $parts['scheme'] . '://' : '';
		$host   = $parts['host'] ?? '';
		$port   = isset( $parts['port'] ) ? ':' . $parts['port'] : '';
		$path   = $parts['path'] ?? '';
		$query  = isset( $parts['query'] ) && $parts['query'] !== '' ? '?' . $parts['query'] : '';
		return $scheme . $host . $port . $path . $query;
	}

	/**
	 * Inject font-display:swap into inline @font-face rules.
	 *
	 * @param string $html HTML.
	 */
	private static function ensure_inline_font_display_swap( string $html ): string {
		return (string) preg_replace_callback(
			'#<style\b([^>]*)>(.*?)</style>#is',
			static function ( $m ) {
				$css = Neo_Pulse_Wp_Speed_Minify::ensure_font_display_swap( $m[2] );
				return '<style' . $m[1] . '>' . $css . '</style>';
			},
			$html
		);
	}

	/**
	 * Preconnect to Google Fonts origins when those assets appear on the page.
	 *
	 * @param string $html HTML.
	 */
	private static function inject_font_preconnect( string $html ): string {
		$uses_google = stripos( $html, 'fonts.googleapis.com' ) !== false
			|| stripos( $html, 'fonts.gstatic.com' ) !== false;
		if ( ! $uses_google ) {
			return $html;
		}

		$snippets = '';
		if ( stripos( $html, 'href="https://fonts.googleapis.com"' ) === false
			&& stripos( $html, "href='https://fonts.googleapis.com'" ) === false ) {
			$snippets .= '<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>';
		}
		if ( stripos( $html, 'href="https://fonts.gstatic.com"' ) === false
			&& stripos( $html, "href='https://fonts.gstatic.com'" ) === false ) {
			$snippets .= '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
		}
		if ( $snippets === '' ) {
			return $html;
		}

		$replaced = preg_replace( '/<head(\b[^>]*)>/i', '<head$1>' . $snippets, $html, 1 );
		return is_string( $replaced ) ? $replaced : $html;
	}

	/**
	 * Load Google Fonts CSS without blocking first paint (print media trick).
	 *
	 * @param string $html HTML.
	 */
	private static function async_google_font_stylesheets( string $html ): string {
		return (string) preg_replace_callback(
			'#<link\b([^>]*)\bhref=(["\'])(https?://fonts\.googleapis\.com/[^"\']+)\2([^>]*)>#i',
			static function ( $m ) {
				$full = $m[0];
				if ( stripos( $full, 'stylesheet' ) === false ) {
					return $full;
				}
				if ( stripos( $full, 'onload=' ) !== false ) {
					return $full;
				}
				$url = self::url_with_display_swap( $m[3] );
				$tag = '<link' . $m[1] . 'href="' . esc_url( $url ) . '"' . $m[4] . '>';
				$tag = (string) preg_replace( '/\smedia=(["\'])[^"\']*\1/i', '', $tag );
				return preg_replace( '#\s*/?\s*>$#', ' media="print" onload="this.media=\'all\'">', rtrim( $tag, '>' ) . '>' ) ?? $full;
			},
			$html
		);
	}
}
