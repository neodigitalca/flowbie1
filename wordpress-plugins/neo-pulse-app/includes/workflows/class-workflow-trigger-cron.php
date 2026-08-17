<?php
/**
 * Hourly workflow trigger evaluation cron.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Workflow_Trigger_Cron {

	const HOOK = 'neo_pulse_app_workflow_trigger_evaluate';

	public static function init(): void {
		add_action( self::HOOK, array( __CLASS__, 'run' ) );
		add_action( 'init', array( __CLASS__, 'maybe_schedule' ) );
	}

	public static function maybe_schedule(): void {
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + 180, 'hourly', self::HOOK );
		}
	}

	public static function activate(): void {
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time(), 'hourly', self::HOOK );
		}
	}

	public static function deactivate(): void {
		wp_clear_scheduled_hook( self::HOOK );
	}

	public static function run(): void {
		global $wpdb;
		Neo_Pulse_App_Workflows_Store::install_tables();
		$table = $wpdb->prefix . 'neo_pulse_teams';
		$rows  = $wpdb->get_results( "SELECT id FROM {$table} ORDER BY id ASC", ARRAY_A );
		if ( ! is_array( $rows ) ) {
			return;
		}
		foreach ( $rows as $row ) {
			$team_id = (int) ( $row['id'] ?? 0 );
			if ( $team_id <= 0 ) {
				continue;
			}
			Neo_Pulse_App_Workflow_Trigger_Evaluator::evaluate_team( $team_id );
		}
	}
}
