<?php
/**
 * SEO character limits for AI-generated meta fields.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Ai_Seo_Limits {

	const TITLE_MAX = 60;
	const DESC_MAX  = 160;

	/**
	 * Character count aligned with editor counters (JS String.length / PHP strlen for BMP text).
	 */
	public static function char_count( string $text ): int {
		return strlen( $text );
	}

	/**
	 * Trim to max length, preferring a word boundary over a hard cut.
	 */
	public static function clamp_length( string $text, int $max ): string {
		$text = trim( preg_replace( '/\s+/', ' ', $text ) );
		if ( $text === '' || self::char_count( $text ) <= $max ) {
			return $text;
		}

		$cut = substr( $text, 0, $max );
		$last_space = strrpos( $cut, ' ' );
		if ( $last_space !== false && $last_space >= (int) ( $max * 0.5 ) ) {
			$cut = substr( $cut, 0, $last_space );
		}

		return rtrim( $cut, ' .,;:!?' );
	}

	public static function normalize_title( string $title ): string {
		return self::clamp_length( $title, self::TITLE_MAX );
	}

	public static function normalize_description( string $description, string $focus_keyword = '' ): string {
		$description   = trim( preg_replace( '/\s+/', ' ', $description ) );
		$focus_keyword = trim( $focus_keyword );

		if ( $description === '' ) {
			return '';
		}

		if ( $focus_keyword !== '' && stripos( $description, $focus_keyword ) === false ) {
			$description = self::inject_focus_keyword( $description, $focus_keyword );
		}

		return self::clamp_length( $description, self::DESC_MAX );
	}

	private static function inject_focus_keyword( string $desc, string $keyword ): string {
		foreach ( array( ' ' . $keyword . '.', ' ' . $keyword, ' — ' . $keyword ) as $suffix ) {
			if ( self::char_count( $desc . $suffix ) <= self::DESC_MAX ) {
				return $desc . $suffix;
			}
		}

		$prefix = $keyword . ': ';
		if ( self::char_count( $prefix . $desc ) <= self::DESC_MAX ) {
			return $prefix . $desc;
		}

		$suffix = ' ' . $keyword;
		$room   = self::DESC_MAX - self::char_count( $suffix );
		if ( $room >= 40 ) {
			return self::clamp_length( $desc, $room ) . $suffix;
		}

		return self::clamp_length( $keyword . ' — ' . $desc, self::DESC_MAX );
	}
}
