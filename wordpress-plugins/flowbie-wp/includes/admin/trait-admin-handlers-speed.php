<?php
/**
 * Speed module admin_post handlers.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Handlers_Speed {

	const ACTION_SAVE_SPEED = 'flowbie_wp_save_speed';

	const ACTION_FLUSH_SPEED = 'flowbie_wp_flush_speed';

	const ACTION_FLUSH_ALL_WORDPRESS = 'flowbie_wp_flush_all_wordpress';

	const ACTION_EXPORT_SPEED_SETTINGS = 'flowbie_wp_export_speed_settings';

	const ACTION_IMPORT_SPEED_SETTINGS = 'flowbie_wp_import_speed_settings';

	const ACTION_APPLY_SPEED_PRESET = 'flowbie_wp_apply_speed_preset';

	const ACTION_DOWNLOAD_SPEED_PRESET = 'flowbie_wp_download_speed_preset';

	public static function handle_save_speed(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_SPEED, 'flowbie_wp_speed_nonce' );

		$tab      = isset( $_POST['flowbie_speed_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_speed_tab'] ) ) : 'general';
		$previous = Flowbie_Wp_Speed_Settings::get_config();
		$config   = self::speed_config_from_post( $tab, $previous );

		$settings_changed = wp_json_encode( $previous ) !== wp_json_encode( $config );
		Flowbie_Wp_Speed_Settings::save_config( $config );

		if ( ! empty( $config['enabled'] ) && empty( $previous['enabled'] ) ) {
			Flowbie_Wp_Speed_Settings::maybe_import_autoptimize();
			$config = Flowbie_Wp_Speed_Settings::get_config();
			if ( 'general' === $tab ) {
				$config['skip_logged_in'] = ! empty( $_POST['flowbie_speed_skip_logged_in'] );
				$config                   = Flowbie_Wp_Speed_Settings::apply_simple_enabled_config( $config );
				Flowbie_Wp_Speed_Settings::save_config( $config );
			}
		}

		$did_flush = self::speed_config_cache_fingerprint( $previous ) !== self::speed_config_cache_fingerprint( $config );
		if ( $did_flush ) {
			Flowbie_Wp_Speed::flush_all_wordpress();
		}

		Flowbie_Wp_Speed_Cache::ensure_dirs();

		$message = __( 'Speed settings saved.', 'flowbie-wp' );
		if ( ! empty( $config['enabled'] ) && class_exists( 'Flowbie_Wp_Speed_Warm', false ) ) {
			$stats = Flowbie_Wp_Speed_Warm::warm_disk_cache();
			if ( (int) $stats['file_count'] > 0 ) {
				$message = sprintf(
					/* translators: 1: file count, 2: size */
					__( 'Speed settings saved. Built %1$d cached files (%2$s) on disk.', 'flowbie-wp' ),
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
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_FLUSH_ALL_WORDPRESS, 'flowbie_wp_flush_all_wordpress_nonce' );

		$tab     = isset( $_POST['flowbie_speed_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_speed_tab'] ) ) : 'general';
		$summary = Flowbie_Wp_Speed::flush_all_wordpress();

		self::set_flash(
			array(
				'kind'    => 'speed',
				'success' => true,
				'message' => sprintf(
					/* translators: 1: speed file count, 2: transient count, 3: nocache seconds */
					__( 'WordPress + Flowbie flush complete: %1$d speed files removed, %2$d cache rows cleared, browsers asked to refetch for %3$d minutes. Test in incognito.', 'flowbie-wp' ),
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
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_IMPORT_SPEED_SETTINGS, 'flowbie_wp_import_speed_settings_nonce' );

		$tab = isset( $_POST['flowbie_speed_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_speed_tab'] ) ) : 'cache';

		if ( empty( $_FILES['flowbie_speed_settings_json']['tmp_name'] ) || ! is_uploaded_file( $_FILES['flowbie_speed_settings_json']['tmp_name'] ) ) {
			self::set_flash(
				array(
					'kind'    => 'speed',
					'success' => false,
					'message' => __( 'Choose a JSON file to import.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_speed( $tab );
		}

		$raw = file_get_contents( $_FILES['flowbie_speed_settings_json']['tmp_name'] );
		if ( ! is_string( $raw ) || trim( $raw ) === '' ) {
			self::set_flash(
				array(
					'kind'    => 'speed',
					'success' => false,
					'message' => __( 'Could not read the uploaded file.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_speed( $tab );
		}

		$payload = Flowbie_Wp_Speed_Import::parse_json( $raw );
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

		$result = Flowbie_Wp_Speed_Import::apply(
			$payload,
			array(
				'import_speed'        => ! empty( $_POST['flowbie_speed_import_speed'] ),
				'import_speed_images' => ! empty( $_POST['flowbie_speed_import_images'] ),
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
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_APPLY_SPEED_PRESET, 'flowbie_wp_apply_speed_preset_nonce' );

		$tab       = isset( $_POST['flowbie_speed_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_speed_tab'] ) ) : 'cache';
		$preset_id = isset( $_POST['flowbie_speed_preset'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_speed_preset'] ) ) : '';

		$result = Flowbie_Wp_Speed_Import::apply_preset( $preset_id );
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
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_DOWNLOAD_SPEED_PRESET, 'flowbie_wp_download_speed_preset_nonce' );

		$preset_id = isset( $_GET['flowbie_speed_preset'] ) ? sanitize_key( wp_unslash( (string) $_GET['flowbie_speed_preset'] ) ) : Flowbie_Wp_Speed_Import::PRESET_ELEMENTOR_SAFE;

		$path = Flowbie_Wp_Speed_Import::preset_file_path( $preset_id );
		if ( ! is_readable( $path ) ) {
			wp_die( esc_html__( 'Preset file not found.', 'flowbie-wp' ) );
		}

		$json = file_get_contents( $path );
		if ( ! is_string( $json ) ) {
			wp_die( esc_html__( 'Could not read preset file.', 'flowbie-wp' ) );
		}

		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=flowbie-speed-preset-' . $preset_id . '.json' );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- JSON download body.
		echo $json;
		exit;
	}

	public static function handle_export_speed_settings(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_EXPORT_SPEED_SETTINGS, 'flowbie_wp_export_speed_settings_nonce' );

		$json     = Flowbie_Wp_Speed_Export::build_json();
		$filename = Flowbie_Wp_Speed_Export::download_filename();

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
		$url = admin_url( 'admin.php?page=flowbie-wp-speed' );
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
				$config['enabled']        = ! empty( $_POST['flowbie_speed_enabled'] );
				$config['skip_logged_in'] = ! empty( $_POST['flowbie_speed_skip_logged_in'] );
				if ( ! empty( $config['enabled'] ) ) {
					if ( ! $was_enabled ) {
						$config = Flowbie_Wp_Speed_Settings::apply_simple_enabled_config( $config );
					} else {
						$config['bypass_elementor'] = false;
					}
				} else {
					$config['enabled'] = false;
				}
				break;

			case 'css':
				$config['optimize_css']  = ! empty( $_POST['flowbie_speed_optimize_css'] );
				$config['aggregate_css'] = ! empty( $_POST['flowbie_speed_aggregate_css'] );
				break;

			case 'javascript':
				$config['optimize_js']  = ! empty( $_POST['flowbie_speed_optimize_js'] );
				$config['aggregate_js'] = ! empty( $_POST['flowbie_speed_aggregate_js'] );
				$config['defer_js']     = ! empty( $_POST['flowbie_speed_defer_js'] );
				break;

			case 'html':
				$config['minify_html']          = ! empty( $_POST['flowbie_speed_minify_html'] );
				$config['remove_query_strings'] = ! empty( $_POST['flowbie_speed_remove_query_strings'] );
				break;

			case 'excludes':
				$config['js_exclude']  = isset( $_POST['flowbie_speed_js_exclude'] ) ? wp_unslash( (string) $_POST['flowbie_speed_js_exclude'] ) : (string) ( $existing['js_exclude'] ?? '' );
				$config['css_exclude'] = isset( $_POST['flowbie_speed_css_exclude'] ) ? wp_unslash( (string) $_POST['flowbie_speed_css_exclude'] ) : (string) ( $existing['css_exclude'] ?? '' );
				break;

			default:
				break;
		}

		if ( ! empty( $existing['imported_autoptimize'] ) ) {
			$config['imported_autoptimize'] = true;
		}

		return Flowbie_Wp_Speed_Settings::sanitize_config( $config );
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
}
