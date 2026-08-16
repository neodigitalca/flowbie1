<?php
/**
 * Chat activity log (minified JSON, kind key first).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Chat_Activity_Log {

	private const KINDS = array( 'link_shared', 'file_shared', 'file_removed', 'link_removed' );

	/**
	 * @param array<string,mixed> $payload
	 */
	public static function append( int $team_id, int $channel_id, array $payload ): ?int {
		global $wpdb;
		$kind = isset( $payload['kind'] ) ? (string) $payload['kind'] : '';
		if ( ! in_array( $kind, self::KINDS, true ) ) {
			return null;
		}

		$ordered = array( 'kind' => $kind );
		foreach ( $payload as $key => $value ) {
			if ( $key === 'kind' ) {
				continue;
			}
			$ordered[ $key ] = $value;
		}

		$json = wp_json_encode( $ordered, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		if ( ! is_string( $json ) || $json === '' ) {
			return null;
		}

		$table = $wpdb->prefix . 'neo_pulse_chat_activity_log';
		$wpdb->insert(
			$table,
			array(
				'team_id'      => $team_id,
				'channel_id'   => $channel_id,
				'payload_json' => $json,
			),
			array( '%d', '%d', '%s' )
		);
		return (int) $wpdb->insert_id > 0 ? (int) $wpdb->insert_id : null;
	}

	/**
	 * @param array<string,mixed> $filters
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_for_channel( int $team_id, int $channel_id, array $filters ): array {
		global $wpdb;
		$table  = $wpdb->prefix . 'neo_pulse_chat_activity_log';
		$limit  = isset( $filters['limit'] ) ? max( 1, min( 100, (int) $filters['limit'] ) ) : 50;
		$after  = isset( $filters['after'] ) ? (int) $filters['after'] : 0;
		$user_id = isset( $filters['userId'] ) ? (int) $filters['userId'] : 0;
		$kind   = isset( $filters['kind'] ) ? sanitize_text_field( (string) $filters['kind'] ) : '';

		$sql    = "SELECT id, payload_json, created_at FROM {$table} WHERE team_id = %d AND channel_id = %d";
		$params = array( $team_id, $channel_id );
		if ( $after > 0 ) {
			$sql     .= ' AND id > %d';
			$params[] = $after;
		}
		$sql     .= ' ORDER BY id DESC LIMIT %d';
		$params[] = $limit;

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A );
		if ( ! is_array( $rows ) ) {
			return array();
		}

		$out = array();
		foreach ( $rows as $row ) {
			$entry = self::format_row( $row );
			if ( ! $entry ) {
				continue;
			}
			if ( $kind !== '' && ( $entry['kind'] ?? '' ) !== $kind ) {
				continue;
			}
			if ( $user_id > 0 && (int) ( $entry['userId'] ?? 0 ) !== $user_id ) {
				continue;
			}
			if ( ! self::should_include_shared_entry( $entry ) ) {
				continue;
			}
			$out[] = $entry;
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function format_row( array $row ): ?array {
		$decoded = json_decode( (string) ( $row['payload_json'] ?? '' ), true );
		if ( ! is_array( $decoded ) || empty( $decoded['kind'] ) ) {
			return null;
		}
		$decoded['id']        = (int) $row['id'];
		$decoded['createdAt'] = gmdate( 'c', strtotime( (string) $row['created_at'] ) );
		return $decoded;
	}

	/**
	 * @param array<string,mixed> $filters
	 * @return array<int,array<string,mixed>>
	 */
	public static function search_shared( int $team_id, int $user_id, array $filters ): array {
		global $wpdb;
		$table    = $wpdb->prefix . 'neo_pulse_chat_activity_log';
		$limit    = isset( $filters['limit'] ) ? max( 1, min( 100, (int) $filters['limit'] ) ) : 50;
		$after    = isset( $filters['after'] ) ? (int) $filters['after'] : 0;
		$q        = isset( $filters['q'] ) ? trim( (string) $filters['q'] ) : '';
		$channel  = isset( $filters['channelId'] ) ? (int) $filters['channelId'] : 0;
		$filter_user = isset( $filters['userId'] ) ? (int) $filters['userId'] : 0;
		$kind     = isset( $filters['kind'] ) ? sanitize_text_field( (string) $filters['kind'] ) : '';
		$scope    = isset( $filters['scope'] ) ? (string) $filters['scope'] : 'all';
		$thread_root = isset( $filters['threadRootMessageId'] ) ? (int) $filters['threadRootMessageId'] : 0;

		$sql    = "SELECT id, channel_id, payload_json, created_at FROM {$table} WHERE team_id = %d";
		$params = array( $team_id );
		if ( $channel > 0 ) {
			if ( ! Neo_Pulse_App_Chat_Store::user_can_access_channel( $channel, $team_id, $user_id ) ) {
				return array();
			}
			$sql     .= ' AND channel_id = %d';
			$params[] = $channel;
		}
		if ( $after > 0 ) {
			$sql     .= ' AND id > %d';
			$params[] = $after;
		}
		$sql     .= ' ORDER BY id DESC LIMIT %d';
		$params[] = $limit * 4;

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A );
		if ( ! is_array( $rows ) ) {
			return array();
		}

		$needle = strtolower( $q );
		$out    = array();
		foreach ( $rows as $row ) {
			if ( count( $out ) >= $limit ) {
				break;
			}
			$channel_id = (int) $row['channel_id'];
			if ( $channel <= 0 && ! Neo_Pulse_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				continue;
			}
			$entry = self::format_row( $row );
			if ( ! $entry ) {
				continue;
			}
			$entry['channelId'] = $channel_id;
			if ( $kind !== '' && ( $entry['kind'] ?? '' ) !== $kind ) {
				continue;
			}
			if ( $filter_user > 0 && (int) ( $entry['userId'] ?? 0 ) !== $filter_user ) {
				continue;
			}
			$thread_id = isset( $entry['threadRootMessageId'] ) ? (int) $entry['threadRootMessageId'] : 0;
			if ( $scope === 'channel' && $thread_id > 0 ) {
				continue;
			}
			if ( $scope === 'thread' && $thread_id <= 0 ) {
				continue;
			}
			if ( $thread_root > 0 && $thread_id !== $thread_root ) {
				continue;
			}
			if ( $needle !== '' && ! self::entry_matches_query( $entry, $needle ) ) {
				continue;
			}
			if ( ! self::should_include_shared_entry( $entry ) ) {
				continue;
			}
			$channel_row = Neo_Pulse_App_Chat_Store::get_channel( $channel_id );
			if ( $channel_row ) {
				$formatted = Neo_Pulse_App_Chat_Store::format_channel_payload( $channel_row, $user_id, $team_id );
				$entry['channelName'] = (string) ( $formatted['slug'] ?? $formatted['name'] ?? '' );
			}
			$sharer = Neo_Pulse_App_Teams_Store::get_user_by_id( (int) ( $entry['userId'] ?? 0 ) );
			$entry['sharerDisplayName'] = $sharer ? (string) $sharer['display_name'] : 'Unknown';
			if ( $thread_id > 0 ) {
				$root_msg = Neo_Pulse_App_Chat_Store::get_message( $thread_id );
				if ( $root_msg ) {
					$plain = (string) ( $root_msg['body_plain'] ?? '' );
					$entry['threadPreviewPlain'] = strlen( $plain ) > 80 ? substr( $plain, 0, 77 ) . '...' : $plain;
				}
			}
			$out[] = $entry;
		}
		return $out;
	}

	public static function purge_shared_for_message( int $team_id, int $channel_id, int $message_id, int $user_id ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_activity_log';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, payload_json FROM {$table} WHERE team_id = %d AND channel_id = %d ORDER BY id DESC LIMIT 500",
				$team_id,
				$channel_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return;
		}
		foreach ( $rows as $row ) {
			$entry = self::format_row( $row );
			if ( ! $entry || ( $entry['kind'] ?? '' ) !== 'link_shared' ) {
				continue;
			}
			if ( (int) ( $entry['messageId'] ?? 0 ) !== $message_id ) {
				continue;
			}
			self::append(
				$team_id,
				$channel_id,
				array(
					'kind'                => 'link_removed',
					'channelId'           => $channel_id,
					'messageId'           => $message_id,
					'userId'              => $user_id,
					'ts'                  => gmdate( 'c' ),
					'url'                 => (string) ( $entry['url'] ?? '' ),
					'previewId'           => isset( $entry['previewId'] ) ? (int) $entry['previewId'] : 0,
					'threadRootMessageId' => isset( $entry['threadRootMessageId'] ) ? (int) $entry['threadRootMessageId'] : 0,
				)
			);
		}
	}

	/**
	 * @param array<string,mixed> $entry
	 */
	private static function should_include_shared_entry( array $entry ): bool {
		$kind = (string) ( $entry['kind'] ?? '' );
		if ( $kind === 'file_removed' || $kind === 'link_removed' ) {
			return false;
		}
		if ( $kind !== 'link_shared' && $kind !== 'file_shared' ) {
			return true;
		}
		$message_id = isset( $entry['messageId'] ) ? (int) $entry['messageId'] : 0;
		if ( ! self::entry_message_alive( $message_id ) ) {
			return false;
		}
		if ( $kind === 'file_shared' ) {
			$asset_id = isset( $entry['assetId'] ) ? (int) $entry['assetId'] : 0;
			if ( $asset_id > 0 ) {
				$asset = Neo_Pulse_App_Chat_Assets::get_row( $asset_id );
				if ( ! $asset || ! empty( $asset['deleted_at'] ) ) {
					return false;
				}
			}
		}
		return true;
	}

	private static function entry_message_alive( int $message_id ): bool {
		if ( $message_id <= 0 ) {
			return false;
		}
		$row = Neo_Pulse_App_Chat_Store::get_message( $message_id );
		return is_array( $row ) && empty( $row['deleted_at'] );
	}

	/**
	 * @param array<string,mixed> $entry
	 */
	private static function entry_matches_query( array $entry, string $needle ): bool {
		$parts = array(
			(string) ( $entry['url'] ?? '' ),
			(string) ( $entry['fileName'] ?? '' ),
			(string) ( $entry['previewTitle'] ?? '' ),
		);
		foreach ( $parts as $part ) {
			if ( $part !== '' && strpos( strtolower( $part ), $needle ) !== false ) {
				return true;
			}
		}
		return false;
	}
}
