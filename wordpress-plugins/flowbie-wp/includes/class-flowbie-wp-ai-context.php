<?php
/**
 * Post context + field reads for AI wands.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Ai_Context {

	/**
	 * @return array<string,string>
	 */
	public static function read_context( int $post_id ): array {
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return array(
				'title'       => '',
				'excerpt'     => '',
				'focusKeyword' => '',
				'faq'         => '',
				'seoResearch' => '',
				'pageUrl'     => '',
				'url'         => '',
			);
		}

		$url = get_permalink( $post ) ?: '';

		return array(
			'title'        => get_the_title( $post ),
			'excerpt'      => self::read_excerpt( $post ),
			'focusKeyword' => self::read_focus_keyword( $post_id ),
			'faq'          => self::read_acf_or_meta( $post_id, array( 'faq', 'seo_faq' ) ),
			'seoResearch'  => self::read_acf_or_meta( $post_id, array( 'seo_research' ) ),
			'pageUrl'      => self::read_acf_or_meta( $post_id, array( 'page_url' ) ),
			'url'          => is_string( $url ) ? $url : '',
		);
	}

	public static function read_excerpt( WP_Post $post ): string {
		$excerpt = $post->post_excerpt;
		return is_string( $excerpt ) ? trim( $excerpt ) : '';
	}

	public static function read_seo_title( int $post_id ): string {
		$rm = get_post_meta( $post_id, 'rank_math_title', true );
		if ( is_string( $rm ) && trim( $rm ) !== '' ) {
			return trim( $rm );
		}
		$post = get_post( $post_id );
		return $post instanceof WP_Post ? get_the_title( $post ) : '';
	}

	public static function read_meta_description( int $post_id ): string {
		$rm = get_post_meta( $post_id, 'rank_math_description', true );
		if ( is_string( $rm ) && trim( $rm ) !== '' ) {
			return trim( $rm );
		}
		$post = get_post( $post_id );
		return $post instanceof WP_Post ? self::read_excerpt( $post ) : '';
	}

	/**
	 * @return array<string,string>
	 */
	public static function meta_hub_values( int $post_id ): array {
		$page_url = self::read_acf_or_meta( $post_id, array( 'page_url' ) );
		if ( $page_url === '' ) {
			$link = get_permalink( $post_id );
			$page_url = is_string( $link ) ? $link : '';
		}

		return array(
			'seoTitle'        => self::read_seo_title( $post_id ),
			'metaDescription' => self::read_meta_description( $post_id ),
			'focusKeyword'    => self::read_focus_keyword( $post_id ),
			'seoResearch'     => self::read_acf_or_meta( $post_id, array( 'seo_research' ) ),
			'faq'             => self::read_acf_or_meta( $post_id, array( 'faq', 'seo_faq' ) ),
			'pageUrl'         => $page_url,
		);
	}

	public static function read_focus_keyword( int $post_id ): string {
		$kw = self::read_acf_or_meta( $post_id, array( 'keyword_focus' ) );
		if ( $kw !== '' ) {
			return $kw;
		}
		$rm = get_post_meta( $post_id, 'rank_math_focus_keyword', true );
		return is_string( $rm ) ? trim( $rm ) : '';
	}

	/**
	 * @param array<int,string> $keys
	 */
	public static function read_acf_or_meta( int $post_id, array $keys ): string {
		foreach ( $keys as $key ) {
			if ( function_exists( 'get_field' ) ) {
				$acf = get_field( $key, $post_id, false );
				if ( is_string( $acf ) || is_numeric( $acf ) ) {
					$text = trim( (string) $acf );
					if ( $text !== '' ) {
						return $text;
					}
				}
			}
			$meta = get_post_meta( $post_id, $key, true );
			if ( is_string( $meta ) && trim( $meta ) !== '' ) {
				return trim( $meta );
			}
		}
		return '';
	}

	public static function read_field_value( int $post_id, string $field ): string {
		switch ( $field ) {
			case 'title':
				$post = get_post( $post_id );
				return $post instanceof WP_Post ? self::read_seo_title( $post_id ) : '';
			case 'excerpt':
				return self::read_meta_description( $post_id );
			case 'focus_keyword':
				return self::read_focus_keyword( $post_id );
			case 'seo_research':
				return self::read_acf_or_meta( $post_id, array( 'seo_research' ) );
			case 'faq':
				return self::read_acf_or_meta( $post_id, array( 'faq', 'seo_faq' ) );
			case 'page_url':
				$val = self::read_acf_or_meta( $post_id, array( 'page_url' ) );
				if ( $val !== '' ) {
					return $val;
				}
				$url = get_permalink( $post_id );
				return is_string( $url ) ? $url : '';
			default:
				return '';
		}
	}

	/**
	 * @param array<int,string> $keys
	 */
	public static function resolve_write_key( int $post_id, array $keys ): string {
		foreach ( $keys as $key ) {
			if ( function_exists( 'get_field_object' ) ) {
				$obj = get_field_object( $key, $post_id, false, false );
				if ( is_array( $obj ) && ! empty( $obj['key'] ) ) {
					return $key;
				}
			}
			$meta = get_post_meta( $post_id, $key, true );
			if ( $meta !== '' && $meta !== false ) {
				return $key;
			}
		}
		return $keys[0];
	}
}
