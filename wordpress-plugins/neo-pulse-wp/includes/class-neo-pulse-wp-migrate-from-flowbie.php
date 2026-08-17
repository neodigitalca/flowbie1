<?php
/**
 * Migrate persisted Flowbie WP keys to NEO Pulse WP.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Migrate_From_Flowbie {

	const DONE_OPTION = 'neo_pulse_wp_migrated_from_flowbie_v1';

	/**
	 * Copy wp_options / user_meta / tables from flowbie_* to neo_pulse_* once.
	 */
	public static function maybe_run(): void {
		if ( get_option( self::DONE_OPTION, false ) ) {
			return;
		}

		global $wpdb;

		$option_like = $wpdb->esc_like( 'flowbie_wp_' ) . '%';
		$rows        = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT option_name, option_value, autoload FROM {$wpdb->options} WHERE option_name LIKE %s",
				$option_like
			),
			ARRAY_A
		);

		if ( is_array( $rows ) ) {
			foreach ( $rows as $row ) {
				$legacy_name = (string) $row['option_name'];
				$next_name   = 'neo_pulse_wp_' . substr( $legacy_name, strlen( 'flowbie_wp_' ) );
				if ( get_option( $next_name, null ) === null ) {
					add_option( $next_name, maybe_unserialize( $row['option_value'] ), '', $row['autoload'] );
				}
				delete_option( $legacy_name );
			}
		}

		$legacy_pairs = array(
			'flowbie_current_settings'       => 'neo_pulse_wp_settings',
			'flowbie_current_auto_setup_user' => 'neo_pulse_wp_auto_setup_user',
		);
		foreach ( $legacy_pairs as $legacy => $next ) {
			$legacy_val = get_option( $legacy, null );
			if ( $legacy_val !== null && $legacy_val !== false && get_option( $next, null ) === null ) {
				update_option( $next, $legacy_val, false );
			}
			if ( $legacy_val !== null ) {
				delete_option( $legacy );
			}
		}

		$table_suffixes = array( 'overseer_visits', 'overseer_reports', 'overseer_tasks' );
		foreach ( $table_suffixes as $suffix ) {
			$legacy_table = $wpdb->prefix . 'flowbie_wp_' . $suffix;
			$next_table   = $wpdb->prefix . 'neo_pulse_wp_' . $suffix;
			$legacy_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $legacy_table ) );
			$next_exists   = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $next_table ) );
			if ( $legacy_exists === $legacy_table && $next_exists !== $next_table ) {
				$wpdb->query( "RENAME TABLE `{$legacy_table}` TO `{$next_table}`" );
			}
		}

		update_option( self::DONE_OPTION, '1', true );
	}
}
