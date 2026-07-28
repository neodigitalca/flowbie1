<?php
/**
 * Overseer AI analysis reports storage.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Overseer_Reports {

	/**
	 * @return object|null
	 */
	public static function get( int $id ) {
		global $wpdb;
		if ( $id < 1 ) {
			return null;
		}
		$table = Flowbie_Wp_Overseer::reports_table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ) );
		return $row ? $row : null;
	}

	/**
	 * @return array{items: array<int, object>, total: int}
	 */
	public static function query( int $per_page = 20, int $page = 1 ): array {
		global $wpdb;
		$table    = Flowbie_Wp_Overseer::reports_table_name();
		$per_page = max( 1, min( 100, $per_page ) );
		$page     = max( 1, $page );
		$offset   = ( $page - 1 ) * $per_page;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$items = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} ORDER BY created_at DESC LIMIT %d OFFSET %d",
				$per_page,
				$offset
			)
		);

		return array(
			'items' => is_array( $items ) ? $items : array(),
			'total' => $total,
		);
	}

	/**
	 * @param array<string, mixed> $data Report row.
	 * @return array{ok: bool, id?: int, error?: string}
	 */
	public static function save( array $data ) {
		global $wpdb;
		$table = Flowbie_Wp_Overseer::reports_table_name();

		$report_uid = isset( $data['report_uid'] ) ? sanitize_text_field( (string) $data['report_uid'] ) : Flowbie_Wp_Overseer::new_uuid();
		if ( ! Flowbie_Wp_Overseer::is_valid_uuid( $report_uid ) ) {
			$report_uid = Flowbie_Wp_Overseer::new_uuid();
		}

		$date_from = isset( $data['date_from'] ) ? sanitize_text_field( (string) $data['date_from'] ) : '';
		$date_to   = isset( $data['date_to'] ) ? sanitize_text_field( (string) $data['date_to'] ) : '';
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'Invalid date range.', 'flowbie-wp' ),
			);
		}

		$body = isset( $data['body'] ) ? (string) $data['body'] : '';
		if ( trim( $body ) === '' ) {
			return array(
				'ok'    => false,
				'error' => __( 'Report body is empty.', 'flowbie-wp' ),
			);
		}

		$now = current_time( 'mysql', true );

		$gsc_included = ! empty( $data['gsc_included'] ) ? 1 : 0;
		$gsc_from     = null;
		$gsc_to       = null;
		if ( isset( $data['gsc_date_from'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $data['gsc_date_from'] ) ) {
			$gsc_from = sanitize_text_field( (string) $data['gsc_date_from'] );
		}
		if ( isset( $data['gsc_date_to'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $data['gsc_date_to'] ) ) {
			$gsc_to = sanitize_text_field( (string) $data['gsc_date_to'] );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$inserted = $wpdb->insert(
			$table,
			array(
				'report_uid'    => $report_uid,
				'date_from'     => $date_from,
				'date_to'       => $date_to,
				'session_count' => isset( $data['session_count'] ) ? (int) $data['session_count'] : 0,
				'event_count'   => isset( $data['event_count'] ) ? (int) $data['event_count'] : 0,
				'model'         => isset( $data['model'] ) ? sanitize_text_field( (string) $data['model'] ) : '',
				'body'          => $body,
				'gsc_included'  => $gsc_included,
				'gsc_date_from' => $gsc_from,
				'gsc_date_to'   => $gsc_to,
				'created_at'    => $now,
			),
			array( '%s', '%s', '%s', '%d', '%d', '%s', '%s', '%d', '%s', '%s', '%s' )
		);

		if ( false === $inserted ) {
			return array(
				'ok'    => false,
				'error' => __( 'Could not save report.', 'flowbie-wp' ),
			);
		}

		return array( 'ok' => true, 'id' => (int) $wpdb->insert_id );
	}

	public static function delete( int $id ): bool {
		global $wpdb;
		if ( $id < 1 ) {
			return false;
		}
		Flowbie_Wp_Overseer_Tasks::delete_by_report( $id );
		$table = Flowbie_Wp_Overseer::reports_table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (bool) $wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );
	}
}
