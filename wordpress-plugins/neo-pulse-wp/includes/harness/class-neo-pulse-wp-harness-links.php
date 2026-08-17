<?php
/**
 * Grep-scored linkable posts and HTML link allowlisting for harness generation.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Harness_Links {

	/**
	 * @return array<int, string>
	 */
	public static function extract_search_terms( string $query ): array {
		$stop_words = array(
			'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'for',
			'of', 'and', 'or', 'but', 'not', 'with', 'this', 'that', 'from',
			'by', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
			'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
			'may', 'might', 'can', 'i', 'you', 'we', 'they', 'he', 'she',
			'me', 'my', 'your', 'what', 'where', 'when', 'how', 'which',
			'who', 'whom', 'about', 'up', 'out', 'so', 'if', 'then', 'than',
			'too', 'very', 'just', 'more', 'also', 'any', 'each', 'all',
		);

		$query = strtolower( trim( $query ) );
		$query = preg_replace( '/[^\w\s]/', ' ', $query );
		$words = preg_split( '/\s+/', $query, -1, PREG_SPLIT_NO_EMPTY );
		$terms = array();

		foreach ( $words as $w ) {
			if ( strlen( $w ) >= 2 && ! in_array( $w, $stop_words, true ) ) {
				$terms[] = $w;
			}
		}

		return array_values( array_unique( $terms ) );
	}

	/**
	 * @param array<string, mixed> $post id, title, excerpt, slug, link
	 */
	public static function score_linkable_post( array $post, array $terms ): float {
		if ( empty( $terms ) ) {
			return 0.0;
		}

		$title   = isset( $post['title'] ) ? strtolower( (string) $post['title'] ) : '';
		$excerpt = isset( $post['excerpt'] ) ? strtolower( (string) $post['excerpt'] ) : '';
		$slug    = isset( $post['slug'] ) ? strtolower( (string) $post['slug'] ) : '';

		$score = 0.0;
		foreach ( $terms as $term ) {
			if ( $title !== '' && strpos( $title, $term ) !== false ) {
				$score += 3.0;
			}
			if ( $excerpt !== '' && strpos( $excerpt, $term ) !== false ) {
				$score += 2.0;
			}
			if ( $slug !== '' && strpos( $slug, $term ) !== false ) {
				$score += 1.5;
			}
		}

		return $score;
	}

	/**
	 * @param array<int, array<string, mixed>> $posts
	 * @return array<int, array<string, mixed>>
	 */
	public static function grep_linkable_posts( array $posts, string $query, int $limit = 25, int $exclude_post_id = 0 ): array {
		$limit = max( 1, min( 50, $limit ) );
		$terms = self::extract_search_terms( $query );

		$scored = array();
		foreach ( $posts as $post ) {
			if ( ! is_array( $post ) ) {
				continue;
			}
			$id = isset( $post['id'] ) ? (int) $post['id'] : 0;
			if ( $exclude_post_id > 0 && $id === $exclude_post_id ) {
				continue;
			}
			$link = isset( $post['link'] ) ? trim( (string) $post['link'] ) : '';
			if ( $link === '' ) {
				continue;
			}
			$score = self::score_linkable_post( $post, $terms );
			if ( $score <= 0 && ! empty( $terms ) ) {
				continue;
			}
			if ( empty( $terms ) ) {
				$score = 0.1;
			}
			$post['_score'] = $score;
			$scored[]       = $post;
		}

		usort(
			$scored,
			static function ( $a, $b ) {
				return ( $b['_score'] ?? 0 ) <=> ( $a['_score'] ?? 0 );
			}
		);

		$out = array_slice( $scored, 0, $limit );
		foreach ( $out as $i => $row ) {
			unset( $out[ $i ]['_score'] );
		}

		return $out;
	}

	/**
	 * @param array<int, array<string, mixed>> $posts
	 * @return array<string, bool> Normalized URL => true
	 */
	public static function allowed_url_set( array $posts, string $site_url ): array {
		$set = array();
		foreach ( $posts as $post ) {
			if ( ! is_array( $post ) || empty( $post['link'] ) ) {
				continue;
			}
			$norm = self::normalize_internal_url( $site_url, (string) $post['link'] );
			if ( $norm !== '' ) {
				$set[ $norm ] = true;
			}
		}
		return $set;
	}

	public static function normalize_internal_url( string $site_url, string $link ): string {
		$link = trim( $link );
		if ( $link === '' ) {
			return '';
		}
		$base = rtrim( home_url( '/' ), '/' );
		if ( $site_url !== '' ) {
			$base = rtrim( $site_url, '/' );
		}
		if ( ! preg_match( '#^https?://#i', $link ) ) {
			$link = $base . ( strpos( $link, '/' ) === 0 ? $link : '/' . $link );
		}
		$parsed = wp_parse_url( $link );
		if ( ! is_array( $parsed ) || empty( $parsed['host'] ) ) {
			return '';
		}
		$scheme = isset( $parsed['scheme'] ) ? strtolower( $parsed['scheme'] ) : 'https';
		$host   = strtolower( (string) $parsed['host'] );
		$path   = isset( $parsed['path'] ) ? $parsed['path'] : '/';
		$query  = isset( $parsed['query'] ) ? '?' . $parsed['query'] : '';
		return strtolower( $scheme . '://' . $host . rtrim( $path, '/' ) . $query );
	}

	/**
	 * Remove or unwrap internal links not on the allowlist. External hosts are left unchanged.
	 *
	 * @param array<string, bool> $allowed_urls
	 */
	public static function strip_unknown_internal_links( string $html, array $allowed_urls, string $site_url ): string {
		if ( $html === '' || ! preg_match( '/<a\s/i', $html ) ) {
			return $html;
		}

		$base      = rtrim( $site_url !== '' ? $site_url : home_url( '/' ), '/' );
		$base_host = strtolower( (string) wp_parse_url( $base, PHP_URL_HOST ) );
		$base_host = preg_replace( '/^www\./', '', (string) $base_host );

		if ( $base_host === '' ) {
			return $html;
		}

		return preg_replace_callback(
			'/<a\s+([^>]*?)href=(["\'])(.*?)\2([^>]*)>(.*?)<\/a>/is',
			static function ( $m ) use ( $allowed_urls, $site_url, $base_host ) {
				$href = html_entity_decode( trim( $m[3] ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
				if ( $href === '' || $href === '#' ) {
					return $m[5];
				}
				$norm = self::normalize_internal_url( $site_url, $href );
				$host = '';
				if ( preg_match( '#^https?://#i', $href ) ) {
					$host = strtolower( (string) wp_parse_url( $href, PHP_URL_HOST ) );
					$host = preg_replace( '/^www\./', '', $host );
				} else {
					$host = $base_host;
				}
				if ( $host !== $base_host ) {
					return $m[0];
				}
				if ( $norm !== '' && ! empty( $allowed_urls[ $norm ] ) ) {
					return $m[0];
				}
				return $m[5];
			},
			$html
		) ?? $html;
	}

	/**
	 * Strip all same-site anchor tags (when internal linking was not requested).
	 *
	 * @param array<string, bool> $allowed_urls Unused; pass empty to strip all internal links.
	 */
	public static function strip_all_internal_links( string $html, string $site_url ): string {
		return self::strip_unknown_internal_links( $html, array(), $site_url );
	}
}
