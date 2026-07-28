<?php
/**
 * RAG context builder for the Flowbie Chat widget.
 *
 * Fetches the site post/page inventory via get_posts(), caches it as a transient,
 * and scores posts against a user query using weighted keyword matching.
 * Supports configurable post types, category exclusions, and a custom knowledge base.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Chat_Rag {

	const CACHE_KEY   = 'flowbie_chat_context_cache';
	const CACHE_TTL   = 3600;
	const MAX_RESULTS = 8;

	/**
	 * Build or retrieve the cached site content index.
	 *
	 * @param array $settings Optional chat settings for post type / category filtering.
	 * @return array<int,array{id:int,title:string,url:string,excerpt:string,type:string,categories:string[],tags:string[]}>
	 */
	public static function get_site_index( array $settings = array() ): array {
		$cached = get_transient( self::CACHE_KEY );
		if ( is_array( $cached ) && ! empty( $cached ) ) {
			return $cached;
		}

		$index = self::build_index( $settings );
		if ( ! empty( $index ) ) {
			set_transient( self::CACHE_KEY, $index, self::CACHE_TTL );
		}

		return $index;
	}

	/**
	 * Score and rank posts by relevance to the user query.
	 */
	public static function retrieve( string $query, int $limit = self::MAX_RESULTS ): array {
		$index = self::get_site_index();
		if ( empty( $index ) ) {
			return array();
		}

		$terms = self::extract_terms( $query );
		if ( empty( $terms ) ) {
			return array_slice( $index, 0, $limit );
		}

		$scored = array();
		foreach ( $index as $item ) {
			$score = self::score_item( $item, $terms );
			if ( $score > 0 ) {
				$item['score'] = $score;
				$scored[]      = $item;
			}
		}

		usort(
			$scored,
			function ( $a, $b ) {
				return $b['score'] <=> $a['score'];
			}
		);

		return array_slice( $scored, 0, $limit );
	}

	/**
	 * Format retrieved items into a context string for the LLM system prompt.
	 * Prepends knowledge base entries when provided.
	 *
	 * @param array $items         Retrieved items from retrieve().
	 * @param array $knowledge_base Optional KB entries from training settings.
	 * @return string
	 */
	public static function format_context( array $items, array $knowledge_base = array() ): string {
		$parts = array();

		if ( ! empty( $knowledge_base ) ) {
			foreach ( $knowledge_base as $kb ) {
				$q = isset( $kb['question'] ) ? $kb['question'] : '';
				$a = isset( $kb['answer'] ) ? $kb['answer'] : '';
				$p = isset( $kb['priority'] ) && $kb['priority'] === 'high' ? 'HIGH PRIORITY' : 'KNOWLEDGE BASE';
				if ( $q !== '' || $a !== '' ) {
					$parts[] = "[{$p}] Q: {$q}\nA: {$a}";
				}
			}
		}

		foreach ( $items as $i => $item ) {
			$n       = $i + 1;
			$parts[] = "[{$n}] {$item['title']}\nURL: {$item['url']}\nType: {$item['type']}\n{$item['excerpt']}";
		}

		return implode( "\n\n", $parts );
	}

	/**
	 * Build the full site index from configured post types.
	 */
	private static function build_index( array $settings = array() ): array {
		$index = array();

		$post_types = isset( $settings['indexed_post_types'] ) && is_array( $settings['indexed_post_types'] ) && ! empty( $settings['indexed_post_types'] )
			? $settings['indexed_post_types']
			: array( 'post', 'page' );

		$excluded_cats = isset( $settings['excluded_categories'] ) && is_array( $settings['excluded_categories'] )
			? array_map( 'absint', $settings['excluded_categories'] )
			: array();

		$full_content = ! empty( $settings['full_content'] );
		$trim_length  = $full_content ? 120 : 40;

		foreach ( $post_types as $pt ) {
			$page = 1;
			do {
				$query_args = array(
					'post_type'      => $pt,
					'post_status'    => 'publish',
					'posts_per_page' => 100,
					'paged'          => $page,
					'orderby'        => 'date',
					'order'          => 'DESC',
				);

				if ( ! empty( $excluded_cats ) && ( $pt === 'post' || is_object_in_taxonomy( $pt, 'category' ) ) ) {
					$query_args['category__not_in'] = $excluded_cats;
				}

				$items = get_posts( $query_args );

				foreach ( $items as $post ) {
					$cats = array();
					$tags = array();

					if ( is_object_in_taxonomy( $pt, 'category' ) ) {
						$cat_terms = get_the_terms( $post->ID, 'category' );
						if ( is_array( $cat_terms ) ) {
							$cats = wp_list_pluck( $cat_terms, 'name' );
						}
					}
					if ( is_object_in_taxonomy( $pt, 'post_tag' ) ) {
						$tag_terms = get_the_terms( $post->ID, 'post_tag' );
						if ( is_array( $tag_terms ) ) {
							$tags = wp_list_pluck( $tag_terms, 'name' );
						}
					}

					$excerpt = has_excerpt( $post->ID )
						? wp_strip_all_tags( get_the_excerpt( $post ) )
						: wp_trim_words( wp_strip_all_tags( $post->post_content ), $trim_length, '...' );

					$index[] = array(
						'id'         => $post->ID,
						'title'      => get_the_title( $post ),
						'url'        => get_permalink( $post ),
						'excerpt'    => $excerpt,
						'type'       => $pt,
						'categories' => $cats,
						'tags'       => $tags,
					);
				}

				$page++;
			} while ( count( $items ) === 100 );
		}

		return $index;
	}

	/**
	 * Extract meaningful search terms from a query string.
	 */
	private static function extract_terms( string $query ): array {
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

		$query  = strtolower( trim( $query ) );
		$query  = preg_replace( '/[^\w\s]/', ' ', $query );
		$words  = preg_split( '/\s+/', $query, -1, PREG_SPLIT_NO_EMPTY );
		$terms  = array();

		foreach ( $words as $w ) {
			if ( strlen( $w ) >= 2 && ! in_array( $w, $stop_words, true ) ) {
				$terms[] = $w;
			}
		}

		return array_unique( $terms );
	}

	/**
	 * Score a single index item against the extracted terms.
	 * Title matches weighted 3x, excerpt 2x, categories/tags 1x.
	 */
	private static function score_item( array $item, array $terms ): float {
		$score         = 0.0;
		$title_lower   = strtolower( $item['title'] );
		$excerpt_lower = strtolower( $item['excerpt'] );
		$cats_lower    = strtolower( implode( ' ', $item['categories'] ?? array() ) );
		$tags_lower    = strtolower( implode( ' ', $item['tags'] ?? array() ) );

		foreach ( $terms as $term ) {
			if ( strpos( $title_lower, $term ) !== false ) {
				$score += 3.0;
			}
			if ( strpos( $excerpt_lower, $term ) !== false ) {
				$score += 2.0;
			}
			if ( strpos( $cats_lower, $term ) !== false ) {
				$score += 1.0;
			}
			if ( strpos( $tags_lower, $term ) !== false ) {
				$score += 1.0;
			}
		}

		return $score;
	}

	/**
	 * Invalidate the cached index (call on post save, training save, etc.).
	 */
	public static function invalidate_cache(): void {
		delete_transient( self::CACHE_KEY );
		delete_transient( self::AGENT_INDEX_CACHE_KEY );
		delete_transient( self::AGENT_INDEX_CACHE_KEY . '_drafts' );
	}

	const AGENT_INDEX_CACHE_KEY = 'flowbie_agent_site_index_cache';

	/**
	 * Site index for MCP/agents: published + optional drafts, with SEO fields.
	 *
	 * @param bool $include_drafts Include non-publish statuses.
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_agent_site_index( bool $include_drafts = false ): array {
		$cache_key = self::AGENT_INDEX_CACHE_KEY . ( $include_drafts ? '_drafts' : '' );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) && ! empty( $cached ) ) {
			return $cached;
		}

		$statuses = $include_drafts
			? array( 'publish', 'draft', 'pending', 'future', 'private' )
			: array( 'publish' );

		$post_types = apply_filters( 'flowbie_wp_agent_index_post_types', array( 'post', 'page' ) );
		$index      = array();

		foreach ( $post_types as $pt ) {
			if ( ! post_type_exists( $pt ) ) {
				continue;
			}
			$page = 1;
			do {
				$items = get_posts(
					array(
						'post_type'      => $pt,
						'post_status'    => $statuses,
						'posts_per_page' => 100,
						'paged'          => $page,
						'orderby'        => 'modified',
						'order'          => 'DESC',
					)
				);
				foreach ( $items as $post ) {
					$focus = Flowbie_Wp_Ai_Context::read_focus_keyword( $post->ID );
					$research = Flowbie_Wp_Ai_Context::read_field_value( $post->ID, 'seo_research' );
					$index[] = array(
						'id'             => $post->ID,
						'title'          => get_the_title( $post ),
						'url'            => get_permalink( $post ),
						'excerpt'        => has_excerpt( $post->ID )
							? wp_strip_all_tags( get_the_excerpt( $post ) )
							: wp_trim_words( wp_strip_all_tags( $post->post_content ), 40, '...' ),
						'type'           => $pt,
						'status'         => $post->post_status,
						'focus_keyword'  => $focus,
						'has_seo_research' => $research !== '',
						'modified'       => $post->post_modified_gmt,
					);
				}
				$page++;
			} while ( count( $items ) === 100 );
		}

		if ( ! empty( $index ) ) {
			set_transient( $cache_key, $index, self::CACHE_TTL );
		}

		return $index;
	}

	/**
	 * Search agent site index (same scoring as visitor RAG).
	 *
	 * @param string $query Query.
	 * @param int    $limit Max results.
	 * @return array<int, array<string, mixed>>
	 */
	public static function retrieve_agent( string $query, int $limit = self::MAX_RESULTS ): array {
		$index = self::get_agent_site_index( false );
		if ( empty( $index ) ) {
			return array();
		}

		$terms = self::extract_terms( $query );
		if ( empty( $terms ) ) {
			return array_slice( $index, 0, $limit );
		}

		$scored = array();
		foreach ( $index as $item ) {
			$score = self::score_item( $item, $terms );
			if ( ! empty( $item['focus_keyword'] ) ) {
				foreach ( $terms as $term ) {
					if ( strpos( strtolower( (string) $item['focus_keyword'] ), $term ) !== false ) {
						$score += 2.0;
					}
				}
			}
			if ( $score > 0 ) {
				$item['score'] = $score;
				$scored[]      = $item;
			}
		}

		usort(
			$scored,
			function ( $a, $b ) {
				return ( $b['score'] ?? 0 ) <=> ( $a['score'] ?? 0 );
			}
		);

		return array_slice( $scored, 0, $limit );
	}
}
