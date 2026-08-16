<?php
/**
 * WP Cron worker for server-side agent runs.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Worker_Cron {

	const HOOK = 'neo_pulse_app_agent_run_worker';

	public static function init(): void {
		add_action( self::HOOK, array( __CLASS__, 'run' ) );
	}

	public static function activate(): void {
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + 60, 'neo_pulse_two_minutes', self::HOOK );
		}
	}

	public static function deactivate(): void {
		$timestamp = wp_next_scheduled( self::HOOK );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, self::HOOK );
		}
	}

	public static function register_schedule( array $schedules ): array {
		if ( ! isset( $schedules['neo_pulse_two_minutes'] ) ) {
			$schedules['neo_pulse_two_minutes'] = array(
				'interval' => 120,
				'display'  => 'Every 2 minutes (NEO Pulse agent worker)',
			);
		}
		return $schedules;
	}

	public static function run(): void {
		if ( ! class_exists( 'Neo_Pulse_App_Agent_Run_Worker' ) ) {
			return;
		}
		Neo_Pulse_App_Agent_Run_Worker::process_pending_runs();
	}

	public static function kick(): void {
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			self::activate();
		}
		wp_schedule_single_event( time() + 5, self::HOOK );
	}
}

add_filter( 'cron_schedules', array( 'Neo_Pulse_App_Agent_Run_Worker_Cron', 'register_schedule' ) );
