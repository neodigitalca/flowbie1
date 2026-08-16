<?php
/**
 * Resolve [[LINK:query|anchor]] placeholders against posts bucket inventory.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Internal_Link_Resolver {

	/**
	 * @param array<int,array<string,mixed>> $posts
	 */
	public static function resolve_markdown(
		string $markdown,
		array $posts,
		string $site_url,
		string $current_page_url = ''
	): string {
		if ( trim( $markdown ) === '' || empty( $posts ) ) {
			return $markdown;
		}

		$used = array();
		return (string) preg_replace_callback(
			'/\[\[LINK:([^|\]]+)\|([^\]]+)\]\]/',
			static function ( array $m ) use ( $posts, $site_url, $current_page_url, &$used ) {
				$query  = trim( (string) ( $m[1] ?? '' ) );
				$anchor = trim( (string) ( $m[2] ?? '' ) );
				if ( $query === '' || $anchor === '' ) {
					return $anchor !== '' ? $anchor : $query;
				}

				$post = self::pick_post_for_query( $query, $anchor, $posts, $site_url, $current_page_url, $used );
				if ( ! $post ) {
					return $anchor;
				}

				$link = trim( (string) ( $post['link'] ?? '' ) );
				if ( $link === '' ) {
					return $anchor;
				}

				$used[ self::normalize_url( $link ) ] = true;
				$safe = str_replace( array( '[', ']', '(', ')' ), '', $anchor );
				return '[' . $safe . '](' . $link . ')';
			},
			$markdown
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $posts
	 * @param array<string,bool>             $used
	 * @return array<string,mixed>|null
	 */
	private static function pick_post_for_query(
		string $query,
		string $anchor,
		array $posts,
		string $site_url,
		string $current_page_url,
		array &$used
	): ?array {
		$queries = array( $query );
		$anchor  = trim( $anchor );
		if ( $anchor !== '' && $anchor !== $query ) {
			$queries[] = $anchor;
		}

		foreach ( $queries as $q ) {
			$q = trim( $q );
			if ( $q === '' ) {
				continue;
			}
			$ranked = self::rank_posts_for_query( $q, $posts );
			foreach ( $ranked as $row ) {
				$post = $row['post'];
				$link = trim( (string) ( $post['link'] ?? '' ) );
				if ( $link === '' ) {
					continue;
				}
				if ( self::is_self_link( $link, $current_page_url, $site_url ) ) {
					continue;
				}
				$norm = self::normalize_url( $link );
				if ( isset( $used[ $norm ] ) ) {
					continue;
				}
				return $post;
			}
		}

		return null;
	}

	/**
	 * @param array<int,array<string,mixed>> $posts
	 * @return array<int,array{post:array<string,mixed>,score:int}>
	 */
	private static function rank_posts_for_query( string $query, array $posts ): array {
		$out = array();
		foreach ( $posts as $post ) {
			if ( ! is_array( $post ) ) {
				continue;
			}
			$score = self::score_post_for_query( $post, $query );
			if ( $score > 0 ) {
				$out[] = array(
					'post'  => $post,
					'score' => $score,
				);
			}
		}
		usort(
			$out,
			static function ( $a, $b ) {
				return $b['score'] <=> $a['score'];
			}
		);
		return $out;
	}

	/**
	 * @param array<string,mixed> $post
	 */
	private static function score_post_for_query( array $post, string $query ): int {
		$query_lower = strtolower( trim( $query ) );
		if ( $query_lower === '' ) {
			return 0;
		}

		$title   = (string) ( $post['title'] ?? '' );
		$slug    = (string) ( $post['slug'] ?? '' );
		$excerpt = (string) ( $post['excerpt'] ?? '' );
		$link    = (string) ( $post['link'] ?? '' );

		$query_norm  = self::normalize_label( $query );
		$title_norm  = self::normalize_label( $title !== '' ? $title : $slug );
		$slug_norm   = self::normalize_label( str_replace( '-', ' ', $slug ) );
		$excerpt_norm = self::normalize_label( $excerpt );
		$score       = 0;

		if ( stripos( $title, $query ) !== false ) {
			$score += 10;
		}
		if ( $title_norm === $query_norm ) {
			$score += 20;
		}
		if ( stripos( $link, str_replace( ' ', '-', $query_lower ) ) !== false ) {
			$score += 5;
		}
		if ( $slug_norm !== '' && ( strpos( $slug_norm, $query_norm ) !== false || strpos( $query_norm, $slug_norm ) !== false ) ) {
			$score += 8;
		}
		if ( stripos( $excerpt, $query ) !== false ) {
			$score += 2;
		}

		$query_words = array_values(
			array_filter(
				explode( ' ', $query_norm ),
				static function ( $w ) {
					return strlen( $w ) > 2;
				}
			)
		);
		$title_words = array_flip( explode( ' ', $title_norm ) );
		$overlap     = 0;
		foreach ( $query_words as $word ) {
			if ( isset( $title_words[ $word ] ) ) {
				++$overlap;
			}
		}
		$score += $overlap * 4;

		return $score;
	}

	private static function normalize_label( string $value ): string {
		$value = strtolower( wp_strip_all_tags( $value ) );
		$value = preg_replace( '/[^a-z0-9]+/', ' ', $value );
		return trim( (string) $value );
	}

	private static function normalize_url( string $url ): string {
		return rtrim( strtolower( trim( $url ) ), '/' );
	}

	private static function is_self_link( string $link, string $current_page_url, string $site_url ): bool {
		if ( trim( $current_page_url ) === '' ) {
			return false;
		}
		return self::normalize_url( $link ) === self::normalize_url( $current_page_url );
	}
}
