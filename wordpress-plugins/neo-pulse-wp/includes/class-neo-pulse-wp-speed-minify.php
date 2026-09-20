<?php
/**
 * CSS, JS, and HTML minifiers (lightweight, no external deps).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Static minify helpers.
 */
class Neo_Pulse_Wp_Speed_Minify {

	/**
	 * @param string $css Raw CSS.
	 */
	public static function css( string $css ): string {
		if ( $css === '' ) {
			return '';
		}
		$css = preg_replace( '!/\*[^*]*\*+([^/][^*]*\*+)*/!', '', $css ) ?? $css;
		$css = preg_replace( '/\s+/', ' ', $css ) ?? $css;
		$css = preg_replace( '/\s*([\{\};:,>+~])\s*/', '$1', $css ) ?? $css;
		return trim( $css );
	}

	/**
	 * Force font-display:swap so icon/heading text is not held by FOIT.
	 *
	 * @param string $css Raw or minified CSS.
	 */
	public static function ensure_font_display_swap( string $css ): string {
		if ( $css === '' || stripos( $css, '@font-face' ) === false ) {
			return $css;
		}
		return (string) preg_replace_callback(
			'/@font-face\s*\{([^}]*)\}/i',
			static function ( array $m ): string {
				$body = $m[1];
				if ( preg_match( '/font-display\s*:\s*(swap|optional)\b/i', $body ) ) {
					return $m[0];
				}
				if ( preg_match( '/font-display\s*:[^;]+;?/i', $body ) ) {
					$body = (string) preg_replace( '/font-display\s*:[^;]+;?/i', 'font-display:swap;', $body );
					return '@font-face{' . $body . '}';
				}
				return '@font-face{font-display:swap;' . $body . '}';
			},
			$css
		);
	}

	/**
	 * Directory URL of a stylesheet (query string stripped).
	 *
	 * @param string $stylesheet_url Public CSS URL.
	 */
	public static function stylesheet_dir_url( string $stylesheet_url ): string {
		$cut = strpos( $stylesheet_url, '?' );
		if ( $cut !== false ) {
			$stylesheet_url = substr( $stylesheet_url, 0, $cut );
		}
		$hash = strpos( $stylesheet_url, '#' );
		if ( $hash !== false ) {
			$stylesheet_url = substr( $stylesheet_url, 0, $hash );
		}
		return rtrim( str_replace( '\\', '/', dirname( $stylesheet_url ) ), '/' ) . '/';
	}

	/**
	 * Rewrite relative css url() values so cached files still load fonts and images.
	 *
	 * @param string $css              CSS text.
	 * @param string $stylesheet_url Public URL of the original stylesheet.
	 */
	public static function rewrite_relative_urls( string $css, string $stylesheet_url ): string {
		if ( $css === '' || $stylesheet_url === '' || stripos( $css, 'url(' ) === false ) {
			return $css;
		}
		if ( strpos( $stylesheet_url, '/cache/neo-pulse-speed/' ) !== false ) {
			return $css;
		}
		if ( strpos( $stylesheet_url, '//' ) !== 0 && strpos( $stylesheet_url, '/' ) === 0 && function_exists( 'home_url' ) ) {
			$stylesheet_url = home_url( $stylesheet_url );
		}
		$base = self::stylesheet_dir_url( $stylesheet_url );
		$out  = preg_replace_callback(
			'/url\(\s*([\'"]?)([^\'")]+)\1\s*\)/i',
			static function ( array $m ) use ( $base ): string {
				$abs = self::resolve_css_url( $base, trim( $m[2] ) );
				return 'url(' . $abs . ')';
			},
			$css
		);
		return is_string( $out ) ? $out : $css;
	}

