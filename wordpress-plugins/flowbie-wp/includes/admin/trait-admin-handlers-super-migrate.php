<?php
/**
 * Super Migrate admin handlers.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Handlers_Super_Migrate {

	const ACTION_EXPORT_FLO_SHEET = 'flowbie_wp_export_flo_sheet';
	const ACTION_IMPORT_FLO_SHEET = 'flowbie_wp_import_flo_sheet';

	public static function enqueue_super_migrate_assets( string $hook ): void {
		if ( strpos( $hook, 'flowbie-wp-super-migrate' ) === false ) {
			return;
		}

		$base = FLOWBIE_WP_PLUGIN_DIR . 'assets/admin/';
		$url  = plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/admin/';
		$ver  = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '0.9.22';

		$css = $base . 'admin-super-migrate.css';
		if ( is_readable( $css ) ) {
			wp_enqueue_style(
				'flowbie-wp-super-migrate',
				$url . 'admin-super-migrate.css',
				array( 'flowbie-wp-admin-contrast' ),
				$ver . '.' . (string) filemtime( $css )
			);
		}

		$js = $base . 'admin-super-migrate.js';
		if ( is_readable( $js ) ) {
			wp_enqueue_script(
				'flowbie-wp-super-migrate',
				$url . 'admin-super-migrate.js',
				array(),
				$ver . '.' . (string) filemtime( $js ),
				true
			);
			wp_localize_script(
				'flowbie-wp-super-migrate',
				'flowbieSuperMigrate',
				array(
					'restBase'    => esc_url_raw( rest_url( 'flowbie/v1/super-migrate' ) ),
					'nonce'       => wp_create_nonce( 'wp_rest' ),
					'resumeJobId' => sanitize_key( (string) get_transient( 'flowbie_wp_sm_resume_job' ) ),
					'pluginsUrl'  => esc_url_raw( admin_url( 'plugins.php' ) ),
					'deactivatedPlugins' => Flowbie_Wp_Super_Import_Plugins::get_restorable_plugins(),
					'strings'     => array(
						'running'              => __( 'Spooling parallel import threads…', 'flowbie-wp' ),
						'done'                   => __( 'All data streams merged. Import complete.', 'flowbie-wp' ),
						'error'                  => __( 'Import failed.', 'flowbie-wp' ),
						'deactivating'           => __( 'Deactivating plugins…', 'flowbie-wp' ),
						'deactivated'            => __( 'Selected plugins were deactivated.', 'flowbie-wp' ),
						'deactivateFailed'       => __( 'Could not deactivate the selected plugins.', 'flowbie-wp' ),
						'selectPluginsToDisable' => __( 'Select at least one plugin to deactivate.', 'flowbie-wp' ),
						'refreshing'             => __( 'Refreshing page…', 'flowbie-wp' ),
						'refreshDelayMs'         => 1200,
						'restoring'              => __( 'Restoring plugins…', 'flowbie-wp' ),
						'restored'               => __( 'Plugins restored. Flowbie WP deactivated. Refreshing…', 'flowbie-wp' ),
						'restoreFailed'          => __( 'Could not restore plugins.', 'flowbie-wp' ),
						'headlineIdle'           => __( 'NEURAL SYNC STANDBY', 'flowbie-wp' ),
						'headlineRunning'        => __( '// PARALLEL UPLINK ACTIVE', 'flowbie-wp' ),
						'headlineDone'           => __( '// ALL CHANNELS MERGED', 'flowbie-wp' ),
						'headlineError'          => __( '// SYNC ABORT — SIGNAL LOST', 'flowbie-wp' ),
						'badgeQueued'            => '·',
						'badgeRunning'           => '▶',
						'badgeDone'              => '✓',
						'badgeError'             => '✕',
						'parallelActive'         => __( '%d lanes live · %d/%d ops merged', 'flowbie-wp' ),
						'opsQueued'              => __( '%d/%d ops armed', 'flowbie-wp' ),
					),
				)
			);
		}
	}

	public static function handle_export_flo_sheet(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_EXPORT_FLO_SHEET );

		$json = Flowbie_Wp_Flo_Sheet::to_json(
			apply_filters( 'flowbie_wp_flo_sheet_export', Flowbie_Wp_Flo_Sheet::get() )
		);
		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . Flowbie_Wp_Flo_Sheet::download_filename() . '"' );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $json;
		exit;
	}

	public static function handle_import_flo_sheet(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_IMPORT_FLO_SHEET, 'flowbie_wp_import_flo_sheet_nonce' );

		if ( empty( $_FILES['flo_sheet_file']['tmp_name'] ) || ! is_uploaded_file( $_FILES['flo_sheet_file']['tmp_name'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'super_migrate',
					'success' => false,
					'message' => __( 'Choose a Flo Sheet JSON file.', 'flowbie-wp' ),
				)
			);
			wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-super-migrate' ) );
			exit;
		}

		$file_text = file_get_contents( $_FILES['flo_sheet_file']['tmp_name'] );
		if ( ! is_string( $file_text ) || $file_text === '' ) {
			self::set_flash(
				array(
					'kind'    => 'super_migrate',
					'success' => false,
					'message' => __( 'Could not read the uploaded file.', 'flowbie-wp' ),
				)
			);
			wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-super-migrate' ) );
			exit;
		}

		$parsed = Flowbie_Wp_Flo_Sheet::from_json( $file_text );
		if ( empty( $parsed['ok'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'super_migrate',
					'success' => false,
					'message' => $parsed['error'] ?? __( 'Invalid Flo Sheet.', 'flowbie-wp' ),
				)
			);
			wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-super-migrate' ) );
			exit;
		}

		Flowbie_Wp_Flo_Sheet::save( $parsed['sheet'] );
		$result = Flowbie_Wp_Super_Migrate::start_job( array( 'phases' => array( 'apply' ) ) );

		if ( empty( $result['ok'] ) || empty( $result['job_id'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'super_migrate',
					'success' => false,
					'message' => $result['error'] ?? __( 'Could not start apply job.', 'flowbie-wp' ),
				)
			);
		} else {
			set_transient( 'flowbie_wp_sm_resume_job', (string) $result['job_id'], 300 );
			self::set_flash(
				array(
					'kind'    => 'super_migrate',
					'success' => true,
					'message' => __( 'Flo Sheet imported. Apply job started — progress will continue on this page.', 'flowbie-wp' ),
				)
			);
		}

		wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-super-migrate' ) );
		exit;
	}
}
