<?php
/**
 * CSS, JS, and HTML minifiers (lightweight, no external deps).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Static minify helpers.
 */
class Flowbie_Wp_Speed_Minify {

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
	 * Add font-display:swap to @font-face blocks that omit it.
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
				if ( preg_match( '/font-display\s*:/i', $m[1] ) ) {
					return $m[0];
				}
				return '@font-face{font-display:swap;' . $m[1] . '}';
			},
			$css
		);
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
					$key                  = '<!--FLOWBIE_SPEED_' . $index . '-->';
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
