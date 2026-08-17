<?php
/**
 * Speed module runtime diagnostics (admin + optional front-end marker).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Explains whether Speed actually changes HTML for guests vs logged-in users.
 */
class Neo_Pulse_Wp_Speed_Diagnostics {

	/**
	 * @return array<string, mixed>
	 */
	public static function status( ?array $config = null ): array {
		$config = is_array( $config ) ? $config : Neo_Pulse_Wp_Speed_Settings::get_config();
		$stats  = Neo_Pulse_Wp_Speed_Cache::stats();

		$transforms = self::active_transform_labels( $config );

		$last_write = Neo_Pulse_Wp_Speed_Cache::last_write_stats();

		return array(
			'module_enabled'        => ! empty( $config['enabled'] ),
			'active_transforms'     => $transforms,
			'has_active_transforms' => ! empty( $transforms ),
			'skip_logged_in'        => ! empty( $config['skip_logged_in'] ),
			'bypass_elementor'      => ! empty( $config['bypass_elementor'] ),
			'buffer_logged_in'      => self::buffer_would_run_for_logged_in( $config ),
			'buffer_guest'          => self::buffer_would_run_for_guest( $config ),
			'buffer_guest_home'     => self::buffer_would_run_for_guest_on_elementor_home( $config ),
			'current_is_elementor'  => Neo_Pulse_Wp_Speed_Gate::is_elementor_built_page(),
			'cache_files'           => (int) ( $stats['file_count'] ?? 0 ),
			'cache_bytes'           => (int) ( $stats['bytes'] ?? 0 ),
			'last_write_time'       => (int) ( $last_write['time'] ?? 0 ),
			'last_write_total'      => (int) ( $last_write['total_writes'] ?? 0 ),
			'elementor_active'      => defined( 'ELEMENTOR_VERSION' ),
			'conflicts'             => Neo_Pulse_Wp_Speed_Settings::conflicting_plugins(),
		);
	}

	/**
	 * @param array<string, mixed> $config Speed settings.
	 * @return array<int, string>
	 */
	public static function active_transform_labels( array $config ): array {
		$labels = array();
		if ( ! empty( $config['optimize_css'] ) ) {
			$labels[] = ! empty( $config['aggregate_css'] ) ? 'combine_css' : 'minify_css';
		}
		if ( ! empty( $config['optimize_js'] ) ) {
			if ( ! empty( $config['aggregate_js'] ) ) {
				$labels[] = 'combine_js';
			} else {
				$labels[] = 'minify_js';
			}
			if ( ! empty( $config['defer_js'] ) ) {
				$labels[] = 'defer_js';
			}
		}
		if ( ! empty( $config['minify_html'] ) ) {
			$labels[] = 'minify_html';
		}
		if ( ! empty( $config['remove_query_strings'] ) ) {
			$labels[] = 'remove_query_strings';
		}
		return $labels;
	}

	/**
	 * @param array<string, mixed> $config Speed settings.
	 */
	public static function buffer_would_run_for_guest( array $config ): bool {
		if ( empty( $config['enabled'] ) ) {
			return false;
		}
		if ( ! Neo_Pulse_Wp_Speed_Gate::config_has_active_transforms( $config ) ) {
			return false;
		}
		if ( ! empty( $config['bypass_elementor'] ) && Neo_Pulse_Wp_Speed_Gate::is_elementor_built_page() ) {
			return false;
		}
		return true;
	}

	/**
	 * Whether guests get Speed on the current front page when it is Elementor-built.
	 *
	 * @param array<string, mixed> $config Speed settings.
	 */
	public static function buffer_would_run_for_guest_on_elementor_home( array $config ): bool {
		if ( empty( $config['enabled'] ) || ! Neo_Pulse_Wp_Speed_Gate::config_has_active_transforms( $config ) ) {
			return false;
		}
		if ( ! empty( $config['bypass_elementor'] ) ) {
			return false;
		}
		return true;
	}

