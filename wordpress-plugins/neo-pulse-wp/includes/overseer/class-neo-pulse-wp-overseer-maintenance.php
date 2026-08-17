<?php
/**
 * Overseer — visit deletes and retention prune
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Overseer_Maintenance {

	public static function delete_visit( int $id ): bool {
		global $wpdb;
		if ( $id < 1 ) {
			return false;
		}
		$table = Neo_Pulse_Wp_Overseer_Context::table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (bool) $wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );
	}
	public static function delete_all_visits(): int {
		global $wpdb;
		$table = Neo_Pulse_Wp_Overseer_Context::table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return (int) $wpdb->query( "TRUNCATE TABLE {$table}" );
	}
	public static function maybe_prune_retention(): void {
		self::prune_retention();
	}
	public static function prune_retention(): void {
		$settings = Neo_Pulse_Wp_Overseer_Settings::get_settings();
		$days     = (int) $settings['retention_days'];
		if ( $days < 1 ) {
			return;
		}
		$cutoff = gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) );
		global $wpdb;
		$table = Neo_Pulse_Wp_Overseer_Context::table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE created_at < %s", $cutoff ) );
	}
}
