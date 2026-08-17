<?php
/**
 * Speed module admin_post handlers.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Handlers_Speed {

	const ACTION_SAVE_SPEED = 'neo_pulse_wp_save_speed';

	const ACTION_FLUSH_SPEED = 'neo_pulse_wp_flush_speed';

	const ACTION_FLUSH_ALL_WORDPRESS = 'neo_pulse_wp_flush_all_wordpress';

	const ACTION_EXPORT_SPEED_SETTINGS = 'neo_pulse_wp_export_speed_settings';

	const ACTION_IMPORT_SPEED_SETTINGS = 'neo_pulse_wp_import_speed_settings';

	const ACTION_APPLY_SPEED_PRESET = 'neo_pulse_wp_apply_speed_preset';

	const ACTION_DOWNLOAD_SPEED_PRESET = 'neo_pulse_wp_download_speed_preset';

	const ACTION_RECOVER_ELEMENTOR_SITE = 'neo_pulse_wp_recover_elementor_site';

	const ACTION_RUN_ELEMENTOR_MIGRATION = 'neo_pulse_wp_run_elementor_migration';

	public static function handle_save_speed(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_SPEED, 'neo_pulse_wp_speed_nonce' );

		$tab      = isset( $_POST['neo-pulse_speed_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['neo-pulse_speed_tab'] ) ) : 'general';
		$previous = Neo_Pulse_Wp_Speed_Settings::get_config();
		$config   = self::speed_config_from_post( $tab, $previous );

		$settings_changed = wp_json_encode( $previous ) !== wp_json_encode( $config );
		Neo_Pulse_Wp_Speed_Settings::save_config( $config );

		if ( ! empty( $config['enabled'] ) && empty( $previous['enabled'] ) ) {
			Neo_Pulse_Wp_Speed_Settings::maybe_import_autoptimize();
			$config = Neo_Pulse_Wp_Speed_Settings::get_config();
			if ( 'general' === $tab ) {
				$config['skip_logged_in'] = ! empty( $_POST['neo-pulse_speed_skip_logged_in'] );
				$config                   = Neo_Pulse_Wp_Speed_Settings::apply_simple_enabled_config( $config );
				Neo_Pulse_Wp_Speed_Settings::save_config( $config );
			}
		}

		$did_flush = self::speed_config_cache_fingerprint( $previous ) !== self::speed_config_cache_fingerprint( $config );
		if ( $did_flush ) {
			Neo_Pulse_Wp_Speed::flush_all_wordpress();
		}

		Neo_Pulse_Wp_Speed_Cache::ensure_dirs();

		$message = __( 'Speed settings saved.', 'neo-pulse-wp' );
		if ( ! empty( $config['enabled'] ) && class_exists( 'Neo_Pulse_Wp_Speed_Warm', false ) ) {
			$stats = Neo_Pulse_Wp_Speed_Warm::warm_disk_cache();
			if ( (int) $stats['file_count'] > 0 ) {
				$message = sprintf(
					/* translators: 1: file count, 2: size */
					__( 'Speed settings saved. Built %1$d cached files (%2$s) on disk.', 'neo-pulse-wp' ),
					(int) $stats['file_count'],
					size_format( (int) $stats['bytes'] )
				);
			}
		}

		self::set_flash(
			array(
				'kind'    => 'speed',
				'success' => true,
				'message' => $message,
			)
		);
		self::redirect_to_speed( $tab );
	}

	public static function handle_flush_speed(): void {
		self::handle_flush_all_wordpress();
	}

	public static function handle_flush_all_wordpress(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_FLUSH_ALL_WORDPRESS, 'neo_pulse_wp_flush_all_wordpress_nonce' );

		$tab     = isset( $_POST['neo-pulse_speed_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['neo-pulse_speed_tab'] ) ) : 'general';
		$summary = Neo_Pulse_Wp_Speed::flush_all_wordpress();

		self::set_flash(
			array(
				'kind'    => 'speed',
				'success' => true,
				'message' => sprintf(
					/* translators: 1: speed file count, 2: transient count, 3: nocache seconds */
					__( 'WordPress + NEO Pulse flush complete: %1$d speed files removed, %2$d cache rows cleared, browsers asked to refetch for %3$d minutes. Test in incognito.', 'neo-pulse-wp' ),
					(int) ( $summary['speed_files'] ?? 0 ),
					(int) ( $summary['transients'] ?? 0 ),
					(int) ( $summary['nocache_seconds'] ?? 600 )
				),
			)
		);
		self::redirect_to_speed( $tab );
	}

	public static function handle_import_speed_settings(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_IMPORT_SPEED_SETTINGS, 'neo_pulse_wp_import_speed_settings_nonce' );

		$tab = isset( $_POST['neo-pulse_speed_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['neo-pulse_speed_tab'] ) ) : 'cache';

		if ( empty( $_FILES['neo-pulse_speed_settings_json']['tmp_name'] ) || ! is_uploaded_file( $_FILES['neo-pulse_speed_settings_json']['tmp_name'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'speed',
					'success' => false,
					'message' => __( 'Choose a JSON file to import.', 'neo-pulse-wp' ),
				)
			);
			self::redirect_to_speed( $tab );
		}

		$raw = file_get_contents( $_FILES['neo-pulse_speed_settings_json']['tmp_name'] );
		if ( ! is_string( $raw ) || trim( $raw ) === '' ) {
			self::set_flash(
				array(
					'kind'    => 'speed',
					'success' => false,
					'message' => __( 'Could not read the uploaded file.', 'neo-pulse-wp' ),
				)
			);
			self::redirect_to_speed( $tab );
		}

		$payload = Neo_Pulse_Wp_Speed_Import::parse_json( $raw );
		if ( is_wp_error( $payload ) ) {
			self::set_flash(
				array(
					'kind'    => 'speed',
					'success' => false,
					'message' => $payload->get_error_message(),
				)
			);
			self::redirect_to_speed( $tab );
		}

		$result = Neo_Pulse_Wp_Speed_Import::apply(
			$payload,
			array(
				'import_speed'        => ! empty( $_POST['neo-pulse_speed_import_speed'] ),
				'import_speed_images' => ! empty( $_POST['neo-pulse_speed_import_images'] ),
			)
		);

		if ( is_wp_error( $result ) ) {
			self::set_flash(
				array(
					'kind'    => 'speed',
					'success' => false,
					'message' => $result->get_error_message(),
				)
			);
			self::redirect_to_speed( $tab );
		}

		self::set_flash(
			array(
				'kind'    => 'speed',
				'success' => true,
				'message' => (string) $result['message'],
			)
		);
		self::redirect_to_speed( $tab );
	}

	public static function handle_apply_speed_preset(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_APPLY_SPEED_PRESET, 'neo_pulse_wp_apply_speed_preset_nonce' );

		$tab       = isset( $_POST['neo-pulse_speed_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['neo-pulse_speed_tab'] ) ) : 'cache';
		$preset_id = isset( $_POST['neo-pulse_speed_preset'] ) ? sanitize_key( wp_unslash( (string) $_POST['neo-pulse_speed_preset'] ) ) : '';

		$result = Neo_Pulse_Wp_Speed_Import::apply_preset( $preset_id );
		if ( is_wp_error( $result ) ) {
			self::set_flash(
				array(
					'kind'    => 'speed',
					'success' => false,
					'message' => $result->get_error_message(),
				)
			);
			self::redirect_to_speed( $tab );
		}

		self::set_flash(
			array(
				'kind'    => 'speed',
				'success' => true,
				'message' => (string) $result['message'],
			)
		);
		self::redirect_to_speed( $tab );
	}

	public static function handle_download_speed_preset(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_DOWNLOAD_SPEED_PRESET, 'neo_pulse_wp_download_speed_preset_nonce' );

		$preset_id = isset( $_GET['neo-pulse_speed_preset'] ) ? sanitize_key( wp_unslash( (string) $_GET['neo-pulse_speed_preset'] ) ) : Neo_Pulse_Wp_Speed_Import::PRESET_ELEMENTOR_SAFE;

		$path = Neo_Pulse_Wp_Speed_Import::preset_file_path( $preset_id );
		if ( ! is_readable( $path ) ) {
			wp_die( esc_html__( 'Preset file not found.', 'neo-pulse-wp' ) );
		}

		$json = file_get_contents( $path );
		if ( ! is_string( $json ) ) {
			wp_die( esc_html__( 'Could not read preset file.', 'neo-pulse-wp' ) );
		}

		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=neo-pulse-speed-preset-' . $preset_id . '.json' );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- JSON download body.
		echo $json;
		exit;
	}

	public static function handle_export_speed_settings(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_EXPORT_SPEED_SETTINGS, 'neo_pulse_wp_export_speed_settings_nonce' );

		$json     = Neo_Pulse_Wp_Speed_Export::build_json();
		$filename = Neo_Pulse_Wp_Speed_Export::download_filename();

		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . $filename );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- JSON download body.
		echo $json;
		exit;
	}

	/**
	 * @param string $tab Active tab key.
	 */
	private static function redirect_to_speed( string $tab = 'general' ): void {
		$url = admin_url( 'admin.php?page=neo-pulse-wp-speed' );
		if ( $tab !== '' && 'general' !== $tab ) {
			$url = add_query_arg( 'tab', $tab, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}

	/**
	 * Merge POST fields for the active tab into existing config.
	 *
	 * @param string               $tab      Active tab.
	 * @param array<string, mixed> $existing Existing config.
	 * @return array<string, mixed>
	 */
	private static function speed_config_from_post( string $tab, array $existing ): array {
		$config = $existing;

		switch ( $tab ) {
			case 'general':
				$was_enabled              = ! empty( $existing['enabled'] );
				$config['enabled']        = ! empty( $_POST['neo-pulse_speed_enabled'] );
				$config['skip_logged_in'] = ! empty( $_POST['neo-pulse_speed_skip_logged_in'] );
				if ( ! empty( $config['enabled'] ) ) {
					if ( ! $was_enabled ) {
						$config = Neo_Pulse_Wp_Speed_Settings::apply_simple_enabled_config( $config );
					} else {
						$config['bypass_elementor'] = false;
					}
				} else {
					$config['enabled'] = false;
				}
				break;

			case 'css':
				$config['optimize_css']  = ! empty( $_POST['neo-pulse_speed_optimize_css'] );
				$config['aggregate_css'] = ! empty( $_POST['neo-pulse_speed_aggregate_css'] );
				break;

			case 'javascript':
				$config['optimize_js']  = ! empty( $_POST['neo-pulse_speed_optimize_js'] );
				$config['aggregate_js'] = ! empty( $_POST['neo-pulse_speed_aggregate_js'] );
				$config['defer_js']     = ! empty( $_POST['neo-pulse_speed_defer_js'] );
				break;

			case 'html':
				$config['minify_html']          = ! empty( $_POST['neo-pulse_speed_minify_html'] );
				$config['remove_query_strings'] = ! empty( $_POST['neo-pulse_speed_remove_query_strings'] );
				break;

			case 'excludes':
				$config['js_exclude']  = isset( $_POST['neo-pulse_speed_js_exclude'] ) ? wp_unslash( (string) $_POST['neo-pulse_speed_js_exclude'] ) : (string) ( $existing['js_exclude'] ?? '' );
				$config['css_exclude'] = isset( $_POST['neo-pulse_speed_css_exclude'] ) ? wp_unslash( (string) $_POST['neo-pulse_speed_css_exclude'] ) : (string) ( $existing['css_exclude'] ?? '' );
				break;

			default:
				break;
		}

		if ( ! empty( $existing['imported_autoptimize'] ) ) {
			$config['imported_autoptimize'] = true;
		}

		return Neo_Pulse_Wp_Speed_Settings::sanitize_config( $config );
	}

	/**
	 * @return array<int, string>
	 */
	private static function speed_cache_affecting_keys(): array {
		return array(
			'enabled',
			'optimize_css',
			'optimize_js',
			'minify_html',
			'aggregate_css',
			'aggregate_js',
			'defer_js',
			'remove_query_strings',
			'js_exclude',
			'css_exclude',
			'bypass_elementor',
		);
	}

	/**
	 * @param array<string, mixed> $config Speed config.
	 */
	private static function speed_config_cache_fingerprint( array $config ): string {
		$slice = array();
		foreach ( self::speed_cache_affecting_keys() as $key ) {
			$slice[ $key ] = $config[ $key ] ?? '';
		}
		$json = wp_json_encode( $slice );
		return is_string( $json ) ? $json : '';
	}

	public static function handle_recover_elementor_site(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to recover Elementor content.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_RECOVER_ELEMENTOR_SITE, 'neo_pulse_wp_recover_elementor_nonce' );

		$tab    = isset( $_POST['neo-pulse_speed_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['neo-pulse_speed_tab'] ) ) : 'general';
		$result = Neo_Pulse_Wp_Elementor_Site_Recovery::recover();

		self::set_flash(
			array(
				'kind'    => 'speed',
				'success' => true,
				'message' => sprintf(
					/* translators: 1: documents patched, 2: tag replacements */
					__( 'Elementor recovery complete. Speed disabled. Reverted tags in %1$d documents (%2$d replacements). Purge your host cache and test in a private window.', 'neo-pulse-wp' ),
					(int) ( $result['documents_patched'] ?? 0 ),
					(int) ( $result['tag_replacements'] ?? 0 )
				),
			)
		);
		self::redirect_to_speed( $tab );
	}

	public static function handle_run_elementor_migration(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to migrate Elementor tags.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_RUN_ELEMENTOR_MIGRATION, 'neo_pulse_wp_run_elementor_migration_nonce' );

		$tab    = isset( $_POST['neo-pulse_speed_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['neo-pulse_speed_tab'] ) ) : 'general';
		$result = Neo_Pulse_Wp_Elementor_Site_Recovery::run_elementor_migration();

		$message = ! empty( $result['migration_skipped'] )
			? __( 'Elementor cache flags patched. Tag migration skipped until NEO Pulse Fields or ACF field groups exist on this site.', 'neo-pulse-wp' )
			: sprintf(
				/* translators: 1: documents patched */
				__( 'Elementor tag migration complete. Patched %1$d documents.', 'neo-pulse-wp' ),
				(int) ( $result['documents_patched'] ?? 0 )
			);

		self::set_flash(
			array(
				'kind'    => 'speed',
				'success' => true,
				'message' => $message,
			)
		);
		self::redirect_to_speed( $tab );
	}
}