	/**
	 * @param string $base_dir_url Directory URL ending in /.
	 * @param string $rel          url() payload.
	 */
	public static function resolve_css_url( string $base_dir_url, string $rel ): string {
		$rel = trim( $rel );
		if ( $rel === '' ) {
			return $rel;
		}
		$lower = strtolower( $rel );
		if (
			strpos( $lower, 'data:' ) === 0
			|| strpos( $lower, 'http://' ) === 0
			|| strpos( $lower, 'https://' ) === 0
			|| strpos( $rel, '//' ) === 0
			|| strpos( $rel, '/' ) === 0
			|| strpos( $rel, '#' ) === 0
		) {
			return $rel;
		}
		$query = '';
		$qpos  = strpos( $rel, '?' );
		if ( $qpos !== false ) {
			$query = substr( $rel, $qpos );
			$rel   = substr( $rel, 0, $qpos );
		}
		$joined = $base_dir_url . $rel;
		$parts  = wp_parse_url( $joined );
		if ( ! is_array( $parts ) || empty( $parts['host'] ) || ! isset( $parts['path'] ) ) {
			return $rel . $query;
		}
		$segs = array();
		foreach ( explode( '/', (string) $parts['path'] ) as $seg ) {
			if ( $seg === '' || $seg === '.' ) {
				continue;
			}
			if ( $seg === '..' ) {
				array_pop( $segs );
				continue;
			}
			$segs[] = $seg;
		}
		$scheme = isset( $parts['scheme'] ) ? $parts['scheme'] . ':' : '';
		return $scheme . '//' . $parts['host'] . '/' . implode( '/', $segs ) . $query;
	}

	/**
	 * Conservative JS minify (whitespace + line comments outside strings).
	 *
	 * @param string $js Raw JS.
	 */
	public static function js( string $js ): string {
		if ( $js === '' ) {
			return '';
		}
		if ( strpos( $js, "\n" ) === false ) {
			return trim( $js );
		}
		$out    = '';
		$len    = strlen( $js );
		$in_str = false;
		$quote  = '';
		$prev   = '';

		for ( $i = 0; $i < $len; $i++ ) {
			$c = $js[ $i ];
			if ( $in_str ) {
				$out .= $c;
				if ( '\\' === $c ) {
					if ( $i + 1 < $len ) {
						$out .= $js[ ++$i ];
					}
					continue;
				}
				if ( $c === $quote ) {
					$in_str = false;
				}
				$prev = $c;
				continue;
			}
			if ( '"' === $c || "'" === $c ) {
				$in_str = true;
				$quote  = $c;
				$out   .= $c;
				$prev   = $c;
				continue;
			}
			if ( '/' === $c && $i + 1 < $len && '/' === $js[ $i + 1 ] ) {
				while ( $i < $len && $js[ $i ] !== "\n" ) {
					++$i;
				}
				$out .= "\n";
				continue;
			}
			if ( preg_match( '/\s/', $c ) ) {
				if ( $out !== '' && ! preg_match( '/\s$/', $out ) && $i + 1 < $len && ! preg_match( '/\s/', $js[ $i + 1 ] ) ) {
					$next = $js[ $i + 1 ];
					if ( ! in_array( $prev, array( '(', '[', '{', '=', ',', ';', ':', '+', '-', '*', '/', '>', '<', '!', '&', '|', '?' ), true )
						&& ! in_array( $next, array( ')', ']', '}', '=', ',', ';', ':', '+', '-', '*', '/', '>', '<', '!', '&', '|', '?' ), true ) ) {
						$out .= ' ';
					}
				}
				continue;
			}
			$out .= $c;
			$prev = $c;
		}
		return trim( $out );
	}

	/**
	 * @param string $html Full HTML document.
	 */
	public static function html( string $html ): string {
		if ( $html === '' ) {
			return '';
		}
		$placeholders = array();
		$index        = 0;

		$protected = array(
			'pre',
			'textarea',
			'script',
			'style',
		);

		foreach ( $protected as $tag ) {
			$pattern = '#<' . $tag . '\b[^>]*>.*?</' . $tag . '>#is';
			$html    = preg_replace_callback(
				$pattern,
				static function ( $m ) use ( &$placeholders, &$index ) {
					$key                  = '<!--NEO_PULSE_SPEED_' . $index . '-->';
					$placeholders[ $key ] = $m[0];
					++$index;
					return $key;
				},
				$html
			) ?? $html;
		}

		$html = preg_replace( '/<!--(?!\[if\s)(?!<!)[^\[>].*?-->/s', '', $html ) ?? $html;
		$html = preg_replace( '/\s+/', ' ', $html ) ?? $html;
		$html = preg_replace( '/>\s+</', '><', $html ) ?? $html;

		foreach ( $placeholders as $key => $block ) {
			$html = str_replace( $key, $block, $html );
		}

		return trim( $html );
	}
}
