<?php
/**
 * Redirects admin POST handlers.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Handlers_Redirects {

	const ACTION_SAVE_REDIRECT     = 'flowbie_wp_save_redirect';
	const ACTION_DELETE_REDIRECT   = 'flowbie_wp_delete_redirect';
	const ACTION_BULK_REDIRECTS    = 'flowbie_wp_bulk_redirects';
	const ACTION_IMPORT_REDIRECTS  = 'flowbie_wp_import_redirects';
	const ACTION_IMPORT_REDIRECTS_RANK_MATH_DB = 'flowbie_wp_import_redirects_rank_math_db';
	const ACTION_EXPORT_REDIRECTS  = 'flowbie_wp_export_redirects';
	const ACTION_SAVE_REDIRECT_SETTINGS = 'flowbie_wp_save_redirect_settings';
	const ACTION_REDIRECT_ROW           = 'flowbie_wp_redirect_row';

	public static function handle_redirect_row_action(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage redirects.', 'flowbie-wp' ) );
		}

		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		$op = isset( $_GET['redirect_op'] ) ? sanitize_key( wp_unslash( (string) $_GET['redirect_op'] ) ) : '';
		if ( $id < 1 || ! in_array( $op, array( 'trash', 'restore', 'activate', 'deactivate', 'delete' ), true ) ) {
			wp_die( esc_html__( 'Invalid redirect action.', 'flowbie-wp' ) );
		}

		check_admin_referer( 'flowbie_wp_redirect_row_' . $op . '_' . $id );

		$changed = Flowbie_Wp_Redirects::bulk_action( array( $id ), $op );
		$messages = array(
			'trash'      => __( 'Redirect moved to trash.', 'flowbie-wp' ),
			'restore'    => __( 'Redirect restored.', 'flowbie-wp' ),
			'activate'   => __( 'Redirect activated.', 'flowbie-wp' ),
			'deactivate' => __( 'Redirect deactivated.', 'flowbie-wp' ),
			'delete'     => __( 'Redirect deleted permanently.', 'flowbie-wp' ),
		);

		self::set_flash(
			array(
				'kind'    => 'redirects',
				'success' => $changed > 0,
				'message' => $changed > 0
					? ( isset( $messages[ $op ] ) ? $messages[ $op ] : __( 'Redirect updated.', 'flowbie-wp' ) )
					: __( 'Redirect could not be updated.', 'flowbie-wp' ),
			)
		);

		$status = 'trash';
		if ( in_array( $op, array( 'restore', 'activate', 'deactivate' ), true ) ) {
			$status = 'activate' === $op ? 'active' : ( 'deactivate' === $op ? 'inactive' : 'active' );
		} elseif ( 'trash' === $op ) {
			$status = 'trash';
		} elseif ( 'delete' === $op ) {
			$status = 'all';
		}

		self::redirect_to_redirects( 'list', 0, array( 'redirect_status' => $status ) );
	}

	public static function handle_save_redirect(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage redirects.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_REDIRECT, 'flowbie_wp_redirect_nonce' );

		$id = isset( $_POST['redirect_id'] ) ? (int) $_POST['redirect_id'] : 0;
		$data = array(
			'id'          => $id,
			'source'      => isset( $_POST['redirect_source'] ) ? (string) wp_unslash( $_POST['redirect_source'] ) : '',
			'destination' => isset( $_POST['redirect_destination'] ) ? (string) wp_unslash( $_POST['redirect_destination'] ) : '',
			'type'        => isset( $_POST['redirect_type'] ) ? (int) $_POST['redirect_type'] : 301,
			'category'    => isset( $_POST['redirect_category'] ) ? (string) wp_unslash( $_POST['redirect_category'] ) : '',
			'status'      => isset( $_POST['redirect_status_field'] ) ? (string) wp_unslash( $_POST['redirect_status_field'] ) : 'active',
			'matching'    => 'exact',
		);

		$result = Flowbie_Wp_Redirects::save( $data );
		if ( empty( $result['ok'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'redirects',
					'success' => false,
					'message' => isset( $result['error'] ) ? (string) $result['error'] : __( 'Could not save redirect.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_redirects( $id > 0 ? 'edit' : 'new', $id > 0 ? $id : 0 );
		}

		self::set_flash(
			array(
				'kind'    => 'redirects',
				'success' => true,
				'message' => $id > 0 ? __( 'Redirect updated.', 'flowbie-wp' ) : __( 'Redirect created.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_redirects( 'list' );
	}

	public static function handle_delete_redirect(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage redirects.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_DELETE_REDIRECT, 'flowbie_wp_delete_redirect_nonce' );

		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		if ( $id > 0 ) {
			Flowbie_Wp_Redirects::delete( $id );
		}

		self::set_flash(
			array(
				'kind'    => 'redirects',
				'success' => true,
				'message' => __( 'Redirect deleted permanently.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_redirects( 'list' );
	}

	public static function handle_bulk_redirects(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage redirects.', 'flowbie-wp' ) );
		}
		check_admin_referer( 'bulk-redirects' );

		$action = isset( $_REQUEST['action'] ) && '-1' !== $_REQUEST['action']
			? sanitize_key( wp_unslash( (string) $_REQUEST['action'] ) )
			: '';
		if ( $action === '' && isset( $_REQUEST['action2'] ) && '-1' !== $_REQUEST['action2'] ) {
			$action = sanitize_key( wp_unslash( (string) $_REQUEST['action2'] ) );
		}

		$ids = isset( $_REQUEST['redirect_ids'] ) ? array_map( 'intval', (array) wp_unslash( $_REQUEST['redirect_ids'] ) ) : array();
		$changed = 0;
		if ( in_array( $action, array( 'trash', 'restore', 'activate', 'deactivate', 'delete' ), true ) ) {
			$changed = Flowbie_Wp_Redirects::bulk_action( $ids, $action );
		}

		self::set_flash(
			array(
				'kind'    => 'redirects',
				'success' => $changed > 0,
				'message' => $changed > 0
					? sprintf(
						/* translators: %d: number of redirects updated */
						_n( '%d redirect updated.', '%d redirects updated.', $changed, 'flowbie-wp' ),
						$changed
					)
					: __( 'No redirects were updated.', 'flowbie-wp' ),
			)
		);

		$status = isset( $_REQUEST['redirect_status'] ) ? sanitize_key( wp_unslash( (string) $_REQUEST['redirect_status'] ) ) : 'all';
		self::redirect_to_redirects( 'list', 0, array( 'redirect_status' => $status ) );
	}

	public static function handle_import_redirects(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage redirects.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_IMPORT_REDIRECTS, 'flowbie_wp_import_redirects_nonce' );

		if ( empty( $_FILES['redirect_csv']['tmp_name'] ) || ! is_uploaded_file( $_FILES['redirect_csv']['tmp_name'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'redirects',
					'success' => false,
					'message' => __( 'Choose a CSV file to import.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_redirects( 'import-export' );
		}

		$csv_text = file_get_contents( $_FILES['redirect_csv']['tmp_name'] );
		if ( ! is_string( $csv_text ) || $csv_text === '' ) {
			self::set_flash(
				array(
					'kind'    => 'redirects',
					'success' => false,
					'message' => __( 'Could not read the uploaded file.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_redirects( 'import-export' );
		}

		$parsed = Flowbie_Wp_Redirects_Csv::parse( $csv_text );
		if ( ! empty( $parsed['error'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'redirects',
					'success' => false,
					'message' => (string) $parsed['error'],
				)
			);
			self::redirect_to_redirects( 'import-export' );
		}

		$stats = Flowbie_Wp_Redirects::merge_import( $parsed['rows'] );
		self::set_flash(
			array(
				'kind'    => 'redirects',
				'success' => true,
				'message' => sprintf(
					/* translators: 1: added count, 2: updated count, 3: skipped count */
					__( 'Import complete: %1$d added, %2$d updated, %3$d skipped.', 'flowbie-wp' ),
					(int) $stats['added'],
					(int) $stats['updated'],
					(int) $stats['skipped']
				),
			)
		);
		self::redirect_to_redirects( 'import-export' );
	}

	public static function handle_export_redirects(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage redirects.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_EXPORT_REDIRECTS, 'flowbie_wp_export_redirects_nonce' );

		$rows = Flowbie_Wp_Redirects::export_rows();
		$export = array();
		foreach ( $rows as $row ) {
			$export[] = array(
				'source'      => (string) $row->source,
				'matching'    => (string) $row->matching,
				'destination' => (string) $row->destination,
				'type'        => (string) $row->type,
				'category'    => (string) $row->category,
				'status'      => (string) $row->status,
				'ignore'      => ! empty( $row->ignore_case ) ? 1 : 0,
			);
		}

		$csv      = Flowbie_Wp_Redirects_Csv::build( $export );
		$filename = 'flowbie-rank-math-redirects-' . gmdate( 'Y-m-d' ) . '.csv';

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . $filename );
		echo $csv;
		exit;
	}

	public static function handle_save_redirect_settings(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage redirects.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_REDIRECT_SETTINGS, 'flowbie_wp_redirect_settings_nonce' );

		$type = isset( $_POST['default_redirect_type'] ) ? (int) $_POST['default_redirect_type'] : 301;
		$fallback_type = isset( $_POST['fallback_home_type'] ) ? (int) $_POST['fallback_home_type'] : $type;
		Flowbie_Wp_Redirects::save_settings(
			array(
				'default_type'          => $type,
				'fallback_home_enabled' => ! empty( $_POST['fallback_home_enabled'] ),
				'fallback_home_type'    => $fallback_type,
			)
		);

		self::set_flash(
			array(
				'kind'    => 'redirects',
				'success' => true,
				'message' => __( 'Redirect settings saved.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_redirects( 'settings' );
	}

	public static function handle_import_redirects_rank_math_db(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage redirects.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_IMPORT_REDIRECTS_RANK_MATH_DB, 'flowbie_wp_import_redirects_rank_math_db_nonce' );

		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/interface-flowbie-wp-migrate-adapter.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-flowbie-wp-migrate-source-rank-math.php';
		$result = Flowbie_Wp_Migrate_Source_Rank_Math::import_redirects_from_database();

		if ( empty( $result['ok'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'redirects',
					'success' => false,
					'message' => isset( $result['error'] ) ? (string) $result['error'] : __( 'Rank Math redirect import failed.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_redirects( 'list' );
		}

		$stats = isset( $result['stats'] ) && is_array( $result['stats'] ) ? $result['stats'] : array();
		self::set_flash(
			array(
				'kind'    => 'redirects',
				'success' => true,
				'message' => sprintf(
					/* translators: 1: added count, 2: updated count, 3: skipped count */
					__( 'Rank Math import complete: %1$d added, %2$d updated, %3$d skipped.', 'flowbie-wp' ),
					(int) ( $stats['added'] ?? 0 ),
					(int) ( $stats['updated'] ?? 0 ),
					(int) ( $stats['skipped'] ?? 0 )
				),
			)
		);
		self::redirect_to_redirects( 'list' );
	}

	/**
	 * @return array{available: bool, count: int, plugin_active: bool, pending_count: int, imported_count: int}
	 */
	public static function rank_math_database_import_status(): array {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/interface-flowbie-wp-migrate-adapter.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-flowbie-wp-migrate-source-rank-math.php';

		$plugin_active  = Flowbie_Wp_Migrate_Source_Rank_Math::is_rank_math_plugin_active();
		$redirect_count = Flowbie_Wp_Migrate_Source_Rank_Math::rank_math_redirect_count();
		if ( null === $redirect_count && Flowbie_Wp_Migrate_Source_Rank_Math::is_rank_math_present() ) {
			$redirect_count = count( Flowbie_Wp_Migrate_Source_Rank_Math::fetch_redirect_rows() );
		}
		$source_total   = null !== $redirect_count ? (int) $redirect_count : 0;
		$rm_category    = __( 'Rank Math', 'flowbie-wp' );
		$imported_count = Flowbie_Wp_Redirects::count_by_category( $rm_category );
		$pending_count  = $source_total > 0 ? max( 0, $source_total - $imported_count ) : 0;

		$available = $pending_count > 0;
		if ( ! $available && $plugin_active && $source_total === 0 && $imported_count === 0 ) {
			$available = true;
		}

		return array(
			'available'      => $available,
			'count'          => $pending_count > 0 ? $pending_count : $source_total,
			'pending_count'  => $pending_count,
			'imported_count' => $imported_count,
			'plugin_active'  => $plugin_active,
		);
	}
}
