<?php
/**
 * Task execution progress (JSON per team/execution).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Progress {

	const STEP_IDS = array(
		'prepInventory',
		'prepResearch',
		'inventory',
		'bulk',
		'load',
		'plan',
		'write',
		'polish',
		'publish',
		'done',
	);

	public static function init( int $team_id, int $execution_id, string $status = 'queued' ): void {
		self::write(
			$team_id,
			$execution_id,
			array(
				'status'      => $status,
				'stepId'      => 'load',
				'subProgress' => 0,
				'progress'    => 0,
				'message'     => '',
				'microLog'    => array(),
				'startTime'   => (int) round( microtime( true ) * 1000 ),
			)
		);
	}

	/**
	 * @param array<string,mixed> $update
	 */
	public static function update( int $team_id, int $execution_id, array $update ): void {
		$progress = self::get( $team_id, $execution_id );
		if ( ! $progress ) {
			return;
		}
		$progress = array_merge( $progress, $update );
		$progress['lastUpdate'] = (int) round( microtime( true ) * 1000 );
		self::write( $team_id, $execution_id, $progress );
	}

	/**
	 * @param array<string,mixed> $patch
	 */
	public static function patch_step( int $team_id, int $execution_id, array $patch ): void {
		$progress = self::get( $team_id, $execution_id );
		if ( ! $progress ) {
			return;
		}

		$step_id = sanitize_key( (string) ( $patch['stepId'] ?? '' ) );
		if ( $step_id !== '' && ! in_array( $step_id, self::STEP_IDS, true ) ) {
			return;
		}

		$sub = isset( $patch['subProgress'] ) ? (float) $patch['subProgress'] : (float) ( $progress['subProgress'] ?? 0 );
		$sub = max( 0, min( 1, $sub ) );

		$micro_log = isset( $progress['microLog'] ) && is_array( $progress['microLog'] ) ? $progress['microLog'] : array();
		$message   = isset( $patch['message'] ) ? sanitize_text_field( (string) $patch['message'] ) : '';
		if ( $step_id !== '' && ( $step_id !== ( $progress['stepId'] ?? '' ) || $message !== ( $progress['message'] ?? '' ) ) ) {
			$micro_log[] = array(
				'stepId'  => $step_id,
				'message' => $message,
			);
			while ( count( $micro_log ) > 100 ) {
				array_shift( $micro_log );
			}
		}

		$computed = isset( $patch['progress'] )
			? max( 0, min( 100, (int) $patch['progress'] ) )
			: self::compute_url_progress( $step_id !== '' ? $step_id : (string) ( $progress['stepId'] ?? 'load' ), $sub );

		$next = array_merge(
			$progress,
			array(
				'status'      => sanitize_key( (string) ( $patch['status'] ?? $progress['status'] ?? 'running' ) ),
				'stepId'      => $step_id !== '' ? $step_id : ( $progress['stepId'] ?? 'load' ),
				'subProgress' => $sub,
				'progress'    => max( (int) ( $progress['progress'] ?? 0 ), $computed ),
				'message'     => $message,
				'microLog'    => $micro_log,
				'lastUpdate'  => (int) round( microtime( true ) * 1000 ),
			)
		);
		if ( isset( $patch['error'] ) ) {
			$next['error'] = sanitize_text_field( (string) $patch['error'] );
		}
		self::write( $team_id, $execution_id, $next );
	}

	/** @param mixed $result */
	public static function complete( int $team_id, int $execution_id, $result = null ): void {
		$progress = self::get( $team_id, $execution_id );
		if ( ! $progress ) {
			return;
		}
		$now = (int) round( microtime( true ) * 1000 );
		$progress['status']      = 'completed';
		$progress['stepId']      = 'done';
		$progress['subProgress'] = 1;
		$progress['progress']    = 100;
		$progress['message']     = 'Done';
		$progress['result']      = $result;
		$progress['endTime']     = $now;
		$progress['lastUpdate']  = $now;
		self::write( $team_id, $execution_id, $progress );
	}

	public static function fail( int $team_id, int $execution_id, string $error ): void {
		$progress = self::get( $team_id, $execution_id );
		if ( ! $progress ) {
			return;
		}
		$now = (int) round( microtime( true ) * 1000 );
		$progress['status']     = 'failed';
		$progress['error']        = $error;
		$progress['message']      = $error;
		$progress['endTime']      = $now;
		$progress['lastUpdate']   = $now;
		self::write( $team_id, $execution_id, $progress );
	}

	/** @return array<string,mixed>|null */
	public static function get( int $team_id, int $execution_id ) {
		return Neo_Pulse_App_Json_File_Store::read(
			Neo_Pulse_App_Data_Paths::task_execution_progress_path( $team_id, $execution_id )
		);
	}

	private static function compute_url_progress( string $step_id, float $sub ): int {
		$weights = array(
			'load'    => 8,
			'plan'    => 22,
			'write'   => 40,
			'polish'  => 10,
			'publish' => 17,
			'done'    => 3,
		);
		$order = array( 'load', 'plan', 'write', 'polish', 'publish', 'done' );
		$before = 0;
		foreach ( $order as $id ) {
			if ( $id === $step_id ) {
				$w = $weights[ $id ] ?? 0;
				return (int) min( 100, max( 0, round( $before + $w * max( 0, min( 1, $sub ) ) ) ) );
			}
			$before += $weights[ $id ] ?? 0;
		}
		return 0;
	}

	/** @param array<string,mixed> $data */
	private static function write( int $team_id, int $execution_id, array $data ): void {
		Neo_Pulse_App_Json_File_Store::write(
			Neo_Pulse_App_Data_Paths::task_execution_progress_path( $team_id, $execution_id ),
			$data
		);
	}
}
