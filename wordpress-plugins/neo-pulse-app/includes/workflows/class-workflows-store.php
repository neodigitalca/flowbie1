<?php
/**
 * Workflow definitions, runs, and step outputs.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Workflows_Store {

	const STATUSES = array( 'draft', 'published' );

	const RUN_STATUSES = array( 'queued', 'running', 'done', 'failed', 'cancelled' );

	const RAG_SCOPES = array( 'run', 'agent', 'shared' );

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset   = $wpdb->get_charset_collate();
		$workflows = $wpdb->prefix . 'neo_pulse_workflows';
		$runs      = $wpdb->prefix . 'neo_pulse_workflow_runs';
		$outputs   = $wpdb->prefix . 'neo_pulse_workflow_step_outputs';

		dbDelta(
			"CREATE TABLE {$workflows} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				payload_json longtext NOT NULL,
				status varchar(32) NOT NULL DEFAULT 'draft',
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				published_at datetime DEFAULT NULL,
				PRIMARY KEY (id),
				KEY team_id (team_id),
				KEY status (status)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$runs} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				workflow_id bigint(20) unsigned NOT NULL,
				payload_json longtext NOT NULL,
				status varchar(32) NOT NULL DEFAULT 'queued',
				current_node_id varchar(64) NOT NULL DEFAULT '',
				error_message text NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				finished_at datetime DEFAULT NULL,
				PRIMARY KEY (id),
				KEY team_workflow (team_id, workflow_id),
				KEY status (status)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$outputs} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				run_id bigint(20) unsigned NOT NULL,
				node_id varchar(64) NOT NULL DEFAULT '',
				payload_json longtext NOT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY team_run (team_id, run_id),
				KEY node_id (node_id)
			) {$charset};"
		);
	}

	private static function library_path( int $team_id ): string {
		return Neo_Pulse_App_Data_Paths::subdir( 'teams/' . (string) $team_id ) . '/workflow-library.json';
	}

	/**
	 * @param array<string,mixed> $payload
	 */
	private static function encode_payload( array $payload ): string {
		return wp_json_encode( $payload );
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function decode_payload( string $json ): array {
		$decoded = json_decode( $json, true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_workflow( int $team_id, int $workflow_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflows';
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE id = %d AND team_id = %d LIMIT 1",
				$workflow_id,
				$team_id
			),
			ARRAY_A
		);
		if ( ! is_array( $row ) ) {
			return null;
		}
		return self::format_workflow_row( $row );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_workflows( int $team_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflows';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d ORDER BY updated_at DESC, id DESC",
				$team_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		return array_values(
			array_map(
				static function ( $row ) {
					return self::format_workflow_row( $row );
				},
				$rows
			)
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function create_workflow( int $team_id, array $body ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflows';
		$name  = sanitize_text_field( (string) ( $body['name'] ?? 'Untitled workflow' ) );
		if ( $name === '' ) {
			$name = 'Untitled workflow';
		}
		$payload = array(
			'name'             => $name,
			'description'      => sanitize_textarea_field( (string) ( $body['description'] ?? '' ) ),
			'wordpressSiteId'  => isset( $body['wordpressSiteId'] ) ? sanitize_text_field( (string) $body['wordpressSiteId'] ) : null,
			'nodes'            => isset( $body['nodes'] ) && is_array( $body['nodes'] ) ? $body['nodes'] : array(),
			'edges'            => isset( $body['edges'] ) && is_array( $body['edges'] ) ? $body['edges'] : array(),
			'ragVariables'     => isset( $body['ragVariables'] ) && is_array( $body['ragVariables'] ) ? $body['ragVariables'] : array(),
		);
		$now = current_time( 'mysql', true );
		$ok  = $wpdb->insert(
			$table,
			array(
				'team_id'      => $team_id,
				'payload_json' => self::encode_payload( $payload ),
				'status'       => 'draft',
				'created_at'   => $now,
				'updated_at'   => $now,
				'published_at' => null,
			),
			array( '%d', '%s', '%s', '%s', '%s', '%s' )
		);
		if ( ! $ok ) {
			return null;
		}
		return self::get_workflow( $team_id, (int) $wpdb->insert_id );
	}

	/**
	 * @param array<string,mixed> $patch
	 * @return array<string,mixed>|null
	 */
	public static function patch_workflow( int $team_id, int $workflow_id, array $patch ): ?array {
		$existing = self::get_workflow( $team_id, $workflow_id );
		if ( ! $existing ) {
			return null;
		}
		$payload = array(
			'name'            => isset( $patch['name'] ) ? sanitize_text_field( (string) $patch['name'] ) : (string) ( $existing['name'] ?? '' ),
			'description'     => isset( $patch['description'] ) ? sanitize_textarea_field( (string) $patch['description'] ) : (string) ( $existing['description'] ?? '' ),
			'wordpressSiteId' => array_key_exists( 'wordpressSiteId', $patch )
				? ( $patch['wordpressSiteId'] !== null ? sanitize_text_field( (string) $patch['wordpressSiteId'] ) : null )
				: ( $existing['wordpressSiteId'] ?? null ),
			'nodes'           => isset( $patch['nodes'] ) && is_array( $patch['nodes'] ) ? $patch['nodes'] : ( $existing['nodes'] ?? array() ),
			'edges'           => isset( $patch['edges'] ) && is_array( $patch['edges'] ) ? $patch['edges'] : ( $existing['edges'] ?? array() ),
			'ragVariables'    => isset( $patch['ragVariables'] ) && is_array( $patch['ragVariables'] )
				? $patch['ragVariables']
				: ( $existing['ragVariables'] ?? array() ),
		);
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflows';
		$wpdb->update(
			$table,
			array(
				'payload_json' => self::encode_payload( $payload ),
				'updated_at'   => current_time( 'mysql', true ),
			),
			array(
				'id'      => $workflow_id,
				'team_id' => $team_id,
			),
			array( '%s', '%s' ),
			array( '%d', '%d' )
		);
		return self::get_workflow( $team_id, $workflow_id );
	}

	public static function delete_workflow( int $team_id, int $workflow_id ): bool {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflows';
		$deleted = $wpdb->delete(
			$table,
			array(
				'id'      => $workflow_id,
				'team_id' => $team_id,
			),
			array( '%d', '%d' )
		);
		return $deleted !== false && $deleted > 0;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function publish_workflow( int $team_id, int $workflow_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflows';
		$now   = current_time( 'mysql', true );
		$wpdb->update(
			$table,
			array(
				'status'       => 'published',
				'published_at' => $now,
				'updated_at'   => $now,
			),
			array(
				'id'      => $workflow_id,
				'team_id' => $team_id,
			),
			array( '%s', '%s', '%s' ),
			array( '%d', '%d' )
		);
		return self::get_workflow( $team_id, $workflow_id );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_published_workflows( int $team_id ): array {
		return array_values(
			array_filter(
				self::list_workflows( $team_id ),
				static function ( $wf ) {
					return is_array( $wf ) && (string) ( $wf['status'] ?? '' ) === 'published';
				}
			)
		);
	}

	/**
	 * @param array<string,mixed> $meta
	 * @return array<string,mixed>|null
	 */
	public static function create_run( int $team_id, int $workflow_id, array $meta = array() ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflow_runs';
		$now   = current_time( 'mysql', true );
		$payload = array(
			'triggerKind'    => sanitize_key( (string) ( $meta['triggerKind'] ?? '' ) ),
			'triggerPayload' => isset( $meta['triggerPayload'] ) && is_array( $meta['triggerPayload'] ) ? $meta['triggerPayload'] : array(),
			'simulated'      => ! empty( $meta['simulated'] ),
			'context'        => isset( $meta['context'] ) && is_array( $meta['context'] ) ? $meta['context'] : array(),
		);
		$ok = $wpdb->insert(
			$table,
			array(
				'team_id'         => $team_id,
				'workflow_id'     => $workflow_id,
				'payload_json'    => self::encode_payload( $payload ),
				'status'          => 'queued',
				'current_node_id' => '',
				'error_message'   => null,
				'created_at'      => $now,
				'updated_at'      => $now,
				'finished_at'     => null,
			),
			array( '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s' )
		);
		if ( ! $ok ) {
			return null;
		}
		return self::get_run( $team_id, (int) $wpdb->insert_id );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_run( int $team_id, int $run_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflow_runs';
		$row   = $wpdb->get_row(
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
		return self::format_run_row( $row );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_runs( int $team_id, int $workflow_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflow_runs';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND workflow_id = %d ORDER BY id DESC LIMIT 100",
				$team_id,
				$workflow_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		return array_values(
			array_map(
				static function ( $row ) {
					return self::format_run_row( $row );
				},
				$rows
			)
		);
	}

	/**
	 * @param array<string,mixed> $patch
	 * @return array<string,mixed>|null
	 */
	public static function patch_run( int $team_id, int $run_id, array $patch ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflow_runs';
		$row   = $wpdb->get_row(
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
		$payload = self::decode_payload( (string) ( $row['payload_json'] ?? '' ) );
		if ( isset( $patch['context'] ) && is_array( $patch['context'] ) ) {
			$payload['context'] = array_merge(
				isset( $payload['context'] ) && is_array( $payload['context'] ) ? $payload['context'] : array(),
				$patch['context']
			);
		}
		$updates = array(
			'payload_json' => self::encode_payload( $payload ),
			'updated_at'   => current_time( 'mysql', true ),
		);
		$formats = array( '%s', '%s' );
		if ( isset( $patch['status'] ) ) {
			$status = sanitize_key( (string) $patch['status'] );
			if ( in_array( $status, self::RUN_STATUSES, true ) ) {
				$updates['status'] = $status;
				$formats[]         = '%s';
				if ( in_array( $status, array( 'done', 'failed', 'cancelled' ), true ) ) {
					$updates['finished_at'] = current_time( 'mysql', true );
					$formats[]              = '%s';
				}
			}
		}
		if ( isset( $patch['currentNodeId'] ) ) {
			$updates['current_node_id'] = sanitize_text_field( (string) $patch['currentNodeId'] );
			$formats[]                  = '%s';
		}
		if ( isset( $patch['errorMessage'] ) ) {
			$updates['error_message'] = sanitize_text_field( (string) $patch['errorMessage'] );
			$formats[]                = '%s';
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
	 * @param array<string,mixed> $output
	 * @return array<string,mixed>|null
	 */
	public static function add_step_output( int $team_id, int $run_id, array $output ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflow_step_outputs';
		$key   = sanitize_key( (string) ( $output['variableKey'] ?? '' ) );
		if ( $key === '' ) {
			return null;
		}
		$scope = sanitize_key( (string) ( $output['scope'] ?? 'run' ) );
		if ( ! in_array( $scope, self::RAG_SCOPES, true ) ) {
			$scope = 'run';
		}
		$payload = array(
			'variableKey'  => $key,
			'nodeId'       => sanitize_text_field( (string) ( $output['nodeId'] ?? '' ) ),
			'scope'        => $scope,
			'label'        => sanitize_text_field( (string) ( $output['label'] ?? $key ) ),
			'textPreview'  => (string) ( $output['textPreview'] ?? '' ),
			'fileRefs'     => isset( $output['fileRefs'] ) && is_array( $output['fileRefs'] ) ? $output['fileRefs'] : array(),
			'agentRunId'   => isset( $output['agentRunId'] ) ? (int) $output['agentRunId'] : null,
		);
		$ok = $wpdb->insert(
			$table,
			array(
				'team_id'      => $team_id,
				'run_id'       => $run_id,
				'node_id'      => (string) $payload['nodeId'],
				'payload_json' => self::encode_payload( $payload ),
				'created_at'   => current_time( 'mysql', true ),
			),
			array( '%d', '%d', '%s', '%s', '%s' )
		);
		if ( ! $ok ) {
			return null;
		}
		return self::format_output_row(
			array(
				'id'           => (int) $wpdb->insert_id,
				'run_id'       => $run_id,
				'payload_json' => self::encode_payload( $payload ),
				'created_at'   => current_time( 'mysql', true ),
			)
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_step_outputs( int $team_id, int $run_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflow_step_outputs';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND run_id = %d ORDER BY id ASC",
				$team_id,
				$run_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		return array_values(
			array_map(
				static function ( $row ) {
					return self::format_output_row( $row );
				},
				$rows
			)
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_library_entries( int $team_id ): array {
		$data = Neo_Pulse_App_Json_File_Store::read( self::library_path( $team_id ) );
		if ( ! is_array( $data ) || ! isset( $data['entries'] ) || ! is_array( $data['entries'] ) ) {
			return array();
		}
		return array_values( $data['entries'] );
	}

	/**
	 * @param array<string,mixed> $entry
	 * @return array<string,mixed>|null
	 */
	public static function upsert_library_entry( int $team_id, string $key, array $entry ): ?array {
		$key = sanitize_key( $key );
		if ( $key === '' ) {
			return null;
		}
		$entries = self::list_library_entries( $team_id );
		$next    = array(
			'key'               => $key,
			'label'             => sanitize_text_field( (string) ( $entry['label'] ?? $key ) ),
			'textPreview'       => (string) ( $entry['textPreview'] ?? '' ),
			'fileRefs'          => isset( $entry['fileRefs'] ) && is_array( $entry['fileRefs'] ) ? $entry['fileRefs'] : array(),
			'scope'             => 'shared',
			'promotedFromRunId' => isset( $entry['promotedFromRunId'] ) ? (int) $entry['promotedFromRunId'] : null,
			'updatedAt'         => gmdate( 'c' ),
		);
		$found = false;
		foreach ( $entries as $idx => $item ) {
			if ( is_array( $item ) && (string) ( $item['key'] ?? '' ) === $key ) {
				$entries[ $idx ] = $next;
				$found           = true;
				break;
			}
		}
		if ( ! $found ) {
			$entries[] = $next;
		}
		Neo_Pulse_App_Json_File_Store::write(
			self::library_path( $team_id ),
			array(
				'entries'   => $entries,
				'updatedAt' => gmdate( 'c' ),
			)
		);
		return $next;
	}

	public static function delete_run( int $team_id, int $workflow_id, int $run_id ): bool {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflow_runs';
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT id, workflow_id FROM {$table} WHERE id = %d AND team_id = %d LIMIT 1",
				$run_id,
				$team_id
			),
			ARRAY_A
		);
		if ( ! is_array( $row ) ) {
			return false;
		}
		if ( (int) ( $row['workflow_id'] ?? 0 ) !== $workflow_id ) {
			return false;
		}
		self::delete_step_outputs_for_run( $team_id, $run_id );
		$wpdb->delete(
			$table,
			array(
				'id'      => $run_id,
				'team_id' => $team_id,
			),
			array( '%d', '%d' )
		);
		return true;
	}

	public static function clear_runs( int $team_id, int $workflow_id ): int {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflow_runs';
		$rows  = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT id FROM {$table} WHERE team_id = %d AND workflow_id = %d",
				$team_id,
				$workflow_id
			)
		);
		if ( ! is_array( $rows ) || $rows === array() ) {
			return 0;
		}
		foreach ( $rows as $run_id ) {
			self::delete_step_outputs_for_run( $team_id, (int) $run_id );
		}
		$deleted = $wpdb->delete(
			$table,
			array(
				'team_id'     => $team_id,
				'workflow_id' => $workflow_id,
			),
			array( '%d', '%d' )
		);
		return $deleted !== false ? (int) $deleted : 0;
	}

	private static function delete_step_outputs_for_run( int $team_id, int $run_id ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_workflow_step_outputs';
		$wpdb->delete(
			$table,
			array(
				'team_id' => $team_id,
				'run_id'  => $run_id,
			),
			array( '%d', '%d' )
		);
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>
	 */
	private static function format_workflow_row( array $row ): array {
		$payload = self::decode_payload( (string) ( $row['payload_json'] ?? '' ) );
		return array(
			'id'               => (int) ( $row['id'] ?? 0 ),
			'teamId'           => (int) ( $row['team_id'] ?? 0 ),
			'name'             => (string) ( $payload['name'] ?? '' ),
			'description'      => (string) ( $payload['description'] ?? '' ),
			'status'           => (string) ( $row['status'] ?? 'draft' ),
			'wordpressSiteId'  => isset( $payload['wordpressSiteId'] ) ? ( $payload['wordpressSiteId'] !== null ? (string) $payload['wordpressSiteId'] : null ) : null,
			'nodes'            => isset( $payload['nodes'] ) && is_array( $payload['nodes'] ) ? $payload['nodes'] : array(),
			'edges'            => isset( $payload['edges'] ) && is_array( $payload['edges'] ) ? $payload['edges'] : array(),
			'ragVariables'     => isset( $payload['ragVariables'] ) && is_array( $payload['ragVariables'] ) ? $payload['ragVariables'] : array(),
			'createdAt'        => (string) ( $row['created_at'] ?? '' ),
			'updatedAt'        => (string) ( $row['updated_at'] ?? '' ),
			'publishedAt'      => ! empty( $row['published_at'] ) ? (string) $row['published_at'] : null,
		);
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>
	 */
	private static function format_run_row( array $row ): array {
		$payload = self::decode_payload( (string) ( $row['payload_json'] ?? '' ) );
		return array(
			'id'             => (int) ( $row['id'] ?? 0 ),
			'workflowId'     => (int) ( $row['workflow_id'] ?? 0 ),
			'teamId'         => (int) ( $row['team_id'] ?? 0 ),
			'status'         => (string) ( $row['status'] ?? 'queued' ),
			'triggerKind'    => (string) ( $payload['triggerKind'] ?? '' ),
			'triggerPayload' => isset( $payload['triggerPayload'] ) && is_array( $payload['triggerPayload'] ) ? $payload['triggerPayload'] : array(),
			'currentNodeId'  => (string) ( $row['current_node_id'] ?? '' ),
			'errorMessage'   => ! empty( $row['error_message'] ) ? (string) $row['error_message'] : null,
			'createdAt'      => (string) ( $row['created_at'] ?? '' ),
			'updatedAt'      => (string) ( $row['updated_at'] ?? '' ),
			'finishedAt'     => ! empty( $row['finished_at'] ) ? (string) $row['finished_at'] : null,
		);
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>
	 */
	private static function format_output_row( array $row ): array {
		$payload = self::decode_payload( (string) ( $row['payload_json'] ?? '' ) );
		return array(
			'id'           => (int) ( $row['id'] ?? 0 ),
			'runId'        => (int) ( $row['run_id'] ?? 0 ),
			'nodeId'       => (string) ( $payload['nodeId'] ?? $row['node_id'] ?? '' ),
			'variableKey'  => (string) ( $payload['variableKey'] ?? '' ),
			'scope'        => (string) ( $payload['scope'] ?? 'run' ),
			'label'        => (string) ( $payload['label'] ?? '' ),
			'textPreview'  => (string) ( $payload['textPreview'] ?? '' ),
			'fileRefs'     => isset( $payload['fileRefs'] ) && is_array( $payload['fileRefs'] ) ? $payload['fileRefs'] : array(),
			'agentRunId'   => isset( $payload['agentRunId'] ) ? (int) $payload['agentRunId'] : null,
			'createdAt'    => (string) ( $row['created_at'] ?? '' ),
		);
	}
}
