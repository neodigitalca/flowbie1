<?php
/**
 * Lightweight markdown renderer for admin AI reports.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Markdown {

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
				return '<a href="' . esc_attr( $url ) . '" target="_blank" rel="noopener noreferrer">' . $label . '</a>';
			},
			$text
		);

		return is_string( $text ) ? $text : esc_html( $text );
	}
}
