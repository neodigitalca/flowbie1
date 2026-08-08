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
			'success' => true,
			'summary' => __( 'Chat log insights loaded.', 'flowbie-wp' ),
			'data'    => isset( $result['data'] ) && is_array( $result['data'] ) ? $result['data'] : array(),
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
