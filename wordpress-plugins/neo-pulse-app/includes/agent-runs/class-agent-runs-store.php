<?php
/**
 * Agent run persistence (automation jobs for Running Agents sidebar).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Runs_Store {

	const STATUSES = array( 'queued', 'running', 'done', 'failed', 'cancelled' );

	const SOURCES = array( 'pulse_assist', 'task_manager' );

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$runs    = $wpdb->prefix . 'neo_pulse_agent_runs';
		$steps   = $wpdb->prefix . 'neo_pulse_agent_run_steps';

		dbDelta(
			"CREATE TABLE {$runs} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				created_by bigint(20) unsigned NOT NULL DEFAULT 0,
				title varchar(255) NOT NULL DEFAULT '',
				recipe_key varchar(64) NOT NULL DEFAULT '',
				status varchar(32) NOT NULL DEFAULT 'queued',
				source varchar(32) NOT NULL DEFAULT 'pulse_assist',
				task_id bigint(20) unsigned NOT NULL DEFAULT 0,
				context_json longtext NOT NULL,
				plan_json longtext NOT NULL,
				result_json longtext NULL,
				error_message text NULL,
				client_batch_key varchar(128) NOT NULL DEFAULT '',
				started_at datetime DEFAULT NULL,
				finished_at datetime DEFAULT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY team_status (team_id, status),
				KEY team_task (team_id, task_id),
				KEY created_at (created_at)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$steps} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				run_id bigint(20) unsigned NOT NULL,
				step_index int(11) NOT NULL DEFAULT 0,
				label varchar(255) NOT NULL DEFAULT '',
				status varchar(32) NOT NULL DEFAULT 'pending',
				payload_json longtext NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY run_id (run_id),
				KEY run_step (run_id, step_index)
			) {$charset};"
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function create_run( int $team_id, int $user_id, array $body ): ?array {
		if ( $team_id <= 0 || $user_id <= 0 ) {
			return null;
		}

		$recipe_key = sanitize_key( (string) ( $body['recipeKey'] ?? $body['recipe_key'] ?? '' ) );
		if ( ! Neo_Pulse_App_Agent_Runs_Recipe_Registry::is_valid( $recipe_key ) ) {
			return null;
		}

		$source = sanitize_key( (string) ( $body['source'] ?? 'pulse_assist' ) );
		if ( ! in_array( $source, self::SOURCES, true ) ) {
			$source = 'pulse_assist';
		}

		$task_id = (int) ( $body['taskId'] ?? $body['task_id'] ?? 0 );
		if ( $task_id > 0 ) {
			$task = Neo_Pulse_App_Tasks_Store::get_task( $team_id, $task_id );
			if ( ! $task ) {
				return null;
			}
		}

		$title = sanitize_text_field( (string) ( $body['title'] ?? '' ) );
		if ( $title === '' ) {
			$title = Neo_Pulse_App_Agent_Runs_Recipe_Registry::title_for( $recipe_key );
		}

		$context = isset( $body['context'] ) && is_array( $body['context'] ) ? $body['context'] : array();
		$plan    = isset( $body['plan'] ) && is_array( $body['plan'] ) ? $body['plan'] : array();
		if ( isset( $body['planJson'] ) && is_array( $body['planJson'] ) ) {
			$plan = $body['planJson'];
		}

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_agent_runs';
		$now   = current_time( 'mysql', true );

		$inserted = $wpdb->insert(
			$table,
			array(
				'team_id'           => $team_id,
				'created_by'        => $user_id,
				'title'             => $title,
				'recipe_key'        => $recipe_key,
				'status'            => 'queued',
				'source'            => $source,
				'task_id'           => $task_id,
				'context_json'      => wp_json_encode( $context ),
				'plan_json'         => wp_json_encode( $plan ),
				'result_json'       => null,
				'error_message'     => null,
				'client_batch_key'  => '',
				'started_at'        => null,
				'finished_at'       => null,
				'created_at'        => $now,
				'updated_at'        => $now,
			),
			array( '%d', '%d', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s' )
		);

		if ( ! $inserted ) {
			return null;
		}

		return self::get_run( $team_id, (int) $wpdb->insert_id );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_runs( int $team_id, array $filters = array() ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_agent_runs';

		$where  = array( 'team_id = %d' );
		$values = array( $team_id );

		if ( ! empty( $filters['status'] ) ) {
			$status = sanitize_key( (string) $filters['status'] );
			if ( in_array( $status, self::STATUSES, true ) ) {
				$where[]  = 'status = %s';
				$values[] = $status;
			}
		}

		if ( ! empty( $filters['source'] ) ) {
			$source = sanitize_key( (string) $filters['source'] );
			if ( in_array( $source, self::SOURCES, true ) ) {
				$where[]  = 'source = %s';
				$values[] = $source;
			}
		}

		if ( ! empty( $filters['task_id'] ) ) {
			$where[]  = 'task_id = %d';
			$values[] = (int) $filters['task_id'];
		}

		$limit = isset( $filters['limit'] ) ? min( 100, max( 1, (int) $filters['limit'] ) ) : 50;

		$sql = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY id DESC LIMIT %d';
		$values[] = $limit;

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $values ), ARRAY_A );
		if ( ! is_array( $rows ) ) {
			return array();
		}

		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format_run_row( $row );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_run( int $team_id, int $run_id, bool $with_steps = true ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_agent_runs';

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE id = %d AND team_id = %d LIMIT 1",
				$run_id,
				$team_id
			),
			ARRAY_A
		);

		if ( ! is_array( $row ) ) {
			return null;
		}

		$run = self::format_run_row( $row );
		if ( ! $run ) {
			return null;
		}

		if ( $with_steps ) {
			$run['steps'] = self::list_steps( $run_id );
		}

		return $run;
	}

	/**
	 * @param array<string,mixed> $patch
	 * @return array<string,mixed>|null
	 */
	public static function patch_run( int $team_id, int $run_id, array $patch ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_agent_runs';

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE id = %d AND team_id = %d LIMIT 1",
				$run_id,
				$team_id
			),
			ARRAY_A
		);

		if ( ! is_array( $row ) ) {
			return null;
		}

		$updates = array(
			'updated_at' => current_time( 'mysql', true ),
		);
		$formats = array( '%s' );

		if ( isset( $patch['status'] ) ) {
			$status = sanitize_key( (string) $patch['status'] );
			if ( in_array( $status, self::STATUSES, true ) ) {
				$updates['status'] = $status;
				$formats[]         = '%s';
				if ( $status === 'running' && empty( $row['started_at'] ) ) {
					$updates['started_at'] = current_time( 'mysql', true );
					$formats[]             = '%s';
				}
				if ( in_array( $status, array( 'done', 'failed', 'cancelled' ), true ) ) {
					$updates['finished_at'] = current_time( 'mysql', true );
					$formats[]              = '%s';
				}
			}
		}

		if ( isset( $patch['errorMessage'] ) || isset( $patch['error_message'] ) ) {
			$updates['error_message'] = sanitize_text_field(
				(string) ( $patch['errorMessage'] ?? $patch['error_message'] ?? '' )
			);
			$formats[] = '%s';
		}

		if ( isset( $patch['result'] ) && is_array( $patch['result'] ) ) {
			$updates['result_json'] = wp_json_encode( $patch['result'] );
			$formats[]              = '%s';
		}

		if ( isset( $patch['clientBatchKey'] ) || isset( $patch['client_batch_key'] ) ) {
			$updates['client_batch_key'] = sanitize_text_field(
				(string) ( $patch['clientBatchKey'] ?? $patch['client_batch_key'] ?? '' )
			);
			$formats[] = '%s';
		}

		if ( isset( $patch['step'] ) && is_array( $patch['step'] ) ) {
			self::append_step( $run_id, $patch['step'] );
		}

		$wpdb->update(
			$table,
			$updates,
			array(
				'id'      => $run_id,
				'team_id' => $team_id,
			),
			$formats,
			array( '%d', '%d' )
		);

		return self::get_run( $team_id, $run_id );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function cancel_run( int $team_id, int $run_id ): ?array {
		$run = self::get_run( $team_id, $run_id, false );
		if ( ! $run ) {
			return null;
		}
		if ( in_array( $run['status'], array( 'done', 'failed', 'cancelled' ), true ) ) {
			return $run;
		}
		return self::patch_run(
			$team_id,
			$run_id,
			array(
				'status' => 'cancelled',
			)
		);
	}

	/**
	 * @param array<string,mixed> $step
	 */
	public static function append_step( int $run_id, array $step ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_agent_run_steps';

		$step_index = isset( $step['stepIndex'] ) ? (int) $step['stepIndex'] : (int) ( $step['step_index'] ?? 0 );
		if ( $step_index <= 0 ) {
			$max = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT MAX(step_index) FROM {$table} WHERE run_id = %d",
					$run_id
				)
			);
			$step_index = $max + 1;
		}

		$label  = sanitize_text_field( (string) ( $step['label'] ?? '' ) );
		$status = sanitize_key( (string) ( $step['status'] ?? 'running' ) );
		if ( ! in_array( $status, array( 'pending', 'running', 'done', 'error' ), true ) ) {
			$status = 'running';
		}

		$payload = isset( $step['payload'] ) && is_array( $step['payload'] ) ? $step['payload'] : array();

		$wpdb->insert(
			$table,
			array(
				'run_id'       => $run_id,
				'step_index'   => $step_index,
				'label'        => $label,
				'status'       => $status,
				'payload_json' => wp_json_encode( $payload ),
				'created_at'   => current_time( 'mysql', true ),
			),
			array( '%d', '%d', '%s', '%s', '%s', '%s' )
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private static function list_steps( int $run_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_agent_run_steps';

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE run_id = %d ORDER BY step_index ASC, id ASC",
				$run_id
			),
			ARRAY_A
		);

		if ( ! is_array( $rows ) ) {
			return array();
		}

		$out = array();
		foreach ( $rows as $row ) {
			$payload = array();
			if ( ! empty( $row['payload_json'] ) ) {
				$decoded = json_decode( (string) $row['payload_json'], true );
				if ( is_array( $decoded ) ) {
					$payload = $decoded;
				}
			}
			$out[] = array(
				'id'         => (int) $row['id'],
				'stepIndex'  => (int) $row['step_index'],
				'label'      => (string) $row['label'],
				'status'     => (string) $row['status'],
				'payload'    => $payload,
				'createdAt'  => (string) $row['created_at'],
			);
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function format_run_row( array $row ): ?array {
		$context = array();
		$plan    = array();
		$result  = null;

		if ( ! empty( $row['context_json'] ) ) {
			$decoded = json_decode( (string) $row['context_json'], true );
			if ( is_array( $decoded ) ) {
				$context = $decoded;
			}
		}
		if ( ! empty( $row['plan_json'] ) ) {
			$decoded = json_decode( (string) $row['plan_json'], true );
			if ( is_array( $decoded ) ) {
				$plan = $decoded;
			}
		}
		if ( ! empty( $row['result_json'] ) ) {
			$decoded = json_decode( (string) $row['result_json'], true );
			if ( is_array( $decoded ) ) {
				$result = $decoded;
			}
		}

		$task_title = '';
		$task_id    = (int) ( $row['task_id'] ?? 0 );
		if ( $task_id > 0 ) {
			$task = Neo_Pulse_App_Tasks_Store::get_task( (int) $row['team_id'], $task_id );
			if ( is_array( $task ) ) {
				$task_title = (string) ( $task['title'] ?? '' );
			}
		}

		return array(
			'id'              => (int) $row['id'],
			'teamId'          => (int) $row['team_id'],
			'createdBy'       => (int) $row['created_by'],
			'title'           => (string) $row['title'],
			'recipeKey'       => (string) $row['recipe_key'],
			'recipeTitle'     => Neo_Pulse_App_Agent_Runs_Recipe_Registry::title_for( (string) $row['recipe_key'] ),
			'status'          => (string) $row['status'],
			'source'          => (string) $row['source'],
			'taskId'          => $task_id,
			'taskTitle'       => $task_title,
			'context'         => $context,
			'plan'            => $plan,
			'result'          => $result,
			'errorMessage'    => (string) ( $row['error_message'] ?? '' ),
			'clientBatchKey'  => (string) ( $row['client_batch_key'] ?? '' ),
			'startedAt'       => $row['started_at'] ? (string) $row['started_at'] : null,
			'finishedAt'      => $row['finished_at'] ? (string) $row['finished_at'] : null,
			'createdAt'       => (string) $row['created_at'],
			'updatedAt'       => (string) $row['updated_at'],
		);
	}
}
