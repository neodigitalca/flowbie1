<?php
/**
 * Chat logs admin POST handlers.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Handlers_Chat_Logs {

	const ACTION_IMPORT_CHAT_LOGS   = 'flowbie_wp_import_chat_logs';
	const ACTION_EXPORT_CHAT_LOGS   = 'flowbie_wp_export_chat_logs';
	const ACTION_SAVE_CHAT_LOG_SETTINGS = 'flowbie_wp_save_chat_log_settings';
	const ACTION_RUN_CHAT_LOG_ANALYSIS  = 'flowbie_wp_run_chat_log_analysis';
	const ACTION_DELETE_CHAT_LOG        = 'flowbie_wp_delete_chat_log';
	const ACTION_BULK_CHAT_LOGS         = 'flowbie_wp_bulk_chat_logs';
	const ACTION_DELETE_CHAT_LOG_REPORT = 'flowbie_wp_delete_chat_log_report';
	const ACTION_GENERATE_CHAT_LOG_POSTS_GAP_CSV = 'flowbie_wp_generate_chat_log_posts_gap_csv';
	const ACTION_GENERATE_CHAT_LOG_PAGES_GAP_CSV = 'flowbie_wp_generate_chat_log_pages_gap_csv';

	public static function handle_delete_chat_log(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage chat logs.', 'flowbie-wp' ) );
		}
		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		check_admin_referer( self::ACTION_DELETE_CHAT_LOG . '_' . $id );

		if ( $id > 0 ) {
			Flowbie_Wp_Chat_Logs::delete_message( $id );
		}

		self::set_flash(
			array(
				'kind'    => 'chat_logs',
				'success' => true,
				'message' => __( 'Message deleted.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_chat_logs( 'list', 0, self::chat_logs_list_redirect_query() );
	}

	public static function handle_bulk_chat_logs(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage chat logs.', 'flowbie-wp' ) );
		}
		check_admin_referer( 'bulk-chat-logs' );

		$action = isset( $_REQUEST['action'] ) && '-1' !== $_REQUEST['action']
			? sanitize_key( wp_unslash( (string) $_REQUEST['action'] ) )
			: '';
		if ( $action === '' && isset( $_REQUEST['action2'] ) && '-1' !== $_REQUEST['action2'] ) {
			$action = sanitize_key( wp_unslash( (string) $_REQUEST['action2'] ) );
		}

		$ids = isset( $_REQUEST['chat_log_ids'] ) ? array_map( 'intval', (array) wp_unslash( $_REQUEST['chat_log_ids'] ) ) : array();
		$deleted = 0;
		if ( $action === 'delete' ) {
			foreach ( $ids as $id ) {
				if ( $id > 0 && Flowbie_Wp_Chat_Logs::delete_message( $id ) ) {
					++$deleted;
				}
			}
		}

		self::set_flash(
			array(
				'kind'    => 'chat_logs',
				'success' => $deleted > 0,
				'message' => $deleted > 0
					? sprintf(
						/* translators: %d: number of messages deleted */
						_n( '%d message deleted.', '%d messages deleted.', $deleted, 'flowbie-wp' ),
						$deleted
					)
					: __( 'No messages were deleted.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_chat_logs( 'list', 0, self::chat_logs_list_redirect_query() );
	}

	/**
	 * @return array<string, string>
	 */
	private static function chat_logs_list_redirect_query(): array {
		$query = array();
		if ( isset( $_REQUEST['chat_log_source'] ) && (string) $_REQUEST['chat_log_source'] !== '' ) {
			$query['chat_log_source'] = sanitize_key( wp_unslash( (string) $_REQUEST['chat_log_source'] ) );
		}
		if ( isset( $_REQUEST['chat_log_role'] ) && (string) $_REQUEST['chat_log_role'] !== '' ) {
			$query['chat_log_role'] = sanitize_key( wp_unslash( (string) $_REQUEST['chat_log_role'] ) );
		}
		if ( isset( $_REQUEST['session_id'] ) && (string) $_REQUEST['session_id'] !== '' ) {
			$query['session_id'] = sanitize_text_field( wp_unslash( (string) $_REQUEST['session_id'] ) );
		}
		if ( isset( $_REQUEST['date_from'] ) && (string) $_REQUEST['date_from'] !== '' ) {
			$query['date_from'] = sanitize_text_field( wp_unslash( (string) $_REQUEST['date_from'] ) );
		}
		if ( isset( $_REQUEST['date_to'] ) && (string) $_REQUEST['date_to'] !== '' ) {
			$query['date_to'] = sanitize_text_field( wp_unslash( (string) $_REQUEST['date_to'] ) );
		}
		if ( isset( $_REQUEST['s'] ) && (string) $_REQUEST['s'] !== '' ) {
			$query['s'] = sanitize_text_field( wp_unslash( (string) $_REQUEST['s'] ) );
		}
		if ( isset( $_REQUEST['orderby'] ) && (string) $_REQUEST['orderby'] !== '' ) {
			$query['orderby'] = sanitize_key( wp_unslash( (string) $_REQUEST['orderby'] ) );
		}
		if ( isset( $_REQUEST['order'] ) && (string) $_REQUEST['order'] !== '' ) {
			$query['order'] = sanitize_key( wp_unslash( (string) $_REQUEST['order'] ) );
		}
		return $query;
	}

	public static function handle_import_chat_logs(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage chat logs.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_IMPORT_CHAT_LOGS, 'flowbie_wp_import_chat_logs_nonce' );

		if ( ! empty( $_POST['replace_all'] ) ) {
			Flowbie_Wp_Chat_Logs::delete_all_messages();
		}

		if ( empty( $_FILES['chat_log_csv']['tmp_name'] ) || ! is_uploaded_file( $_FILES['chat_log_csv']['tmp_name'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'chat_logs',
					'success' => false,
					'message' => __( 'Choose a CSV file to import.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_chat_logs( 'import-export' );
		}

		$csv_text = file_get_contents( $_FILES['chat_log_csv']['tmp_name'] );
		if ( ! is_string( $csv_text ) || $csv_text === '' ) {
			self::set_flash(
				array(
					'kind'    => 'chat_logs',
					'success' => false,
					'message' => __( 'Could not read the uploaded file.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_chat_logs( 'import-export' );
		}

		$parsed = Flowbie_Wp_Chat_Logs_Csv::parse( $csv_text );
		if ( ! empty( $parsed['error'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'chat_logs',
					'success' => false,
					'message' => (string) $parsed['error'],
				)
			);
			self::redirect_to_chat_logs( 'import-export' );
		}

		$stats = Flowbie_Wp_Chat_Logs::merge_import( $parsed['rows'] );
		self::set_flash(
			array(
				'kind'    => 'chat_logs',
				'success' => true,
				'message' => sprintf(
					/* translators: 1: inserted count, 2: skipped count */
					__( 'Import complete: %1$d rows saved, %2$d skipped.', 'flowbie-wp' ),
					(int) $stats['inserted'],
					(int) $stats['skipped']
				),
			)
		);
		self::redirect_to_chat_logs( 'import-export' );
	}

	public static function handle_export_chat_logs(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage chat logs.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_EXPORT_CHAT_LOGS, 'flowbie_wp_export_chat_logs_nonce' );

		$source = isset( $_POST['export_source'] ) ? sanitize_key( wp_unslash( (string) $_POST['export_source'] ) ) : '';
		$args   = array();
		if ( $source !== '' && Flowbie_Wp_Chat_Logs::is_valid_source( $source ) ) {
			$args['source'] = $source;
		}
		$date_from = isset( $_POST['export_date_from'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['export_date_from'] ) ) : '';
		$date_to   = isset( $_POST['export_date_to'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['export_date_to'] ) ) : '';
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) ) {
			$args['date_from'] = $date_from;
		}
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			$args['date_to'] = $date_to;
		}

		$rows = Flowbie_Wp_Chat_Logs::query_for_export( $args );
		$csv  = Flowbie_Wp_Chat_Logs_Csv::build( $rows );
		$filename = 'flowbie-chat-logs-' . gmdate( 'Y-m-d' ) . '.csv';

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . $filename );
		echo $csv;
		exit;
	}

	public static function handle_save_chat_log_settings(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage chat logs.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_CHAT_LOG_SETTINGS, 'flowbie_wp_chat_log_settings_nonce' );

		Flowbie_Wp_Chat_Logs::save_settings(
			array(
				'logging_enabled' => ! empty( $_POST['logging_enabled'] ),
				'retention_days'  => isset( $_POST['retention_days'] ) ? (int) $_POST['retention_days'] : 90,
			)
		);

		self::set_flash(
			array(
				'kind'    => 'chat_logs',
				'success' => true,
				'message' => __( 'Chat log settings saved.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_chat_logs( 'settings' );
	}

	public static function handle_run_chat_log_analysis(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage chat logs.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_RUN_CHAT_LOG_ANALYSIS, 'flowbie_wp_chat_log_analysis_nonce' );

		$date_from = isset( $_POST['analysis_date_from'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['analysis_date_from'] ) ) : '';
		$date_to   = isset( $_POST['analysis_date_to'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['analysis_date_to'] ) ) : '';
		$source    = isset( $_POST['analysis_source'] ) ? sanitize_key( wp_unslash( (string) $_POST['analysis_source'] ) ) : 'all';

		$result = Flowbie_Wp_Chat_Logs_Analysis::run(
			array(
				'date_from'      => $date_from,
				'date_to'        => $date_to,
				'source_filter'  => $source,
			)
		);

		if ( empty( $result['ok'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'chat_logs',
					'success' => false,
					'message' => isset( $result['error'] ) ? (string) $result['error'] : __( 'Analysis failed.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_chat_logs( 'list', 0, self::chat_logs_list_redirect_query() );
		}

		self::redirect_to_chat_logs( 'view-report', (int) $result['report_id'] );
	}

	public static function handle_generate_chat_log_posts_gap_csv(): void {
		self::handle_generate_chat_log_gap_csv( 'post', self::ACTION_GENERATE_CHAT_LOG_POSTS_GAP_CSV, 'flowbie_wp_chat_log_posts_gap_csv_nonce' );
	}

	public static function handle_generate_chat_log_pages_gap_csv(): void {
		self::handle_generate_chat_log_gap_csv( 'page', self::ACTION_GENERATE_CHAT_LOG_PAGES_GAP_CSV, 'flowbie_wp_chat_log_pages_gap_csv_nonce' );
	}

	private static function handle_generate_chat_log_gap_csv( string $content_type, string $action, string $nonce_field ): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage chat logs.', 'flowbie-wp' ) );
		}
		check_admin_referer( $action, $nonce_field );

		$date_from = isset( $_POST['analysis_date_from'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['analysis_date_from'] ) ) : '';
		$date_to   = isset( $_POST['analysis_date_to'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['analysis_date_to'] ) ) : '';
		$source    = isset( $_POST['analysis_source'] ) ? sanitize_key( wp_unslash( (string) $_POST['analysis_source'] ) ) : 'all';

		$result = Flowbie_Wp_Chat_Logs_Gap_Csv::run(
			array(
				'date_from'      => $date_from,
				'date_to'        => $date_to,
				'source_filter'  => $source,
				'content_type'   => $content_type,
			)
		);

		if ( empty( $result['ok'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'chat_logs',
					'success' => false,
					'message' => isset( $result['error'] ) ? (string) $result['error'] : __( 'Knowledge gap CSV generation failed.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_chat_logs( 'list', 0, self::chat_logs_list_redirect_query() );
		}

		self::stream_chat_log_gap_csv( $result );
	}

	/**
	 * @param array{ok: bool, csv?: string, filename?: string, error?: string} $result
	 */
	private static function stream_chat_log_gap_csv( array $result ): void {
		$csv      = isset( $result['csv'] ) ? (string) $result['csv'] : '';
		$filename = isset( $result['filename'] ) ? (string) $result['filename'] : 'chat-gap.csv';

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . sanitize_file_name( $filename ) );
		echo $csv;
		exit;
	}

	public static function handle_delete_chat_log_report(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage chat logs.', 'flowbie-wp' ) );
		}
		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		check_admin_referer( self::ACTION_DELETE_CHAT_LOG_REPORT . '_' . $id );

		if ( $id > 0 ) {
			Flowbie_Wp_Chat_Logs::delete_report( $id );
		}

		self::set_flash(
			array(
				'kind'    => 'chat_logs',
				'success' => true,
				'message' => __( 'Report deleted.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_chat_logs( 'reports' );
	}
}
