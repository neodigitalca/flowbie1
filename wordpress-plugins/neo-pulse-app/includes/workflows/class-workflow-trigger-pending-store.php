<?php
/**
 * Pending workflow trigger dispatch queue (client poller).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Workflow_Trigger_Pending_Store {

	private static function path( int $team_id ): string {
		return Neo_Pulse_App_Data_Paths::subdir( 'teams/' . (string) $team_id ) . '/workflow-trigger-pending.json';
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list( int $team_id ): array {
		$data = Neo_Pulse_App_Json_File_Store::read( self::path( $team_id ) );
		if ( ! is_array( $data ) || ! isset( $data['pending'] ) || ! is_array( $data['pending'] ) ) {
			return array();
		}
		return $data['pending'];
	}

	/**
	 * @param array<string,mixed> $item
	 */
	public static function enqueue( int $team_id, array $item ): bool {
		$workflow_id = (int) ( $item['workflowId'] ?? 0 );
		if ( $workflow_id <= 0 ) {
			return false;
		}
		$pending = self::list( $team_id );
		$pending = array_values(
			array_filter(
				$pending,
				static function ( $existing ) use ( $workflow_id ) {
					return ! is_array( $existing ) || (int) ( $existing['workflowId'] ?? 0 ) !== $workflow_id;
				}
			)
		);
		$pending[] = array(
			'workflowId'  => $workflow_id,
			'runId'       => isset( $item['runId'] ) ? (int) $item['runId'] : null,
			'triggerKind' => sanitize_key( (string) ( $item['triggerKind'] ?? 'trigger_manual' ) ),
			'payload'     => isset( $item['payload'] ) && is_array( $item['payload'] ) ? $item['payload'] : array(),
			'simulated'   => ! empty( $item['simulated'] ),
			'createdAt'   => gmdate( 'c' ),
		);
		return Neo_Pulse_App_Json_File_Store::write(
			self::path( $team_id ),
			array(
				'pending'   => $pending,
				'updatedAt' => gmdate( 'c' ),
			)
		);
	}

	/**
	 * Atomically remove a pending dispatch when workflowId + runId match (one client wins).
	 */
	public static function claim( int $team_id, int $workflow_id, int $run_id ): bool {
		if ( $workflow_id <= 0 || $run_id <= 0 ) {
			return false;
		}
		$pending = self::list( $team_id );
		$matched = false;
		$next    = array();
		foreach ( $pending as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$item_workflow = (int) ( $item['workflowId'] ?? 0 );
			$item_run      = (int) ( $item['runId'] ?? 0 );
			if ( ! $matched && $item_workflow === $workflow_id && $item_run === $run_id ) {
				$matched = true;
				continue;
			}
			$next[] = $item;
		}
		if ( ! $matched ) {
			return false;
		}
		return Neo_Pulse_App_Json_File_Store::write(
			self::path( $team_id ),
			array(
				'pending'   => array_values( $next ),
				'updatedAt' => gmdate( 'c' ),
			)
		);
	}

	public static function dequeue( int $team_id, int $workflow_id ): bool {
		$pending = array_values(
			array_filter(
				self::list( $team_id ),
				static function ( $item ) use ( $workflow_id ) {
					return ! is_array( $item ) || (int) ( $item['workflowId'] ?? 0 ) !== $workflow_id;
				}
			)
		);
		return Neo_Pulse_App_Json_File_Store::write(
			self::path( $team_id ),
			array(
				'pending'   => $pending,
				'updatedAt' => gmdate( 'c' ),
			)
		);
	}
}
