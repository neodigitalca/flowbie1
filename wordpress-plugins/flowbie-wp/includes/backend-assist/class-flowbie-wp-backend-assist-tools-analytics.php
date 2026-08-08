<?php
/**
 * Backend Assist — analytics and knowledge-gap tools.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Tools_Analytics {

	public static function register_tools(): void {
		Flowbie_Wp_Backend_Assist_Registry::register_tool(
			'get_chat_insights',
			array( __CLASS__, 'tool_get_chat_insights' ),
			'Visitor chat log summary: repeated questions, top queries, weak answers, knowledge gaps (last 30 days by default)'
		);

		Flowbie_Wp_Backend_Assist_Registry::register_tool(
			'get_search_insights',
			array( __CLASS__, 'tool_get_search_insights' ),
			'Site search log summary: popular queries and zero-result searches'
		);

		Flowbie_Wp_Backend_Assist_Registry::register_tool(
			'get_overseer_summary',
			array( __CLASS__, 'tool_get_overseer_summary' ),
			'Overseer behavioral analytics summary: sessions, pageviews, engagement, conversions'
		);

		Flowbie_Wp_Backend_Assist_Registry::register_tool(
			'list_overseer_tasks',
			array( __CLASS__, 'tool_list_overseer_tasks' ),
			'List open Overseer actionable tasks (pending or approved)'
		);

		Flowbie_Wp_Backend_Assist_Registry::register_tool(
			'get_site_inventory',
			array( __CLASS__, 'tool_get_site_inventory' ),
			'Cached full-site content inventory (all sitemap post types). Optional: post_type, query, limit'
		);

		Flowbie_Wp_Backend_Assist_Registry::register_tool(
			'analyze_content_gaps',
			array( __CLASS__, 'tool_analyze_content_gaps' ),
			'Compare cached site blog inventory with chat log gaps to suggest NEW content ideas only. Use for blog ideas, content gaps, knowledge gaps for new customers.'
		);

		Flowbie_Wp_Backend_Assist_Registry::register_tool(
			'grade_post_library_seo',
			array( __CLASS__, 'tool_grade_post_library_seo' ),
			'Grade the full cached post library for SEO using on-page signals (keyword, meta, FAQ, research). Use for post library audits and SEO grading.'
		);
	}

	/**
	 * @param array<string, mixed> $params days, source_filter.
	 * @return array<string, mixed>
	 */
	public static function tool_get_chat_insights( array $params ): array {
		if ( ! current_user_can( 'manage_options' ) ) {
			return array(
				'success' => false,
				'error'   => __( 'Analytics requires site admin access.', 'flowbie-wp' ),
			);
		}

		$days = isset( $params['days'] ) ? max( 1, min( 90, (int) $params['days'] ) ) : Flowbie_Wp_Chat_Insights::DEFAULT_DAYS;
		$result = Flowbie_Wp_Chat_Insights::get_insights(
			array(
				'days'          => $days,
				'source_filter' => isset( $params['source_filter'] ) ? (string) $params['source_filter'] : 'frontend',
			)
		);

		if ( empty( $result['ok'] ) ) {
			return array(
				'success' => false,
				'error'   => isset( $result['error'] ) ? (string) $result['error'] : __( 'Could not load chat insights.', 'flowbie-wp' ),
			);
		}

		return array(
			'success'                 => true,
			'summary'                 => __( 'Chat log insights loaded.', 'flowbie-wp' ),
			'data'                    => isset( $result['data'] ) && is_array( $result['data'] ) ? $result['data'] : array(),
			'existing_site_coverage'  => Flowbie_Wp_Site_Inventory::build_coverage_snapshot( 500 ),
		);
	}

	/**
	 * @param array<string, mixed> $params post_type, query, limit.
	 * @return array<string, mixed>
	 */
	public static function tool_get_site_inventory( array $params ): array {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return array(
				'success' => false,
				'error'   => __( 'Site inventory requires editor access.', 'flowbie-wp' ),
			);
		}

		$filters = array(
			'include_drafts' => true,
		);
		if ( isset( $params['limit'] ) ) {
			$filters['limit'] = max( 1, min( 500, (int) $params['limit'] ) );
		}
		if ( ! empty( $params['post_type'] ) ) {
			$filters['post_type'] = sanitize_key( (string) $params['post_type'] );
		}
		if ( ! empty( $params['query'] ) ) {
			$filters['query'] = sanitize_text_field( (string) $params['query'] );
		}

		Flowbie_Wp_Site_Inventory::warm( true );
		$items = Flowbie_Wp_Site_Inventory::get_items( $filters );
		$meta  = Flowbie_Wp_Site_Inventory::get_meta();

		return array(
			'success' => true,
			'summary' => __( 'Site inventory loaded from cache.', 'flowbie-wp' ),
			'count'   => count( $items ),
			'total'   => (int) ( $meta['count'] ?? count( $items ) ),
			'by_type' => isset( $meta['by_type'] ) && is_array( $meta['by_type'] ) ? $meta['by_type'] : array(),
			'items'   => $items,
		);
	}

	/**
	 * Site blog inventory cross-checked with chat gaps.
	 *
	 * @param array<string, mixed> $params days, source_filter, post_type (default post).
	 * @return array<string, mixed>
	 */
	public static function tool_analyze_content_gaps( array $params ): array {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return array(
				'success' => false,
				'error'   => __( 'Content gap analysis requires editor access.', 'flowbie-wp' ),
			);
		}

		$post_type = ! empty( $params['post_type'] ) ? sanitize_key( (string) $params['post_type'] ) : 'post';
		Flowbie_Wp_Site_Inventory::warm( true );
		$blogs   = Flowbie_Wp_Site_Inventory::get_type_items( $post_type );
		$meta    = Flowbie_Wp_Site_Inventory::get_meta();
		$blog_rows = array();
		foreach ( $blogs as $item ) {
			$blog_rows[] = array(
				'id'             => (int) ( $item['id'] ?? 0 ),
				'title'          => (string) ( $item['title'] ?? '' ),
				'url'            => (string) ( $item['url'] ?? '' ),
				'focus_keyword'  => (string) ( $item['focus_keyword'] ?? '' ),
				'excerpt'        => (string) ( $item['excerpt'] ?? '' ),
				'status'         => (string) ( $item['status'] ?? 'publish' ),
			);
		}

		$chat_data = array();
		if ( current_user_can( 'manage_options' ) ) {
			$days   = isset( $params['days'] ) ? max( 1, min( 90, (int) $params['days'] ) ) : Flowbie_Wp_Chat_Insights::DEFAULT_DAYS;
			$result = Flowbie_Wp_Chat_Insights::get_insights(
				array(
					'days'          => $days,
					'source_filter' => isset( $params['source_filter'] ) ? (string) $params['source_filter'] : 'frontend',
				)
			);
			if ( ! empty( $result['ok'] ) && isset( $result['data'] ) && is_array( $result['data'] ) ) {
				$chat_data = $result['data'];
			}
		}

		return array(
			'success'                => true,
			'summary'                => __( 'Content gap analysis loaded from site cache and chat logs.', 'flowbie-wp' ),
			'existing_blogs'         => $blog_rows,
			'existing_blogs_count'   => count( $blog_rows ),
			'blog_inventory_summary' => Flowbie_Wp_Site_Inventory::build_type_inventory_summary( $post_type ),
			'site_total_urls'        => (int) ( $meta['count'] ?? 0 ),
			'site_by_type'           => isset( $meta['by_type'] ) && is_array( $meta['by_type'] ) ? $meta['by_type'] : array(),
			'chat_insights'          => $chat_data,
		);
	}

	/**
	 * Grade all cached posts for on-page SEO signals.
	 *
	 * @param array<string, mixed> $params post_type (default post).
	 * @return array<string, mixed>
	 */
	public static function tool_grade_post_library_seo( array $params ): array {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return array(
				'success' => false,
				'error'   => __( 'Post library SEO grading requires editor access.', 'flowbie-wp' ),
			);
		}

		$post_type = ! empty( $params['post_type'] ) ? sanitize_key( (string) $params['post_type'] ) : 'post';
		Flowbie_Wp_Site_Inventory::warm( true );
		$items = Flowbie_Wp_Site_Inventory::get_type_items( $post_type );

		$posts   = array();
		$summary = array(
			'A'               => 0,
			'B'               => 0,
			'C'               => 0,
			'D'               => 0,
			'missing_keyword' => 0,
			'missing_meta'    => 0,
		);

		foreach ( $items as $item ) {
			$post_id = (int) ( $item['id'] ?? 0 );
			if ( $post_id < 1 ) {
				continue;
			}

			$meta    = Flowbie_Wp_Ai_Context::meta_hub_values( $post_id );
			$title   = (string) ( $item['title'] ?? $meta['seoTitle'] ?? '' );
			$url     = (string) ( $item['url'] ?? '' );
			$keyword = trim( (string) ( $meta['focusKeyword'] ?? $item['focus_keyword'] ?? '' ) );
			$meta_desc = trim( (string) ( $meta['metaDescription'] ?? '' ) );
			$excerpt   = trim( (string) ( $item['excerpt'] ?? '' ) );
			$faq       = trim( (string) ( $meta['faq'] ?? '' ) );
			$research  = trim( (string) ( $meta['seoResearch'] ?? '' ) );

			$issues = array();
			if ( $keyword === '' ) {
				$issues[] = 'missing_focus_keyword';
				$summary['missing_keyword']++;
			}
			if ( $meta_desc === '' ) {
				$issues[] = 'missing_meta_description';
				$summary['missing_meta']++;
			} elseif ( strlen( $meta_desc ) < 70 ) {
				$issues[] = 'meta_description_short';
			} elseif ( strlen( $meta_desc ) > 160 ) {
				$issues[] = 'meta_description_long';
			}
			if ( $excerpt === '' ) {
				$issues[] = 'missing_excerpt';
			}
			if ( $faq === '' ) {
				$issues[] = 'missing_faq';
			}
			if ( $research === '' ) {
				$issues[] = 'missing_seo_research';
			}

			$score = 0;
			if ( $keyword !== '' ) {
				$score += 2;
			}
			if ( $meta_desc !== '' && strlen( $meta_desc ) >= 70 && strlen( $meta_desc ) <= 160 ) {
				$score += 2;
			} elseif ( $meta_desc !== '' ) {
				$score += 1;
			}
			if ( $excerpt !== '' ) {
				$score += 1;
			}
			if ( $faq !== '' ) {
				$score += 1;
			}
			if ( $research !== '' ) {
				$score += 1;
			}

			if ( $score >= 6 ) {
				$grade = 'A';
			} elseif ( $score >= 4 ) {
				$grade = 'B';
			} elseif ( $score >= 2 ) {
				$grade = 'C';
			} else {
				$grade = 'D';
			}
			$summary[ $grade ]++;

			$posts[] = array(
				'id'       => $post_id,
				'title'    => $title,
				'url'      => $url,
				'grade'    => $grade,
				'issues'   => $issues,
				'signals'  => array(
					'focus_keyword'     => $keyword,
					'meta_description'  => $meta_desc,
					'has_faq'           => $faq !== '',
					'has_seo_research'  => $research !== '',
					'excerpt_present'   => $excerpt !== '',
				),
			);
		}

		usort(
			$posts,
			static function ( $a, $b ) {
				$order = array( 'D' => 0, 'C' => 1, 'B' => 2, 'A' => 3 );
				$ga    = $order[ (string) ( $a['grade'] ?? 'D' ) ] ?? 9;
				$gb    = $order[ (string) ( $b['grade'] ?? 'D' ) ] ?? 9;
				return $ga <=> $gb;
			}
		);

		$site_top_queries = array();
		if ( Flowbie_Wp_Gsc_Prompt::is_available() ) {
			$range = Flowbie_Wp_Gsc::default_date_range();
			$site  = Flowbie_Wp_Gsc::fetch_stats_for_range( $range['start'], $range['end'], 15 );
			if ( ! is_wp_error( $site ) && ! empty( $site['topQueries'] ) && is_array( $site['topQueries'] ) ) {
				$site_top_queries = array_slice( $site['topQueries'], 0, 15 );
			}
		}

		return array(
			'success'          => true,
			'summary'          => $summary,
			'total'            => count( $posts ),
			'post_type'        => $post_type,
			'posts'            => $posts,
			'site_top_queries' => $site_top_queries,
		);
	}

	/**
	 * @param array<string, mixed> $params days, limit.
	 * @return array<string, mixed>
	 */
	public static function tool_get_search_insights( array $params ): array {
		if ( ! current_user_can( 'manage_options' ) ) {
			return array(
				'success' => false,
				'error'   => __( 'Analytics requires site admin access.', 'flowbie-wp' ),
			);
		}

		$days  = isset( $params['days'] ) ? max( 1, min( 90, (int) $params['days'] ) ) : 30;
		$limit = isset( $params['limit'] ) ? max( 1, min( 20, (int) $params['limit'] ) ) : 10;

		$popular     = Flowbie_Wp_Search_Logs::aggregate_popular_terms( $days, $limit );
		$zero_result = self::aggregate_zero_result_searches( $days, $limit );

		return array(
			'success' => true,
			'summary' => __( 'Search log insights loaded.', 'flowbie-wp' ),
			'data'    => array(
				'days'               => $days,
				'popular_queries'    => $popular,
				'zero_result_queries' => $zero_result,
			),
		);
	}

	/**
	 * @param array<string, mixed> $params date_from, date_to (YYYY-MM-DD).
	 * @return array<string, mixed>
	 */
	public static function tool_get_overseer_summary( array $params ): array {
		if ( ! current_user_can( 'manage_options' ) ) {
			return array(
				'success' => false,
				'error'   => __( 'Analytics requires site admin access.', 'flowbie-wp' ),
			);
		}

		$date_to   = isset( $params['date_to'] ) ? sanitize_text_field( (string) $params['date_to'] ) : gmdate( 'Y-m-d' );
		$date_from = isset( $params['date_from'] ) ? sanitize_text_field( (string) $params['date_from'] ) : gmdate( 'Y-m-d', time() - ( 30 * DAY_IN_SECONDS ) );

		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			return array(
				'success' => false,
				'error'   => __( 'Invalid date range.', 'flowbie-wp' ),
			);
		}

		$summary = Flowbie_Wp_Overseer_Aggregates::aggregate_summary( $date_from, $date_to );
		$by_page = Flowbie_Wp_Overseer_Aggregates::aggregate_by_page( $date_from, $date_to );

		return array(
			'success' => true,
			'summary' => __( 'Overseer summary loaded.', 'flowbie-wp' ),
			'data'    => array(
				'date_from' => $date_from,
				'date_to'   => $date_to,
				'summary'   => $summary,
				'top_pages' => array_slice( is_array( $by_page ) ? $by_page : array(), 0, 10 ),
			),
		);
	}

	/**
	 * @param array<string, mixed> $params status, limit.
	 * @return array<string, mixed>
	 */
	public static function tool_list_overseer_tasks( array $params ): array {
		if ( ! current_user_can( 'manage_options' ) ) {
			return array(
				'success' => false,
				'error'   => __( 'Analytics requires site admin access.', 'flowbie-wp' ),
			);
		}

		$status = isset( $params['status'] ) ? sanitize_key( (string) $params['status'] ) : 'pending';
		$limit  = isset( $params['limit'] ) ? max( 1, min( 50, (int) $params['limit'] ) ) : 20;

		$query = Flowbie_Wp_Overseer_Tasks::query(
			array(
				'status'   => $status,
				'per_page' => $limit,
				'page'     => 1,
			)
		);

		$items = array();
		foreach ( $query['items'] as $task ) {
			$items[] = array(
				'id'       => isset( $task->id ) ? (int) $task->id : 0,
				'title'    => isset( $task->title ) ? (string) $task->title : '',
				'category' => isset( $task->category ) ? (string) $task->category : '',
				'priority' => isset( $task->priority ) ? (int) $task->priority : 0,
				'status'   => isset( $task->status ) ? (string) $task->status : '',
			);
		}

		return array(
			'success' => true,
			'summary' => sprintf(
				/* translators: %d: task count */
				__( '%d Overseer tasks loaded.', 'flowbie-wp' ),
				count( $items )
			),
			'data'    => array(
				'status_filter' => $status,
				'total'         => isset( $query['total'] ) ? (int) $query['total'] : count( $items ),
				'tasks'         => $items,
			),
		);
	}

	/**
	 * @return array<int, array{query: string, count: int}>
	 */
	private static function aggregate_zero_result_searches( int $days, int $limit ): array {
		global $wpdb;
		$table  = Flowbie_Wp_Search_Logs::table_name();
		$cutoff = gmdate( 'Y-m-d H:i:s', time() - ( max( 1, $days ) * DAY_IN_SECONDS ) );
		$limit  = max( 1, min( 20, $limit ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT query, query_normalized, COUNT(*) AS search_count
				FROM {$table}
				WHERE created_at >= %s AND query_normalized != '' AND result_count = 0
				GROUP BY query_normalized
				ORDER BY search_count DESC
				LIMIT %d",
				$cutoff,
				$limit
			)
		);

		$out = array();
		if ( is_array( $rows ) ) {
			foreach ( $rows as $row ) {
				$out[] = array(
					'query' => (string) $row->query,
					'count' => (int) $row->search_count,
				);
			}
		}
		return $out;
	}
}
