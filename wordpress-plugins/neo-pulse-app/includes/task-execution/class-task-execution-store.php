<?php
/**
 * Task execution job store (team-scoped).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Store {

	const STATUSES = array(
		'queued',
		'preflight',
		'awaiting_client',
		'running',
		'completed',
		'failed',
		'cancelled',
	);

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$table   = $wpdb->prefix . 'neo_pulse_team_task_executions';

		dbDelta(
			"CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				task_id bigint(20) unsigned NOT NULL,
				execution_kind varchar(64) NOT NULL DEFAULT '',
				status varchar(32) NOT NULL DEFAULT 'queued',
				started_by bigint(20) unsigned NOT NULL DEFAULT 0,
				payload_json longtext NOT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				completed_at datetime DEFAULT NULL,
				PRIMARY KEY (id),
				KEY team_task (team_id, task_id),
				KEY status (status)
			) {$charset};"
		);
	}

	/**
	 * @param array<string,mixed> $payload
	 */
	public static function create(
		int $team_id,
		int $task_id,
		string $execution_kind,
		int $started_by,
		array $payload = array()
	): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_task_executions';
		$kind  = Neo_Pulse_App_Tasks_Store::sanitize_execution_kind( $execution_kind );
		if ( $kind === '' ) {
			return null;
		}

		$wpdb->insert(
			$table,
			array(
				'team_id'        => $team_id,
				'task_id'        => $task_id,
				'execution_kind' => $kind,
				'status'         => 'queued',
				'started_by'     => max( 0, $started_by ),
				'payload_json'   => wp_json_encode( $payload ) ?: '{}',
			),
			array( '%d', '%d', '%s', '%s', '%d', '%s' )
		);
		$id = (int) $wpdb->insert_id;
		if ( $id <= 0 ) {
			return null;
		}
		return self::get( $team_id, $id );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( int $team_id, int $execution_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_task_executions';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d AND team_id = %d", $execution_id, $team_id ),
			ARRAY_A
		);
		return is_array( $row ) ? self::format( $row ) : null;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_for_task( int $team_id, int $task_id, int $limit = 20 ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_task_executions';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND task_id = %d ORDER BY id DESC LIMIT %d",
				$team_id,
				$task_id,
				max( 1, min( 100, $limit ) )
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format( $row );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $patch
	 * @return array<string,mixed>|null
	 */
	public static function update( int $team_id, int $execution_id, array $patch ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_task_executions';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d AND team_id = %d", $execution_id, $team_id ),
			ARRAY_A
		);
		if ( ! is_array( $row ) ) {
			return null;
		}

		$update = array( 'updated_at' => gmdate( 'Y-m-d H:i:s' ) );
		$types  = array( '%s' );

		if ( isset( $patch['status'] ) ) {
			$status = sanitize_key( (string) $patch['status'] );
			if ( in_array( $status, self::STATUSES, true ) ) {
				$update['status'] = $status;
				$types[]          = '%s';
				if ( in_array( $status, array( 'completed', 'failed', 'cancelled' ), true ) ) {
					$update['completed_at'] = gmdate( 'Y-m-d H:i:s' );
					$types[]                = '%s';
				}
			}
		}

		if ( isset( $patch['payload'] ) && is_array( $patch['payload'] ) ) {
			$payload = self::decode_payload( $row['payload_json'] );
			$payload = array_merge( $payload, $patch['payload'] );
			$update['payload_json'] = wp_json_encode( $payload ) ?: '{}';
			$types[]                = '%s';
		}

		$wpdb->update(
			$table,
			$update,
			array( 'id' => $execution_id, 'team_id' => $team_id ),
			$types,
			array( '%d', '%d' )
		);
		return self::get( $team_id, $execution_id );
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function decode_payload( ?string $json ): array {
		if ( ! is_string( $json ) || $json === '' ) {
			return array();
		}
		$data = json_decode( $json, true );
		return is_array( $data ) ? $data : array();
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function format( array $row ): ?array {
		$payload = self::decode_payload( $row['payload_json'] ?? '' );
		return array(
			'id'             => (int) $row['id'],
			'teamId'         => (int) $row['team_id'],
			'taskId'         => (int) $row['task_id'],
			'executionKind'  => (string) $row['execution_kind'],
			'status'         => (string) $row['status'],
			'startedBy'      => (int) $row['started_by'],
			'createdAt'      => (string) $row['created_at'],
			'updatedAt'      => (string) $row['updated_at'],
			'completedAt'    => $row['completed_at'],
			'resolvedPost'   => isset( $payload['resolvedPost'] ) && is_array( $payload['resolvedPost'] )
				? $payload['resolvedPost']
				: null,
			'clientRunContract' => isset( $payload['clientRunContract'] ) && is_array( $payload['clientRunContract'] )
				? $payload['clientRunContract']
				: null,
			'executionMode'  => isset( $payload['executionMode'] ) ? sanitize_key( (string) $payload['executionMode'] ) : null,
			'result'         => $payload['result'] ?? null,
			'error'          => isset( $payload['error'] ) ? (string) $payload['error'] : null,
		);
	}
}
