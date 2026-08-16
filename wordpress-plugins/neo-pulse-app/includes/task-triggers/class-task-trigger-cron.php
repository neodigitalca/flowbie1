<?php
/**
 * Hourly cron for task trigger evaluation.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Trigger_Cron {

	const HOOK = 'neo_pulse_app_task_trigger_evaluate';

	public static function init(): void {
		add_action( self::HOOK, array( __CLASS__, 'run' ) );
		add_action( 'init', array( __CLASS__, 'maybe_schedule' ) );
	}

	public static function activate(): void {
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + 120, 'hourly', self::HOOK );
		}
	}

	public static function deactivate(): void {
		$ts = wp_next_scheduled( self::HOOK );
		if ( $ts ) {
			wp_unschedule_event( $ts, self::HOOK );
		}
	}

	public static function maybe_schedule(): void {
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + 120, 'hourly', self::HOOK );
		}
	}

	public static function run(): void {
		global $wpdb;
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
			foreach ( Neo_Pulse_App_Tasks_Store::list_trigger_tasks( $team_id ) as $task ) {
				if ( ! is_array( $task ) ) {
					continue;
				}
				Neo_Pulse_App_Task_Trigger_Evaluator::cron_evaluate_and_queue( $team_id, $task );
			}
		}
	}
}