	/**
	 * @param array<string, mixed> $config Speed settings.
	 */
	public static function buffer_would_run_for_logged_in( array $config ): bool {
		if ( empty( $config['enabled'] ) ) {
			return false;
		}
		if ( ! empty( $config['skip_logged_in'] ) ) {
			return false;
		}
		return Neo_Pulse_Wp_Speed_Gate::config_has_active_transforms( $config );
	}

	/**
	 * Front-end HTML comment for support (admins only, ?neo-pulse_speed_debug=1).
	 */
	public static function maybe_print_footer_marker(): void {
		if ( is_admin() || ! isset( $_GET['neo-pulse_speed_debug'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$status = self::status();
		$status['viewer_logged_in'] = is_user_logged_in();
		$status['buffer_this_request'] = Neo_Pulse_Wp_Speed_Gate::should_optimize();
		$status['nocache_bypass']      = isset( $_GET['nocache'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		$json = wp_json_encode( $status );
		if ( ! is_string( $json ) ) {
			return;
		}
		echo "\n<!-- NEO Pulse Speed debug: " . esc_html( $json ) . " -->\n";
	}

	/**
	 * @param array<string, mixed> $status From status().
	 */
	public static function admin_summary_lines( array $status ): array {
		$lines   = array();
		$lines[] = ! empty( $status['module_enabled'] )
			? __( 'Speed module: ON', 'neo-pulse-wp' )
			: __( 'Speed module: OFF', 'neo-pulse-wp' );

		if ( empty( $status['has_active_transforms'] ) ) {
			$lines[] = __( 'HTML transforms: none (Speed will not change page HTML)', 'neo-pulse-wp' );
		} else {
			$lines[] = sprintf(
				/* translators: %s: comma-separated transform names */
				__( 'HTML transforms active: %s', 'neo-pulse-wp' ),
				implode( ', ', $status['active_transforms'] )
			);
		}

		$lines[] = ! empty( $status['buffer_logged_in'] )
			? __( 'Logged-in visitors: Speed buffer CAN run', 'neo-pulse-wp' )
			: __( 'Logged-in visitors: Speed buffer will NOT run', 'neo-pulse-wp' );

		if ( ! empty( $status['bypass_elementor'] ) && ! empty( $status['current_is_elementor'] ) ) {
			$lines[] = __( 'Guests on this Elementor page: Speed buffer will NOT run (Elementor bypass is on)', 'neo-pulse-wp' );
		} elseif ( ! empty( $status['buffer_guest'] ) ) {
			$lines[] = __( 'Guests (incognito): Speed buffer CAN run on typical pages', 'neo-pulse-wp' );
		} else {
			$lines[] = __( 'Guests (incognito): Speed buffer will NOT run', 'neo-pulse-wp' );
		}

		if ( ! empty( $status['bypass_elementor'] ) ) {
			$lines[] = __( 'Elementor bypass: ON — turn off or save General again after update', 'neo-pulse-wp' );
		} elseif ( ! empty( $status['elementor_active'] ) && ! empty( $status['buffer_guest_home'] ) ) {
			$lines[] = __( 'Elementor bypass: OFF — per-file CSS/JS minify allowed on builder pages', 'neo-pulse-wp' );
		}

		if ( ! empty( $status['last_write_time'] ) ) {
			$lines[] = sprintf(
				/* translators: 1: datetime, 2: write count */
				__( 'Last minified file written: %1$s (%2$d total writes)', 'neo-pulse-wp' ),
				wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) $status['last_write_time'] ),
				(int) $status['last_write_total']
			);
		}

		$lines[] = sprintf(
			/* translators: 1: file count, 2: formatted size */
			__( 'NEO Pulse asset cache on disk: %1$d files (%2$s) — not the same as WP Engine full-page cache', 'neo-pulse-wp' ),
			(int) $status['cache_files'],
			size_format( (int) $status['cache_bytes'] )
		);

		if ( ! empty( $status['conflicts'] ) ) {
			$lines[] = sprintf(
				/* translators: %s: plugin names */
				__( 'Other optimizers detected: %s (may still change HTML)', 'neo-pulse-wp' ),
				implode( ', ', $status['conflicts'] )
			);
		}

		return $lines;
	}
}
