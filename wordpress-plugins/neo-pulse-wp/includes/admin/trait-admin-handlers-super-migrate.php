<?php
/**
 * Super Migrate admin handlers.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Handlers_Super_Migrate {

	const ACTION_EXPORT_NEO_PULSE_SHEET = 'neo_pulse_wp_export_neo_pulse_sheet';
	const ACTION_IMPORT_NEO_PULSE_SHEET = 'neo_pulse_wp_import_neo_pulse_sheet';

	public static function enqueue_super_migrate_assets( string $hook ): void {
		if ( strpos( $hook, 'neo-pulse-wp-super-migrate' ) === false ) {
			return;
		}

		$base = NEO_PULSE_WP_PLUGIN_DIR . 'assets/admin/';
		$url  = plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/admin/';
		$ver  = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '0.9.22';

		$css = $base . 'admin-super-migrate.css';
		if ( is_readable( $css ) ) {
			wp_enqueue_style(
				'neo-pulse-wp-super-migrate',
				$url . 'admin-super-migrate.css',
				array( 'neo-pulse-wp-admin-contrast' ),
				$ver . '.' . (string) filemtime( $css )
			);
		}

		$js = $base . 'admin-super-migrate.js';
		if ( is_readable( $js ) ) {
			wp_enqueue_script(
				'neo-pulse-wp-super-migrate',
				$url . 'admin-super-migrate.js',
				array(),
				$ver . '.' . (string) filemtime( $js ),
				true
			);
			wp_localize_script(
				'neo-pulse-wp-super-migrate',
				'neo-pulseSuperMigrate',
				array(
					'restBase'    => esc_url_raw( rest_url( 'neo-pulse/v1/super-migrate' ) ),
					'nonce'       => wp_create_nonce( 'wp_rest' ),
					'resumeJobId' => sanitize_key( (string) get_transient( 'neo_pulse_wp_sm_resume_job' ) ),
					'pluginsUrl'  => esc_url_raw( admin_url( 'plugins.php' ) ),
					'deactivatedPlugins' => Neo_Pulse_Wp_Super_Import_Plugins::get_restorable_plugins(),
					'strings'     => array(
						'running'              => __( 'Spooling parallel import threads…', 'neo-pulse-wp' ),
						'done'                   => __( 'All data streams merged. Import complete.', 'neo-pulse-wp' ),
						'error'                  => __( 'Import failed.', 'neo-pulse-wp' ),
						'deactivating'           => __( 'Deactivating plugins…', 'neo-pulse-wp' ),
						'deactivated'            => __( 'Selected plugins were deactivated.', 'neo-pulse-wp' ),
						'deactivateFailed'       => __( 'Could not deactivate the selected plugins.', 'neo-pulse-wp' ),
						'selectPluginsToDisable' => __( 'Select at least one plugin to deactivate.', 'neo-pulse-wp' ),
						'refreshing'             => __( 'Refreshing page…', 'neo-pulse-wp' ),
						'refreshDelayMs'         => 1200,
						'restoring'              => __( 'Restoring plugins…', 'neo-pulse-wp' ),
						'restored'               => __( 'Plugins restored. NEO Pulse WP deactivated. Refreshing…', 'neo-pulse-wp' ),
						'restoreFailed'          => __( 'Could not restore plugins.', 'neo-pulse-wp' ),
						'headlineIdle'           => __( 'NEURAL SYNC STANDBY', 'neo-pulse-wp' ),
						'headlineRunning'        => __( '// PARALLEL UPLINK ACTIVE', 'neo-pulse-wp' ),
						'headlineDone'           => __( '// ALL CHANNELS MERGED', 'neo-pulse-wp' ),
						'headlineError'          => __( '// SYNC ABORT — SIGNAL LOST', 'neo-pulse-wp' ),
						'badgeQueued'            => '·',
						'badgeRunning'           => '▶',
						'badgeDone'              => '✓',
						'badgeError'             => '✕',
						'parallelActive'         => __( '%d lanes live · %d/%d ops merged', 'neo-pulse-wp' ),
						'opsQueued'              => __( '%d/%d ops armed', 'neo-pulse-wp' ),
					),
				)
			);
		}
	}

	public static function handle_export_neo_pulse_sheet(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_EXPORT_NEO_PULSE_SHEET );

		$json = Neo_Pulse_Wp_Neo_Pulse_Sheet::to_json(
			apply_filters( 'neo_pulse_wp_flo_sheet_export', Neo_Pulse_Wp_Neo_Pulse_Sheet::get() )
		);
		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . Neo_Pulse_Wp_Neo_Pulse_Sheet::download_filename() . '"' );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $json;
		exit;
	}

	public static function handle_import_neo_pulse_sheet(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_IMPORT_NEO_PULSE_SHEET, 'neo_pulse_wp_import_neo_pulse_sheet_nonce' );

		if ( empty( $_FILES['flo_sheet_file']['tmp_name'] ) || ! is_uploaded_file( $_FILES['flo_sheet_file']['tmp_name'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'super_migrate',
					'success' => false,
					'message' => __( 'Choose a Flo Sheet JSON file.', 'neo-pulse-wp' ),
				)
			);
			wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-super-migrate' ) );
			exit;
		}

		$file_text = file_get_contents( $_FILES['flo_sheet_file']['tmp_name'] );
		if ( ! is_string( $file_text ) || $file_text === '' ) {
			self::set_flash(
				array(
					'kind'    => 'super_migrate',
					'success' => false,
					'message' => __( 'Could not read the uploaded file.', 'neo-pulse-wp' ),
				)
			);
			wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-super-migrate' ) );
			exit;
		}

		$parsed = Neo_Pulse_Wp_Neo_Pulse_Sheet::from_json( $file_text );
		if ( empty( $parsed['ok'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'super_migrate',
					'success' => false,
					'message' => $parsed['error'] ?? __( 'Invalid Flo Sheet.', 'neo-pulse-wp' ),
				)
			);
			wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-super-migrate' ) );
			exit;
		}

		Neo_Pulse_Wp_Neo_Pulse_Sheet::save( $parsed['sheet'] );
		$result = Neo_Pulse_Wp_Super_Migrate::start_job( array( 'phases' => array( 'apply' ) ) );

		if ( empty( $result['ok'] ) || empty( $result['job_id'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'super_migrate',
					'success' => false,
					'message' => $result['error'] ?? __( 'Could not start apply job.', 'neo-pulse-wp' ),
				)
			);
		} else {
			set_transient( 'neo_pulse_wp_sm_resume_job', (string) $result['job_id'], 300 );
			self::set_flash(
				array(
					'kind'    => 'super_migrate',
					'success' => true,
					'message' => __( 'Flo Sheet imported. Apply job started — progress will continue on this page.', 'neo-pulse-wp' ),
				)
			);
		}

		wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-super-migrate' ) );
		exit;
	}
}
