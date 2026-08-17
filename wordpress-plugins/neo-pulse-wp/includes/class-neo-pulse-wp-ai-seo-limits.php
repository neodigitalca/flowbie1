<?php
/**
 * SEO character limits for AI-generated meta fields.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Ai_Seo_Limits {

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

		if ( $description === '' || self::is_placeholder_copy( $description ) ) {
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

	/**
	 * True when copy is filler, a field label, or ACF placeholder text — not real SEO content.
	 */
	public static function is_placeholder_copy( string $value ): bool {
		$norm = strtolower( trim( preg_replace( '/\s+/', ' ', $value ) ) );
		if ( $norm === '' ) {
			return true;
		}

		$exact = array(
			'placeholder',
			'place holder',
			'tbd',
			'tba',
			'todo',
			'n/a',
			'na',
			'none',
			'null',
			'undefined',
			'keyword focus',
			'focus keyword',
			'meta description',
			'seo title',
			'seo research',
			'your keyword here',
			'enter keyword',
			'enter focus keyword',
			'add keyword',
			'add meta',
			'add meta description',
			'lorem ipsum',
			'coming soon',
			'example keyword',
			'sample text',
			'insert content',
			'[insert content]',
		);
		if ( in_array( $norm, $exact, true ) ) {
			return true;
		}

		if ( str_starts_with( $norm, '[insert' ) || str_starts_with( $norm, '{{' ) ) {
			return true;
		}
		if ( str_contains( $norm, 'lorem ipsum' ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Derive a focus keyword phrase from the post title or slug when planning omits one.
	 */
	public static function infer_focus_keyword_from_post( int $post_id ): string {
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return '';
		}

		$candidates = array(
			trim( (string) $post->post_title ),
			trim( str_replace( '-', ' ', (string) $post->post_name ) ),
		);
		foreach ( $candidates as $candidate ) {
			if ( $candidate === '' || self::is_placeholder_copy( $candidate ) ) {
				continue;
			}
			$keyword = strtolower( trim( preg_replace( '/\s+/', ' ', $candidate ) ) );
			if ( $keyword !== '' && ! self::is_placeholder_copy( $keyword ) ) {
				return $keyword;
			}
		}

		return '';
	}

	/**
	 * True when SEO copy clearly describes the ACF plugin but the post topic is something else.
	 */
	public static function meta_copy_drifts_from_post( string $value, int $post_id ): bool {
		if ( $value === '' || $post_id < 1 ) {
			return false;
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return false;
		}

		$norm       = strtolower( trim( preg_replace( '/\s+/', ' ', $value ) ) );
		$title_norm = strtolower( trim( preg_replace( '/\s+/', ' ', (string) $post->post_title ) ) );
		if ( $norm === '' || $title_norm === '' ) {
			return false;
		}

		$title_is_plugin = str_contains( $title_norm, 'acf' )
			|| str_contains( $title_norm, 'custom field' )
			|| str_contains( $title_norm, 'wordpress plugin' );

		$plugin_markers = array(
			'advanced custom fields',
			'acf plugin',
			'acf wordpress',
			'acf is a',
			'acf (advanced custom fields)',
			'custom fields plugin',
			'wordpress plugin that allows you to add custom fields',
		);

		foreach ( $plugin_markers as $marker ) {
			if ( str_contains( $norm, $marker ) && ! $title_is_plugin ) {
				return true;
			}
		}

		return false;
	}
}
