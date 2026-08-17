<?php
/**
 * Search logs admin POST handlers.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Handlers_Search_Logs {

	const ACTION_EXPORT_SEARCH_LOGS       = 'neo_pulse_wp_export_search_logs';
	const ACTION_SAVE_SEARCH_LOG_SETTINGS = 'neo_pulse_wp_save_search_log_settings';
	const ACTION_DELETE_SEARCH_LOG        = 'neo_pulse_wp_delete_search_log';
	const ACTION_BULK_SEARCH_LOGS         = 'neo_pulse_wp_bulk_search_logs';

	public static function handle_delete_search_log(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage search logs.', 'neo-pulse-wp' ) );
		}
		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		check_admin_referer( self::ACTION_DELETE_SEARCH_LOG . '_' . $id );
		if ( $id > 0 ) {
			Neo_Pulse_Wp_Search_Logs::delete_event( $id );
		}
		self::redirect_to_search_logs( 'list', 0, self::search_logs_list_redirect_query() );
	}

	public static function handle_bulk_search_logs(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage search logs.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( 'bulk-search-logs' );

		$action = isset( $_REQUEST['action'] ) ? sanitize_key( wp_unslash( (string) $_REQUEST['action'] ) ) : '';
		if ( $action === '-1' && isset( $_REQUEST['action2'] ) ) {
			$action = sanitize_key( wp_unslash( (string) $_REQUEST['action2'] ) );
		}

		if ( $action === 'delete' ) {
			$ids = isset( $_REQUEST['search_log_ids'] ) ? (array) wp_unslash( $_REQUEST['search_log_ids'] ) : array();
			foreach ( $ids as $raw_id ) {
				$id = (int) $raw_id;
				if ( $id > 0 ) {
					Neo_Pulse_Wp_Search_Logs::delete_event( $id );
				}
			}
		}

		self::redirect_to_search_logs( 'list', 0, self::search_logs_list_redirect_query() );
	}

	/**
	 * @return array<string, mixed>
	 */
	private static function search_logs_list_redirect_query(): array {
		$query = array();
		foreach ( array( 's', 'date_from', 'date_to', 'session_id', 'orderby', 'order' ) as $key ) {
			if ( ! empty( $_REQUEST[ $key ] ) ) {
				$query[ $key ] = sanitize_text_field( wp_unslash( (string) $_REQUEST[ $key ] ) );
			}
		}
		if ( ! empty( $_REQUEST['accepted_only'] ) ) {
			$query['accepted_only'] = '1';
		}
		return $query;
	}

	public static function handle_export_search_logs(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage search logs.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_EXPORT_SEARCH_LOGS, 'neo_pulse_wp_export_search_logs_nonce' );

		$args = array();
		if ( ! empty( $_POST['accepted_only'] ) ) {
			$args['accepted_only'] = true;
		}

		$rows     = Neo_Pulse_Wp_Search_Logs::query_for_export( $args );
		$csv      = Neo_Pulse_Wp_Search_Logs_Csv::build( $rows );
		$filename = 'neo-pulse-search-logs-' . gmdate( 'Y-m-d' ) . '.csv';

		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . $filename );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $csv;
		exit;
	}

	public static function handle_save_search_log_settings(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage search logs.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_SEARCH_LOG_SETTINGS, 'neo_pulse_wp_search_log_settings_nonce' );

		Neo_Pulse_Wp_Search_Logs::save_settings(
			array(
				'logging_enabled' => ! empty( $_POST['logging_enabled'] ),
				'retention_days'  => isset( $_POST['retention_days'] ) ? (int) $_POST['retention_days'] : 90,
			)
		);

		self::redirect_to_search_logs( 'settings' );
	}
}
