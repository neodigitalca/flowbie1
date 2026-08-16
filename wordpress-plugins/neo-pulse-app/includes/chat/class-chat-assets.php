<?php
/**
 * Team chat file assets (neo-pulse-data storage).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Chat_Assets {

	private const ALLOWED_MIMES = array(
		'application/pdf',
		'text/plain',
		'text/csv',
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
		int $channel_id,
		int $user_id,
		string $file_name,
		string $mime,
		string $binary
	): ?array {
		$file_name = sanitize_file_name( $file_name );
		if ( $file_name === '' ) {
			return null;
		}
		$mime = sanitize_mime_type( $mime );
		if ( ! in_array( $mime, self::ALLOWED_MIMES, true ) ) {
			return null;
		}

		$max = wp_max_upload_size();
		$bytes = strlen( $binary );
		if ( $bytes <= 0 || ( $max > 0 && $bytes > $max ) ) {
			return null;
		}

		$dir = Neo_Pulse_App_Data_Paths::subdir( 'chat/teams/' . $team_id );
		$stored = wp_unique_filename( $dir, $file_name );
		$path   = $dir . '/' . $stored;
		if ( false === file_put_contents( $path, $binary ) ) {
			return null;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_assets';
		$wpdb->insert(
			$table,
			array(
				'team_id'       => $team_id,
				'channel_id'    => $channel_id,
				'message_id'    => 0,
				'user_id'       => $user_id,
				'file_name'     => $file_name,
				'mime'          => $mime,
				'bytes'         => $bytes,
				'storage_path'  => 'chat/teams/' . $team_id . '/' . $stored,
			),
			array( '%d', '%d', '%d', '%d', '%s', '%s', '%d', '%s' )
		);
		$id = (int) $wpdb->insert_id;
		if ( $id <= 0 ) {
			wp_delete_file( $path );
			return null;
		}

		return self::format_asset( self::get_row( $id ) );
	}

	/**
	 * @param array<int,int> $asset_ids
	 */
	public static function link_to_message(
		int $team_id,
		int $channel_id,
		int $message_id,
		int $user_id,
		array $asset_ids
	): void {
		if ( count( $asset_ids ) === 0 ) {
			return;
		}
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_assets';
		foreach ( $asset_ids as $asset_id ) {
			$asset_id = (int) $asset_id;
			if ( $asset_id <= 0 ) {
				continue;
			}
			$row = self::get_row( $asset_id );
			if ( ! $row || (int) $row['team_id'] !== $team_id || (int) $row['channel_id'] !== $channel_id ) {
				continue;
			}
			if ( (int) $row['user_id'] !== $user_id ) {
				continue;
			}
			if ( ! empty( $row['deleted_at'] ) ) {
				continue;
			}
			if ( (int) $row['message_id'] > 0 && (int) $row['message_id'] !== $message_id ) {
				continue;
			}

			$wpdb->update(
				$table,
				array( 'message_id' => $message_id ),
				array( 'id' => $asset_id ),
				array( '%d' ),
				array( '%d' )
			);

			Neo_Pulse_App_Chat_Activity_Log::append(
				$team_id,
				$channel_id,
				array(
					'kind'                => 'file_shared',
					'channelId'           => $channel_id,
					'messageId'           => $message_id,
					'userId'              => $user_id,
					'ts'                  => gmdate( 'c' ),
					'assetId'             => $asset_id,
					'fileName'            => (string) $row['file_name'],
					'mime'                => (string) $row['mime'],
					'bytes'               => (int) $row['bytes'],
					'threadRootMessageId' => Neo_Pulse_App_Chat_Store::activity_thread_root( $message_id ),
				)
			);
		}
	}

	public static function soft_delete_for_message( int $team_id, int $channel_id, int $message_id, int $user_id ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_assets';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE message_id = %d AND deleted_at IS NULL",
				$message_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return;
		}
		$now = current_time( 'mysql', true );
		foreach ( $rows as $row ) {
			$wpdb->update(
				$table,
				array( 'deleted_at' => $now ),
				array( 'id' => (int) $row['id'] ),
				array( '%s' ),
				array( '%d' )
			);
			Neo_Pulse_App_Chat_Activity_Log::append(
				$team_id,
				$channel_id,
				array(
					'kind'      => 'file_removed',
					'channelId' => $channel_id,
					'messageId' => $message_id,
					'userId'    => $user_id,
					'ts'        => gmdate( 'c' ),
					'assetId'   => (int) $row['id'],
					'fileName'  => (string) $row['file_name'],
					'mime'      => (string) $row['mime'],
					'bytes'     => (int) $row['bytes'],
				)
			);
		}
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function delete_asset( int $team_id, int $channel_id, int $asset_id, int $user_id, bool $is_admin ): ?array {
		$row = self::get_row( $asset_id );
		if ( ! $row || (int) $row['team_id'] !== $team_id || (int) $row['channel_id'] !== $channel_id || ! empty( $row['deleted_at'] ) ) {
			return null;
		}
		if ( ! $is_admin && (int) $row['user_id'] !== $user_id ) {
			return null;
		}
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_assets';
		$now   = current_time( 'mysql', true );
		$wpdb->update(
			$table,
			array( 'deleted_at' => $now ),
			array( 'id' => $asset_id ),
			array( '%s' ),
			array( '%d' )
		);
		$message_id = (int) $row['message_id'];
		Neo_Pulse_App_Chat_Activity_Log::append(
			$team_id,
			$channel_id,
			array(
				'kind'                => 'file_removed',
				'channelId'           => $channel_id,
				'messageId'           => $message_id > 0 ? $message_id : 0,
				'userId'              => $user_id,
				'ts'                  => gmdate( 'c' ),
				'assetId'             => $asset_id,
				'fileName'            => (string) $row['file_name'],
				'mime'                => (string) $row['mime'],
				'bytes'               => (int) $row['bytes'],
				'threadRootMessageId' => $message_id > 0 ? Neo_Pulse_App_Chat_Store::activity_thread_root( $message_id ) : 0,
			)
		);
		return array(
			'assetId'  => $asset_id,
			'fileName' => (string) $row['file_name'],
		);
	}

	/**
	 * @param array<int,int> $message_ids
	 * @return array<int,array<int,array<string,mixed>>>
	 */
	public static function get_for_messages( array $message_ids, int $team_id ): array {
		if ( count( $message_ids ) === 0 ) {
			return array();
		}
		global $wpdb;
		$table   = $wpdb->prefix . 'neo_pulse_chat_assets';
		$ids_sql = implode( ',', array_map( 'intval', $message_ids ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND message_id IN ({$ids_sql}) AND deleted_at IS NULL ORDER BY id ASC",
				$team_id
			),
			ARRAY_A
		);
		$out = array();
		if ( ! is_array( $rows ) ) {
			return $out;
		}
		foreach ( $rows as $row ) {
			$mid = (int) $row['message_id'];
			if ( ! isset( $out[ $mid ] ) ) {
				$out[ $mid ] = array();
			}
			$formatted = self::format_asset( $row );
			if ( $formatted ) {
				$out[ $mid ][] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_row( int $asset_id ): ?array {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM ' . $wpdb->prefix . 'neo_pulse_chat_assets WHERE id = %d', $asset_id ),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function serve_download( int $team_id, int $channel_id, int $asset_id, int $user_id ): ?array {
		if ( ! Neo_Pulse_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
			return null;
		}
		$row = self::get_row( $asset_id );
		if ( ! $row || (int) $row['team_id'] !== $team_id || (int) $row['channel_id'] !== $channel_id || ! empty( $row['deleted_at'] ) ) {
			return null;
		}
		$path = Neo_Pulse_App_Data_Paths::root() . '/' . ltrim( (string) $row['storage_path'], '/' );
		if ( ! is_readable( $path ) ) {
			return null;
		}
		return array(
			'path'      => $path,
			'file_name' => (string) $row['file_name'],
			'mime'      => (string) $row['mime'],
		);
	}

	public static function download_url( int $team_id, int $channel_id, int $asset_id ): string {
		return rest_url( 'neo-pulse-app/v1/teams/' . $team_id . '/chat/channels/' . $channel_id . '/files/' . $asset_id );
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function format_asset( ?array $row ): ?array {
		if ( ! $row || ! empty( $row['deleted_at'] ) ) {
			return null;
		}
		$team_id    = (int) $row['team_id'];
		$channel_id = (int) $row['channel_id'];
		$asset_id   = (int) $row['id'];
		return array(
			'id'       => $asset_id,
			'fileName' => (string) $row['file_name'],
			'mime'     => (string) $row['mime'],
			'bytes'    => (int) $row['bytes'],
			'url'      => '/api/teams/' . $team_id . '/chat/channels/' . $channel_id . '/files/' . $asset_id,
		);
	}
}
