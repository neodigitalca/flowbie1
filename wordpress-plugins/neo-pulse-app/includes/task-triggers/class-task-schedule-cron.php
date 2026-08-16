<?php
/**
 * Hourly cron for calendar automation task execution.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Schedule_Cron {

	const HOOK = 'neo_pulse_app_task_schedule_run';
	const TZ   = 'America/Edmonton';

	public static function init(): void {
		add_action( self::HOOK, array( __CLASS__, 'run' ) );
		add_action( 'init', array( __CLASS__, 'maybe_schedule' ) );
	}

	public static function activate(): void {
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + 180, 'hourly', self::HOOK );
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
			wp_schedule_event( time() + 180, 'hourly', self::HOOK );
		}
	}

	public static function run(): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_teams';
		$rows  = $wpdb->get_results( "SELECT id FROM {$table} ORDER BY id ASC", ARRAY_A );
		if ( ! is_array( $rows ) ) {
			return;
		}

		$pulse_id = Neo_Pulse_App_Tasks_Store::pulse_bot_user_id();
		if ( $pulse_id <= 0 ) {
			return;
		}

		foreach ( $rows as $row ) {
			$team_id = (int) ( $row['id'] ?? 0 );
			if ( $team_id <= 0 ) {
				continue;
			}
			foreach ( Neo_Pulse_App_Tasks_Store::list_calendar_automation_tasks( $team_id ) as $summary ) {
				if ( ! is_array( $summary ) ) {
					continue;
				}
				$task_id = (int) ( $summary['id'] ?? 0 );
				if ( $task_id <= 0 ) {
					continue;
				}
				$task = Neo_Pulse_App_Tasks_Store::get_task( $team_id, $task_id );
				if ( ! is_array( $task ) ) {
					continue;
				}
				if ( ! self::task_due_now( $task ) ) {
					continue;
				}
				$run_key = self::run_dedupe_key( $task );
				$meta    = is_array( $task['scheduleMeta'] ?? null ) ? $task['scheduleMeta'] : array();
				if ( (string) ( $meta['lastRunKey'] ?? '' ) === $run_key ) {
					continue;
				}

				$result = Neo_Pulse_App_Task_Execution_Coordinator::start( $team_id, $task_id, $pulse_id, array() );
				if ( empty( $result['ok'] ) || empty( $result['execution'] ) ) {
					continue;
				}

				$execution = is_array( $result['execution'] ) ? $result['execution'] : array();
				$kind      = Neo_Pulse_App_Tasks_Store::sanitize_execution_kind( $task['executionKind'] ?? '' );
				$recipe    = self::execution_kind_to_recipe( $kind );
				if ( $recipe !== '' ) {
					$status = sanitize_key( (string) ( $execution['status'] ?? '' ) );
					$plan   = array(
						'taskExecutionId' => (int) ( $execution['id'] ?? 0 ),
					);
					if ( $status === 'completed' ) {
						$plan['completedOnServer'] = true;
					} elseif ( isset( $execution['clientRunContract'] ) && is_array( $execution['clientRunContract'] ) ) {
						$plan['clientRunContract'] = $execution['clientRunContract'];
					}
					if ( ! empty( $execution['executionMode'] ) ) {
						$plan['executionMode'] = sanitize_key( (string) $execution['executionMode'] );
					} elseif ( isset( $execution['payload']['executionMode'] ) ) {
						$plan['executionMode'] = sanitize_key( (string) $execution['payload']['executionMode'] );
					}
					Neo_Pulse_App_Agent_Runs_Store::create_run(
						$team_id,
						$pulse_id,
						array(
							'recipeKey' => $recipe,
							'title'     => (string) ( $task['title'] ?? 'Automation run' ),
							'source'    => 'task_manager',
							'taskId'    => $task_id,
							'context'   => array(
								'siteId'      => (string) ( $task['wordpressSiteId'] ?? '' ),
								'taskKeyword' => (string) ( $task['keyword'] ?? '' ),
								'taskTitle'   => (string) ( $task['title'] ?? '' ),
								'projectId'   => (int) ( $task['projectId'] ?? 0 ),
							),
							'plan'      => $plan,
						)
					);
				}

				Neo_Pulse_App_Tasks_Store::patch_task_schedule_meta(
					$team_id,
					$task_id,
					array(
						'lastRunKey' => $run_key,
						'lastRunAt'  => gmdate( 'c' ),
					)
				);
			}
		}
	}

	/**
	 * @param array<string,mixed> $task
	 */
	private static function task_due_now( array $task ): bool {
		$due_date = substr( (string) ( $task['dueDate'] ?? '' ), 0, 10 );
		$due_time = Neo_Pulse_App_Tasks_Store::sanitize_due_time( $task['dueTime'] ?? '' );
		if ( $due_date === '' || $due_time === '' ) {
			return false;
		}
		if ( Neo_Pulse_App_Tasks_Store::sanitize_schedule_mode( $task['scheduleMode'] ?? 'calendar' ) !== 'calendar' ) {
			return false;
		}

		$date_key = self::edmonton_date_key();
		$due_min  = self::minute_of_day( $due_time );
		$now_min  = self::edmonton_minute_of_day();
		if ( $due_min === null || $now_min < $due_min ) {
			return false;
		}

		return self::recurrence_matches_today( $task, $date_key );
	}

	/**
	 * @param array<string,mixed> $task
	 */
	private static function recurrence_matches_today( array $task, string $date_key ): bool {
		$due_date   = substr( (string) ( $task['dueDate'] ?? '' ), 0, 10 );
		$recurrence = Neo_Pulse_App_Tasks_Store::sanitize_recurrence_rule( $task['recurrenceRule'] ?? 'none' );

		switch ( $recurrence ) {
			case 'daily':
				return $date_key >= $due_date;
			case 'weekly':
				if ( $date_key < $due_date ) {
					return false;
				}
				$anchor = new DateTime( $due_date, new DateTimeZone( self::TZ ) );
				$now    = new DateTime( 'now', new DateTimeZone( self::TZ ) );
				return $anchor->format( 'N' ) === $now->format( 'N' );
			case 'monthly':
				return substr( $due_date, 8, 2 ) === substr( $date_key, 8, 2 );
			case 'yearly':
				return substr( $due_date, 5, 5 ) === substr( $date_key, 5, 5 );
			case 'none':
			default:
				return $due_date === $date_key;
		}
	}

	/**
	 * @param array<string,mixed> $task
	 */
	private static function run_dedupe_key( array $task ): string {
		$due_time   = Neo_Pulse_App_Tasks_Store::sanitize_due_time( $task['dueTime'] ?? '' );
		$date_key   = self::edmonton_date_key();
		$due_date   = substr( (string) ( $task['dueDate'] ?? '' ), 0, 10 );
		$recurrence = Neo_Pulse_App_Tasks_Store::sanitize_recurrence_rule( $task['recurrenceRule'] ?? 'none' );

		switch ( $recurrence ) {
			case 'daily':
				return $date_key . ':' . $due_time;
			case 'weekly':
				$now = new DateTime( 'now', new DateTimeZone( self::TZ ) );
				return $now->format( 'o-\WW' ) . ':' . $due_time;
			case 'monthly':
				return substr( $date_key, 0, 7 ) . ':' . $due_time;
			case 'yearly':
				return substr( $date_key, 0, 4 ) . ':' . substr( $due_date, 5, 5 ) . ':' . $due_time;
			case 'none':
			default:
				return $date_key . ':' . $due_time;
		}
	}

	private static function edmonton_date_key(): string {
		$dt = new DateTime( 'now', new DateTimeZone( self::TZ ) );
		return $dt->format( 'Y-m-d' );
	}

	private static function edmonton_minute_of_day(): int {
		$dt = new DateTime( 'now', new DateTimeZone( self::TZ ) );
		return ( (int) $dt->format( 'G' ) * 60 ) + (int) $dt->format( 'i' );
	}

	/**
	 * @return int|null
	 */
	private static function minute_of_day( string $due_time ) {
		if ( ! preg_match( '/^(\d{1,2}):(\d{2})/', $due_time, $m ) ) {
			return null;
		}
		$hour   = (int) $m[1];
		$minute = (int) $m[2];
		if ( $hour < 0 || $hour > 23 || $minute < 0 || $minute > 59 ) {
			return null;
		}
		return ( $hour * 60 ) + $minute;
	}

	private static function execution_kind_to_recipe( string $kind ): string {
		if ( $kind === 'content_optimizer' ) {
			return 'content_optimizer_bulk';
		}
		if ( $kind === 'content_optimizer_meta' ) {
			return 'overview_pages_meta_batch';
		}
		if ( $kind === 'gsc_reporting' ) {
			return 'gsc_reporting';
		}
		if ( $kind === 'post_creator' ) {
			return 'post_creator';
		}
		return '';
	}
}
