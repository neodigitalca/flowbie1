<?php
/**
 * Deactivate third-party plugins after Super Import.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Super_Import_Plugins {

	const OPTION_DEACTIVATED = 'neo_pulse_wp_super_import_deactivated_plugins';

	/**
	 * Rank Math free + Pro bootstrap files (separate plugins in wp-admin).
	 *
	 * @return array<string, string> file => label
	 */
	public static function rank_math_bootstrap_files(): array {
		return array(
			'seo-by-rank-math/rank-math.php'         => 'Rank Math SEO',
			'seo-by-rank-math-pro/rank-math-pro.php' => 'Rank Math SEO PRO',
		);
	}

	/**
	 * Plugin bootstrap files that may conflict after import, keyed by adapter id.
	 *
	 * @return array<string, array<string, string>>
	 */
	private static function adapter_plugin_map(): array {
		return array(
			'acf'         => array(
				'advanced-custom-fields/acf.php'     => 'Advanced Custom Fields',
				'advanced-custom-fields-pro/acf.php' => 'Advanced Custom Fields PRO',
			),
			'rank_math'   => self::rank_math_bootstrap_files(),
			'hfcm'        => array(
				'header-footer-code-manager/99robots-header-footer-code-manager.php' => 'Header Footer Code Manager',
				'99robots-header-footer-code-manager-pro/99robots-header-footer-code-manager-pro.php' => 'Header Footer Code Manager Pro',
				'header-footer-code-manager-pro/99robots-header-footer-code-manager-pro.php' => 'Header Footer Code Manager Pro',
				'insert-headers-and-footers/ihaf.php' => 'WPCode',
				'wpcode/wpcode.php'                   => 'WPCode',
				'wpcode-premium/wpcode.php'           => 'WPCode Premium',
				'wp-headers-and-footers/wp-headers-and-footers.php' => 'WP Headers and Footers',
			),
			'autoptimize' => array(
				'autoptimize/autoptimize.php' => 'Autoptimize',
			),
		);
	}

	/**
	 * @param array<int, string> $adapter_ids Adapter ids from a completed import job.
	 * @return array<int, array{file: string, label: string, adapter_id: string}>
	 */
	public static function active_for_adapters( array $adapter_ids ): array {
		if ( empty( $adapter_ids ) ) {
			return array();
		}

		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$map    = self::adapter_plugin_map();
		$out    = array();
		$seen   = array();
		$neo_pulse = plugin_basename( NEO_PULSE_WP_PLUGIN_FILE );

		foreach ( $adapter_ids as $adapter_id ) {
			$adapter_id = sanitize_key( (string) $adapter_id );
			if ( $adapter_id === '' || ! isset( $map[ $adapter_id ] ) ) {
				continue;
			}
			foreach ( $map[ $adapter_id ] as $file => $label ) {
				if ( isset( $seen[ $file ] ) || $file === $neo_pulse ) {
					continue;
				}
				if ( ! is_plugin_active( $file ) ) {
					continue;
				}
				$seen[ $file ] = true;
				$out[]         = array(
					'file'        => $file,
					'label'       => (string) $label,
					'adapter_id'  => $adapter_id,
				);
			}
		}

		return $out;
	}

	/**
	 * Installed but inactive plugins from the Super Import conflict map.
	 *
	 * @param array<int, string> $adapter_ids Adapter ids.
	 * @return array<int, array{file: string, label: string, adapter_id: string}>
	 */
	public static function inactive_for_adapters( array $adapter_ids ): array {
		if ( empty( $adapter_ids ) ) {
			return array();
		}

		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$map     = self::adapter_plugin_map();
		$out     = array();
		$seen    = array();
		$neo_pulse = plugin_basename( NEO_PULSE_WP_PLUGIN_FILE );

		foreach ( $adapter_ids as $adapter_id ) {
			$adapter_id = sanitize_key( (string) $adapter_id );
			if ( $adapter_id === '' || ! isset( $map[ $adapter_id ] ) ) {
				continue;
			}
			foreach ( $map[ $adapter_id ] as $file => $label ) {
				if ( isset( $seen[ $file ] ) || $file === $neo_pulse ) {
					continue;
				}
				if ( ! file_exists( WP_PLUGIN_DIR . '/' . $file ) ) {
					continue;
				}
				if ( is_plugin_active( $file ) ) {
					continue;
				}
				$seen[ $file ] = true;
				$out[]         = array(
					'file'       => $file,
					'label'      => (string) $label,
					'adapter_id' => $adapter_id,
				);
			}
		}

		return $out;
	}

	/**
	 * Saved snapshot, or inactive import conflicts when Super Import already ran.
	 *
	 * @return array<int, array{file: string, label: string, deactivated_at?: int, adapter_id?: string}>
	 */
	public static function get_restorable_plugins(): array {
		$saved = self::get_deactivated_plugins();
		if ( ! empty( $saved ) ) {
			return $saved;
		}

		if ( ! self::flo_sheet_has_import() ) {
			return array();
		}

		$inactive = self::inactive_for_adapters(
			array( 'acf', 'rank_math', 'hfcm', 'autoptimize' )
		);
		$out      = array();
		foreach ( $inactive as $row ) {
			$out[] = array(
				'file'  => (string) $row['file'],
				'label' => (string) $row['label'],
			);
		}
		return $out;
	}

	private static function flo_sheet_has_import(): bool {
		if ( ! class_exists( 'Neo_Pulse_Wp_Neo_Pulse_Sheet', false ) ) {
			return false;
		}
		$sheet = Neo_Pulse_Wp_Neo_Pulse_Sheet::get();
		if ( ! empty( $sheet['sheets']['fields']['groups'] ) && is_array( $sheet['sheets']['fields']['groups'] ) ) {
			return count( $sheet['sheets']['fields']['groups'] ) > 0;
		}
		if ( ! empty( $sheet['apply_log'] ) && is_array( $sheet['apply_log'] ) ) {
			return count( $sheet['apply_log'] ) > 0;
		}
		return false;
	}

	/**
	 * @param array<int, string>               $adapter_ids  Allowed adapter ids.
	 * @param array<int, string>               $plugin_files Plugin bootstrap paths.
	 * @return array{ok: bool, deactivated?: array<int, string>, error?: string}
	 */
	public static function deactivate_for_adapters( array $adapter_ids, array $plugin_files ): array {
		$allowed = self::active_for_adapters( $adapter_ids );
		if ( empty( $allowed ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'No conflicting plugins are active for this import.', 'neo-pulse-wp' ),
			);
		}

		$allowed_files = array();
		foreach ( $allowed as $row ) {
			$allowed_files[ $row['file'] ] = $row['label'];
		}

		if ( ! function_exists( 'deactivate_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$neo_pulse   = plugin_basename( NEO_PULSE_WP_PLUGIN_FILE );
		$to_run    = array();
		$deactivated = array();

		foreach ( $plugin_files as $file ) {
			$file = sanitize_text_field( (string) $file );
			if ( $file === '' || $file === $neo_pulse || ! isset( $allowed_files[ $file ] ) ) {
				continue;
			}
			if ( ! is_plugin_active( $file ) ) {
				continue;
			}
			$to_run[] = $file;
		}

		if ( empty( $to_run ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'Select at least one plugin to deactivate.', 'neo-pulse-wp' ),
			);
		}

		// Rank Math PRO is a separate plugin — deactivate it before the free plugin when both are selected.
		usort(
			$to_run,
			static function ( $a, $b ) {
				$a_is_pro = 0 === strpos( (string) $a, 'seo-by-rank-math-pro/' );
				$b_is_pro = 0 === strpos( (string) $b, 'seo-by-rank-math-pro/' );
				if ( $a_is_pro && ! $b_is_pro ) {
					return -1;
				}
				if ( ! $a_is_pro && $b_is_pro ) {
					return 1;
				}
				return strcmp( (string) $a, (string) $b );
			}
		);

		deactivate_plugins( $to_run, true );

		$deactivated_files = array();
		foreach ( $to_run as $file ) {
			if ( is_plugin_active( $file ) ) {
				return array(
					'ok'    => false,
					'error' => sprintf(
						/* translators: %s: plugin file path */
						__( 'Could not deactivate `%s`. Try deactivating it manually under Plugins.', 'neo-pulse-wp' ),
						$file
					),
				);
			}
			$deactivated_files[] = $file;
			$deactivated[]       = $allowed_files[ $file ];
		}

		self::remember_deactivated_plugins( $deactivated_files, $allowed_files );

		return array(
			'ok'                => true,
			'deactivated'       => $deactivated,
			'deactivated_files' => $deactivated_files,
		);
	}

	/**
	 * @return array<int, array{file: string, label: string, deactivated_at?: int}>
	 */
	public static function get_deactivated_plugins(): array {
		$raw = get_option( self::OPTION_DEACTIVATED, array() );
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$out = array();
		foreach ( $raw as $row ) {
			if ( ! is_array( $row ) || empty( $row['file'] ) ) {
				continue;
			}
			$out[] = array(
				'file'           => sanitize_text_field( (string) $row['file'] ),
				'label'          => sanitize_text_field( (string) ( $row['label'] ?? $row['file'] ) ),
				'deactivated_at' => isset( $row['deactivated_at'] ) ? (int) $row['deactivated_at'] : 0,
			);
		}
		return $out;
	}

	/**
	 * @param array<int, string>          $plugin_files Plugin bootstrap paths.
	 * @param array<string, string>        $labels_by_file file => label.
	 */
	public static function remember_deactivated_plugins( array $plugin_files, array $labels_by_file = array() ): void {
		if ( empty( $plugin_files ) ) {
			return;
		}

		$by_file = array();
		foreach ( self::get_deactivated_plugins() as $row ) {
			$by_file[ $row['file'] ] = $row;
		}

		$now = time();
		foreach ( $plugin_files as $file ) {
			$file = sanitize_text_field( (string) $file );
			if ( $file === '' ) {
				continue;
			}
			$by_file[ $file ] = array(
				'file'           => $file,
				'label'          => sanitize_text_field( (string) ( $labels_by_file[ $file ] ?? $file ) ),
				'deactivated_at' => $now,
			);
		}

		update_option( self::OPTION_DEACTIVATED, array_values( $by_file ), false );
	}

	/**
	 * @param array<int, array{file: string, label: string, deactivated_at?: int, adapter_id?: string}> $snapshot
	 */
	private static function label_for_file( string $file, array $snapshot ): string {
		foreach ( $snapshot as $row ) {
			if ( (string) ( $row['file'] ?? '' ) === $file ) {
				return (string) ( $row['label'] ?? $file );
			}
		}
		return $file;
	}

	private static function refresh_plugin_activation_cache(): void {
		wp_clean_plugins_cache( true );
		wp_cache_delete( 'active_plugins', 'options' );
	}

	/**
	 * @param string $file Plugin bootstrap path.
	 */
	private static function is_active_plugin_file( string $file ): bool {
		if ( function_exists( 'is_plugin_active' ) && is_plugin_active( $file ) ) {
			return true;
		}
		$active = get_option( 'active_plugins', array() );
		return is_array( $active ) && in_array( $file, $active, true );
	}

	/**
	 * @param array<int, string> $files Plugin bootstrap paths.
	 */
	private static function sort_activation_order( array $files ): array {
		usort(
			$files,
			static function ( $a, $b ) {
				$a_is_pro = 0 === strpos( (string) $a, 'seo-by-rank-math-pro/' );
				$b_is_pro = 0 === strpos( (string) $b, 'seo-by-rank-math-pro/' );
				if ( $a_is_pro && ! $b_is_pro ) {
					return 1;
				}
				if ( ! $a_is_pro && $b_is_pro ) {
					return -1;
				}
				return strcmp( (string) $a, (string) $b );
			}
		);
		return $files;
	}

	/**
	 * Reactivate plugins deactivated by Super Import and deactivate NEO Pulse WP.
	 *
	 * @return array{ok: bool, activated?: array<int, string>, failures?: array<int, array{file: string, label: string, error: string}>, neo_pulse_deactivated?: bool, error?: string}
	 */
	public static function restore_deactivated_plugins(): array {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'You do not have permission to activate plugins.', 'neo-pulse-wp' ),
			);
		}

		$snapshot = self::get_restorable_plugins();
		if ( empty( $snapshot ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'No Super Import plugin snapshot to restore.', 'neo-pulse-wp' ),
			);
		}

		if ( ! function_exists( 'activate_plugin' ) || ! function_exists( 'deactivate_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		self::refresh_plugin_activation_cache();

		$neo_pulse     = plugin_basename( NEO_PULSE_WP_PLUGIN_FILE );
		$to_activate = array();
		$already     = array();

		foreach ( $snapshot as $row ) {
			$file = (string) ( $row['file'] ?? '' );
			if ( $file === '' || $file === $neo_pulse ) {
				continue;
			}
			if ( ! file_exists( WP_PLUGIN_DIR . '/' . $file ) ) {
				continue;
			}
			if ( self::is_active_plugin_file( $file ) ) {
				$already[] = (string) ( $row['label'] ?? $file );
				continue;
			}
			$to_activate[] = $file;
		}

		$to_activate = array_values( array_unique( $to_activate ) );
		$to_activate = self::sort_activation_order( $to_activate );

		$activated = array();
		$failures  = array();

		foreach ( $to_activate as $file ) {
			ob_start();
			$result = activate_plugin( $file, '', false, true );
			ob_end_clean();
			self::refresh_plugin_activation_cache();

			$label = self::label_for_file( $file, $snapshot );

			if ( is_wp_error( $result ) ) {
				$failures[] = array(
					'file'  => $file,
					'label' => $label,
					'error' => $result->get_error_message(),
				);
				continue;
			}

			if ( ! self::is_active_plugin_file( $file ) ) {
				$failures[] = array(
					'file'  => $file,
					'label' => $label,
					'error' => __( 'Plugin did not stay active after activation.', 'neo-pulse-wp' ),
				);
				continue;
			}

			$activated[] = $label;
		}

		if ( empty( $activated ) && empty( $already ) && ! empty( $failures ) ) {
			$messages = array();
			foreach ( $failures as $failure ) {
				$messages[] = sprintf(
					'%s: %s',
					(string) ( $failure['label'] ?? $failure['file'] ),
					(string) ( $failure['error'] ?? '' )
				);
			}
			return array(
				'ok'       => false,
				'error'    => implode( '; ', $messages ),
				'failures' => $failures,
			);
		}

		$neo_pulse_deactivated = false;
		if ( self::is_active_plugin_file( $neo_pulse ) ) {
			ob_start();
			deactivate_plugins( $neo_pulse, true );
			ob_end_clean();
			self::refresh_plugin_activation_cache();
			$neo_pulse_deactivated = ! self::is_active_plugin_file( $neo_pulse );
		}

		delete_option( self::OPTION_DEACTIVATED );

		$response = array(
			'ok'                  => true,
			'activated'           => array_merge( $already, $activated ),
			'neo_pulse_deactivated' => $neo_pulse_deactivated,
		);

		if ( ! empty( $failures ) ) {
			$response['failures'] = $failures;
			$warnings             = array();
			foreach ( $failures as $failure ) {
				$warnings[] = sprintf(
					'%s: %s',
					(string) ( $failure['label'] ?? $failure['file'] ),
					(string) ( $failure['error'] ?? '' )
				);
			}
			$response['warning'] = implode( '; ', $warnings );
		}

		return $response;
	}
}
