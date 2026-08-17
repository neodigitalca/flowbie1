<?php
/**
 * Overseer AI analysis actionable tasks.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Overseer_Tasks {

	const STATUSES = array( 'pending', 'approved', 'running', 'done', 'dismissed' );

	const CATEGORIES = array( 'content', 'navigation', 'conversion', 'technical' );

	/**
	 * @return object|null
	 */
	public static function get( int $id ) {
		global $wpdb;
		if ( $id < 1 ) {
			return null;
		}
		$table = Neo_Pulse_Wp_Overseer::tasks_table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ) );
		return $row ? $row : null;
	}

	/**
	 * @param array<string, mixed> $args Query args.
	 * @return array{items: array<int, object>, total: int}
	 */
	public static function query( array $args = array() ): array {
		global $wpdb;
		$table  = Neo_Pulse_Wp_Overseer::tasks_table_name();
		$where  = array( '1=1' );
		$params = array();

		$report_id = isset( $args['report_id'] ) ? (int) $args['report_id'] : 0;
		if ( $report_id > 0 ) {
			$where[]  = 'report_id = %d';
			$params[] = $report_id;
		}

		$status = isset( $args['status'] ) ? sanitize_key( (string) $args['status'] ) : '';
		if ( $status !== '' && in_array( $status, self::STATUSES, true ) ) {
			$where[]  = 'status = %s';
			$params[] = $status;
		}

		$where_sql = implode( ' AND ', $where );
		$count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where_sql}";
		if ( ! empty( $params ) ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$total = (int) $wpdb->get_var( $wpdb->prepare( $count_sql, $params ) );
		} else {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$total = (int) $wpdb->get_var( $count_sql );
		}

		$per_page = isset( $args['per_page'] ) ? max( 1, min( 100, (int) $args['per_page'] ) ) : 20;
		$page     = isset( $args['page'] ) ? max( 1, (int) $args['page'] ) : 1;
		$offset   = ( $page - 1 ) * $per_page;

		$list_sql    = "SELECT * FROM {$table} WHERE {$where_sql} ORDER BY priority ASC, id ASC LIMIT %d OFFSET %d";
		$list_params = array_merge( $params, array( $per_page, $offset ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$items = $wpdb->get_results( $wpdb->prepare( $list_sql, $list_params ) );

		return array(
			'items' => is_array( $items ) ? $items : array(),
			'total' => $total,
		);
	}

	/**
	 * @param array<string, mixed> $data Task row.
	 * @return array{ok: bool, id?: int, error?: string}
	 */
	public static function save( array $data ) {
		global $wpdb;
		$table = Neo_Pulse_Wp_Overseer::tasks_table_name();

		$task_uid = isset( $data['task_uid'] ) ? sanitize_text_field( (string) $data['task_uid'] ) : Neo_Pulse_Wp_Overseer::new_uuid();
		if ( ! Neo_Pulse_Wp_Overseer::is_valid_uuid( $task_uid ) ) {
			$task_uid = Neo_Pulse_Wp_Overseer::new_uuid();
		}

		$title = isset( $data['title'] ) ? sanitize_text_field( substr( (string) $data['title'], 0, 512 ) ) : '';
		if ( $title === '' ) {
			return array(
				'ok'    => false,
				'error' => __( 'Task title is required.', 'neo-pulse-wp' ),
			);
		}

		$category = isset( $data['category'] ) ? sanitize_key( (string) $data['category'] ) : 'content';
		if ( ! in_array( $category, self::CATEGORIES, true ) ) {
			$category = 'content';
		}

		$status = isset( $data['status'] ) ? sanitize_key( (string) $data['status'] ) : 'pending';
		if ( ! in_array( $status, self::STATUSES, true ) ) {
			$status = 'pending';
		}

		$priority = isset( $data['priority'] ) ? max( 1, min( 5, (int) $data['priority'] ) ) : 3;
		$now      = current_time( 'mysql', true );

		$evidence = isset( $data['evidence_json'] ) ? (string) $data['evidence_json'] : '';
		if ( $evidence === '' && isset( $data['evidence'] ) ) {
			$encoded = wp_json_encode( $data['evidence'] );
			$evidence = is_string( $encoded ) ? $encoded : '{}';
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$inserted = $wpdb->insert(
			$table,
			array(
				'task_uid'           => $task_uid,
				'report_id'          => isset( $data['report_id'] ) ? (int) $data['report_id'] : 0,
				'title'              => $title,
				'description'        => isset( $data['description'] ) ? (string) $data['description'] : '',
				'category'           => $category,
				'priority'           => $priority,
				'status'             => $status,
				'evidence_json'      => $evidence !== '' ? $evidence : '{}',
				'assist_message'     => isset( $data['assist_message'] ) ? (string) $data['assist_message'] : '',
				'assist_result_json' => isset( $data['assist_result_json'] ) ? (string) $data['assist_result_json'] : '',
				'created_at'         => $now,
				'updated_at'         => $now,
			),
			array( '%s', '%d', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s' )
		);

		if ( false === $inserted ) {
			return array(
				'ok'    => false,
				'error' => __( 'Could not save task.', 'neo-pulse-wp' ),
			);
		}

		return array( 'ok' => true, 'id' => (int) $wpdb->insert_id );
	}

	/**
	 * @param int    $id     Task ID.
	 * @param string $status New status.
	 */
	public static function update_status( int $id, string $status ): bool {
		global $wpdb;
		if ( $id < 1 || ! in_array( $status, self::STATUSES, true ) ) {
			return false;
		}
		$table = Neo_Pulse_Wp_Overseer::tasks_table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (bool) $wpdb->update(
			$table,
			array(
				'status'     => $status,
				'updated_at' => current_time( 'mysql', true ),
			),
			array( 'id' => $id ),
			array( '%s', '%s' ),
			array( '%d' )
		);
	}

	public static function delete_by_report( int $report_id ): void {
		global $wpdb;
		if ( $report_id < 1 ) {
			return;
		}
		$table = Neo_Pulse_Wp_Overseer::tasks_table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE report_id = %d", $report_id ) );
	}
}
