<?php
/**
 * Lightweight markdown renderer for admin AI reports.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Markdown {

	/**
	 * @param string $markdown Markdown source.
	 * @return string Safe HTML.
	 */
	public static function render( string $markdown ): string {
		$markdown = trim( str_replace( array( "\r\n", "\r" ), "\n", $markdown ) );
		if ( $markdown === '' ) {
			return '';
		}

		$lines = explode( "\n", $markdown );
		$parts = array();
		$in_ul = false;
		$in_ol = false;

		$close_lists = static function () use ( &$parts, &$in_ul, &$in_ol ): void {
			if ( $in_ul ) {
				$parts[] = '</ul>';
				$in_ul     = false;
			}
			if ( $in_ol ) {
				$parts[] = '</ol>';
				$in_ol     = false;
			}
		};

		foreach ( $lines as $line ) {
			$trimmed = trim( $line );

			if ( $trimmed === '' ) {
				$close_lists();
				continue;
			}

			if ( preg_match( '/^###\s+(.+)$/', $trimmed, $m ) ) {
				$close_lists();
				$parts[] = '<h3>' . self::inline( $m[1] ) . '</h3>';
				continue;
			}
			if ( preg_match( '/^##\s+(.+)$/', $trimmed, $m ) ) {
				$close_lists();
				$parts[] = '<h2>' . self::inline( $m[1] ) . '</h2>';
				continue;
			}
			if ( preg_match( '/^#\s+(.+)$/', $trimmed, $m ) ) {
				$close_lists();
				$parts[] = '<h1>' . self::inline( $m[1] ) . '</h1>';
				continue;
			}
			if ( preg_match( '/^[-*]\s+(.+)$/', $trimmed, $m ) ) {
				if ( ! $in_ul ) {
					$close_lists();
					$parts[] = '<ul>';
					$in_ul     = true;
				}
				$parts[] = '<li>' . self::inline( $m[1] ) . '</li>';
				continue;
			}
			if ( preg_match( '/^\d+\.\s+(.+)$/', $trimmed, $m ) ) {
				if ( ! $in_ol ) {
					$close_lists();
					$parts[] = '<ol>';
					$in_ol     = true;
				}
				$parts[] = '<li>' . self::inline( $m[1] ) . '</li>';
				continue;
			}

			$close_lists();
			$parts[] = '<p>' . self::inline( $trimmed ) . '</p>';
		}

		$close_lists();

		return wp_kses_post( implode( '', $parts ) );
	}

	/**
	 * @param string $text Inline markdown fragment.
	 */
	private static function inline( string $text ): string {
		$text = esc_html( $text );

		$text = preg_replace( '/\*\*(.+?)\*\*/', '<strong>$1</strong>', $text );
		$text = preg_replace( '/\*(.+?)\*/', '<em>$1</em>', $text );
		$text = preg_replace( '/`([^`]+)`/', '<code>$1</code>', $text );
		$text = preg_replace_callback(
			'/\[([^\]]+)\]\(([^)]+)\)/',
			static function ( array $m ): string {
				$label = esc_html( $m[1] );
				$url   = esc_url( $m[2] );
				if ( $url === '' ) {
					return $label;
				}
				$attrs = ' href="' . esc_attr( $url ) . '"';
				if ( preg_match( '/^https?:\/\//i', $url ) ) {
					$attrs .= ' target="_blank" rel="noopener noreferrer"';
				}
				return '<a' . $attrs . '>' . $label . '</a>';
			},
			$text
		);

		return is_string( $text ) ? self::auto_link_contacts( $text ) : esc_html( $text );
	}

	/**
	 * Wrap bare emails and phone numbers in mailto:/tel: links (skip existing anchors).
	 *
	 * @param string $html Escaped inline HTML fragment.
	 */
	private static function auto_link_contacts( string $html ): string {
		$saved = array();
		$html  = preg_replace_callback(
			'/<a\b[^>]*>[\s\S]*?<\/a>/i',
			static function ( array $m ) use ( &$saved ): string {
				$id       = count( $saved );
				$saved[]  = $m[0];
				return "\x00LINK{$id}\x00";
			},
			$html
		);
		if ( ! is_string( $html ) ) {
			return '';
		}

		$html = preg_replace_callback(
			'/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/',
			static function ( array $m ): string {
				$email = $m[1];
				return '<a href="mailto:' . esc_attr( $email ) . '">' . esc_html( $email ) . '</a>';
			},
			$html
		);
		if ( ! is_string( $html ) ) {
			return '';
		}

		$html = preg_replace_callback(
			'/(?:\+?\d{1,3}[-.\s]?)?(?:\([0-9]{3}\)|[0-9]{3})[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/',
			static function ( array $m ): string {
				$raw    = $m[0];
				$digits = preg_replace( '/\D/', '', $raw );
				if ( ! is_string( $digits ) || strlen( $digits ) < 10 || strlen( $digits ) > 15 ) {
					return $raw;
				}
				$href = ( str_starts_with( ltrim( $raw ), '+' ) ? 'tel:+' : 'tel:' ) . $digits;
				return '<a href="' . esc_attr( $href ) . '">' . esc_html( $raw ) . '</a>';
			},
			$html
		);
		if ( ! is_string( $html ) ) {
			return '';
		}

		return preg_replace_callback(
			'/\x00LINK(\d+)\x00/',
			static function ( array $m ) use ( $saved ): string {
				$id = (int) $m[1];
				return $saved[ $id ] ?? '';
			},
			$html
		) ?? $html;
	}
}
