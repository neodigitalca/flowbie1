<?php
/**
 * Team task file assets (neo-pulse-data storage).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Tasks_Assets {

	private const ALLOWED_MIMES = array(
		'application/pdf',
		'text/plain',
		'text/csv',
		'text/markdown',
		'application/json',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'application/msword',
		'application/vnd.ms-excel',
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/webp',
	);

	/**
	 * @return array<string,mixed>|null
	 */
	public static function upload(
		int $team_id,
		int $task_id,
		int $user_id,
		string $file_name,
		string $mime,
		string $binary
	): ?array {
		if ( ! Neo_Pulse_App_Tasks_Store::get_task( $team_id, $task_id ) ) {
			return null;
		}

		$file_name = sanitize_file_name( $file_name );
		if ( $file_name === '' ) {
			return null;
		}
		$mime = sanitize_mime_type( $mime );
		if ( ! in_array( $mime, self::ALLOWED_MIMES, true ) ) {
			return null;
		}

		$max   = wp_max_upload_size();
		$bytes = strlen( $binary );
		if ( $bytes <= 0 || ( $max > 0 && $bytes > $max ) ) {
			return null;
		}

		$dir    = Neo_Pulse_App_Data_Paths::subdir( 'tasks/teams/' . $team_id );
		$stored = wp_unique_filename( $dir, $file_name );
		$path   = $dir . '/' . $stored;
		if ( false === file_put_contents( $path, $binary ) ) {
			return null;
		}

		$rel_path = 'tasks/teams/' . $team_id . '/' . $stored;
		$keyword  = sanitize_title( pathinfo( $file_name, PATHINFO_FILENAME ) );
		$payload  = array(
			'keyword'    => $keyword !== '' ? $keyword : 'file',
			'kind'       => 'file',
			'fileName'   => $file_name,
			'mime'       => $mime,
			'uploadedBy' => $user_id,
		);

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_task_files';
		$wpdb->insert(
			$table,
			array(
				'team_id'       => $team_id,
				'task_id'       => $task_id,
				'storage_path'  => $rel_path,
				'payload_json'  => Neo_Pulse_App_Tasks_Store::encode_payload( $payload ),
			),
			array( '%d', '%d', '%s', '%s' )
		);
		$id = (int) $wpdb->insert_id;
		if ( $id <= 0 ) {
			wp_delete_file( $path );
			return null;
		}

		$row = self::get_row( $id );
		return $row ? Neo_Pulse_App_Tasks_Store::format_file( $row ) : null;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_for_task( int $team_id, int $task_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_task_files';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND task_id = %d ORDER BY id ASC",
				$team_id,
				$task_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = Neo_Pulse_App_Tasks_Store::format_file( $row );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_row( int $asset_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_task_files';
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $asset_id ), ARRAY_A );
		return is_array( $row ) ? $row : null;
	}

	/**
	 * Persist execution archive files from a complete payload or agent run artifacts.
	 *
	 * @param array<string,mixed> $body
	 */
	public static function archive_execution_outputs(
		int $team_id,
		int $task_id,
		int $user_id,
		array $body
	): void {
		if ( ! Neo_Pulse_App_Tasks_Store::get_task( $team_id, $task_id ) ) {
			return;
		}

		if ( ! empty( $body['archiveFiles'] ) && is_array( $body['archiveFiles'] ) ) {
			foreach ( $body['archiveFiles'] as $file ) {
				if ( ! is_array( $file ) ) {
					continue;
				}
				$file_name   = sanitize_file_name( (string) ( $file['fileName'] ?? '' ) );
				$mime        = sanitize_text_field( (string) ( $file['mime'] ?? 'application/octet-stream' ) );
				$data_base64 = (string) ( $file['dataBase64'] ?? '' );
				if ( $file_name === '' || $data_base64 === '' ) {
					continue;
				}
				$binary = base64_decode( $data_base64, true );
				if ( $binary === false || $binary === '' ) {
					continue;
				}
				self::upload( $team_id, $task_id, $user_id, $file_name, $mime, $binary );
			}
		}

		$run_id = (int) ( $body['agentRunId'] ?? $body['agent_run_id'] ?? 0 );
		if ( $run_id > 0 ) {
			self::archive_from_agent_run( $team_id, $task_id, $user_id, $run_id );
		}
	}

	public static function archive_from_agent_run( int $team_id, int $task_id, int $user_id, int $run_id ): void {
		if ( ! class_exists( 'Neo_Pulse_App_Agent_Runs_Artifacts' ) ) {
			return;
		}
		$artifacts = Neo_Pulse_App_Agent_Runs_Artifacts::list_artifacts( $run_id );
		if ( ! is_array( $artifacts ) || count( $artifacts ) === 0 ) {
			return;
		}

		$dir = Neo_Pulse_App_Agent_Runs_Artifacts::run_dir( $run_id );
		foreach ( $artifacts as $artifact ) {
			if ( ! is_array( $artifact ) ) {
				continue;
			}
			$name = sanitize_file_name( (string) ( $artifact['name'] ?? '' ) );
			if ( $name === '' ) {
				continue;
			}
			$step_key = sanitize_key( (string) ( $artifact['stepKey'] ?? 'artifact' ) );
			$file_id  = sanitize_key( (string) ( $artifact['id'] ?? '' ) );
			$filename = $step_key . '-' . $file_id . '-' . $name;
			$path     = trailingslashit( $dir ) . $filename;
			if ( ! is_readable( $path ) ) {
				continue;
			}
			$binary = file_get_contents( $path );
			if ( $binary === false || $binary === '' ) {
				continue;
			}
			$mime = (string) ( $artifact['mime'] ?? 'application/octet-stream' );
			if ( $mime === '' ) {
				$mime = 'application/octet-stream';
			}
			self::upload( $team_id, $task_id, $user_id, $name, $mime, $binary );
		}
	}

	public static function delete( int $team_id, int $task_id, int $asset_id ): bool {
		$row = self::get_row( $asset_id );
		if ( ! $row || (int) $row['team_id'] !== $team_id || (int) $row['task_id'] !== $task_id ) {
			return false;
		}

		$rel = (string) $row['storage_path'];
		foreach ( Neo_Pulse_App_Data_Paths::rel_abs_candidates( $rel ) as $abs ) {
			if ( is_readable( $abs ) ) {
				wp_delete_file( $abs );
			}
		}

		global $wpdb;
		$table   = $wpdb->prefix . 'neo_pulse_team_task_files';
		$deleted = $wpdb->delete( $table, array( 'id' => $asset_id ), array( '%d' ) );

		return $deleted !== false && $deleted > 0;
	}

	public static function serve( int $team_id, int $task_id, int $asset_id, bool $inline = false ): void {
		$row = self::get_row( $asset_id );
		if ( ! $row || (int) $row['team_id'] !== $team_id || (int) $row['task_id'] !== $task_id ) {
			status_header( 404 );
			exit;
		}

		$rel = (string) $row['storage_path'];
		$abs = Neo_Pulse_App_Data_Paths::resolve_readable_abs( $rel );
		if ( $abs === null ) {
			status_header( 404 );
			exit;
		}

		$payload  = Neo_Pulse_App_Tasks_Store::decode_payload( $row['payload_json'] ?? '' );
		$mime     = (string) ( $payload['mime'] ?? 'application/octet-stream' );
		$file_name = (string) ( $payload['fileName'] ?? basename( $abs ) );

		header( 'Content-Type: ' . $mime );
		header( 'Content-Length: ' . (string) filesize( $abs ) );
		$disposition = $inline ? 'inline' : 'attachment';
		header( 'Content-Disposition: ' . $disposition . '; filename="' . rawurlencode( $file_name ) . '"' );
		readfile( $abs );
		exit;
	}
}
