<?php
/**
 * @mention persistence and inbox for team chat.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Chat_Mentions {

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$table   = $wpdb->prefix . 'neo_pulse_chat_mentions';

		dbDelta(
			"CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				channel_id bigint(20) unsigned NOT NULL,
				message_id bigint(20) unsigned NOT NULL,
				mentioned_user_id bigint(20) unsigned NOT NULL,
				author_user_id bigint(20) unsigned NOT NULL,
				thread_root_id bigint(20) unsigned DEFAULT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				read_at datetime DEFAULT NULL,
				PRIMARY KEY (id),
				KEY mentioned_user (mentioned_user_id, read_at),
				KEY message_id (message_id),
				KEY team_mentioned (team_id, mentioned_user_id)
			) {$charset};"
		);
	}

	/**
	 * Preserve TipTap mention spans in chat message HTML.
	 */
	public static function sanitize_chat_body_html( string $html ): string {
		$allowed = wp_kses_allowed_html( 'post' );
		if ( ! isset( $allowed['span'] ) || ! is_array( $allowed['span'] ) ) {
			$allowed['span'] = array();
		}
		$allowed['span']['class']       = true;
		$allowed['span']['data-type']   = true;
		$allowed['span']['data-id']     = true;
		$allowed['span']['data-label']  = true;
		return wp_kses( $html, $allowed );
	}

	/**
	 * @param array<int,int> $mentioned_user_ids
	 */
	public static function sync_for_message(
		int $message_id,
		int $channel_id,
		int $team_id,
		int $author_user_id,
		array $mentioned_user_ids,
		?int $thread_root_id = null
	): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_mentions';

		$wpdb->delete( $table, array( 'message_id' => $message_id ), array( '%d' ) );

		$ids = array_values( array_unique( array_filter( array_map( 'intval', $mentioned_user_ids ) ) ) );
		if ( count( $ids ) === 0 ) {
			return;
		}

		$now = current_time( 'mysql', true );
		foreach ( $ids as $uid ) {
			if ( $uid <= 0 || $uid === $author_user_id ) {
				continue;
			}
			if ( ! Neo_Pulse_App_Teams_Store::get_membership( $team_id, $uid ) ) {
				continue;
			}
			if ( ! Neo_Pulse_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $uid ) ) {
				continue;
			}
			$row_data = array(
				'team_id'           => $team_id,
				'channel_id'        => $channel_id,
				'message_id'        => $message_id,
				'mentioned_user_id' => $uid,
				'author_user_id'    => $author_user_id,
				'created_at'        => $now,
			);
			$formats = array( '%d', '%d', '%d', '%d', '%d', '%s' );
			if ( $thread_root_id ) {
				$row_data['thread_root_id'] = $thread_root_id;
				array_splice( $formats, 5, 0, array( '%d' ) );
			}
			$wpdb->insert( $table, $row_data, $formats );
			if ( class_exists( 'Neo_Pulse_App_Push_Events' ) ) {
				$channel = Neo_Pulse_App_Chat_Store::get_channel( $channel_id );
				$message = $wpdb->get_row(
					$wpdb->prepare(
						'SELECT body_plain FROM ' . $wpdb->prefix . 'neo_pulse_chat_messages WHERE id = %d',
						$message_id
					),
					ARRAY_A
				);
				$author = Neo_Pulse_App_Teams_Store::get_user_by_id( $author_user_id );
				Neo_Pulse_App_Push_Events::on_mention_created(
					$team_id,
					$channel_id,
					$message_id,
					$uid,
					$author_user_id,
					$thread_root_id,
					is_array( $message ) ? (string) ( $message['body_plain'] ?? '' ) : '',
					is_array( $channel ) ? (string) ( $channel['name'] ?? $channel['slug'] ?? 'Channel' ) : 'Channel',
					$author ? (string) ( $author['display_name'] ?? '' ) : ''
				);
			}
		}
	}

	public static function purge_for_message( int $message_id ): void {
		global $wpdb;
		$wpdb->delete(
			$wpdb->prefix . 'neo_pulse_chat_mentions',
			array( 'message_id' => $message_id ),
			array( '%d' )
		);
	}

	public static function count_unread( int $team_id, int $user_id ): int {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_mentions';
		$count = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} m
				INNER JOIN {$wpdb->prefix}neo_pulse_chat_messages msg ON msg.id = m.message_id AND msg.deleted_at IS NULL
				WHERE m.team_id = %d AND m.mentioned_user_id = %d AND m.read_at IS NULL",
				$team_id,
				$user_id
			)
		);
		return (int) $count;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_for_user( int $team_id, int $user_id, int $limit = 50, bool $unread_only = false ): array {
		global $wpdb;
		$table    = $wpdb->prefix . 'neo_pulse_chat_mentions';
		$messages = $wpdb->prefix . 'neo_pulse_chat_messages';
		$limit    = max( 1, min( 100, $limit ) );

		$where = "m.team_id = %d AND m.mentioned_user_id = %d AND msg.deleted_at IS NULL";
		if ( $unread_only ) {
			$where .= ' AND m.read_at IS NULL';
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT m.*, msg.body_plain, msg.created_at AS msg_created_at
				FROM {$table} m
				INNER JOIN {$messages} msg ON msg.id = m.message_id
				WHERE {$where}
				ORDER BY m.created_at DESC
				LIMIT %d",
				$team_id,
				$user_id,
				$limit
			),
			ARRAY_A
		);

		if ( ! is_array( $rows ) ) {
			return array();
		}

		$out = array();
		foreach ( $rows as $row ) {
			$channel_id = (int) $row['channel_id'];
			$channel    = Neo_Pulse_App_Chat_Store::get_channel( $channel_id );
			if ( ! $channel ) {
				continue;
			}
			$label = self::channel_label( $channel, $user_id, $team_id );
			if ( ! empty( $row['thread_root_id'] ) ) {
				$label .= ' · thread';
			}
			$author = Neo_Pulse_App_Teams_Store::get_user_by_id( (int) $row['author_user_id'] );
			$preview = (string) ( $row['body_plain'] ?? '' );
			if ( strlen( $preview ) > 120 ) {
				$preview = substr( $preview, 0, 117 ) . '...';
			}
			$out[] = array(
				'id'                => (int) $row['id'],
				'messageId'         => (int) $row['message_id'],
				'channelId'         => $channel_id,
				'threadRootId'      => ! empty( $row['thread_root_id'] ) ? (int) $row['thread_root_id'] : null,
				'authorDisplayName' => $author ? (string) $author['display_name'] : 'User',
				'channelLabel'      => $label,
				'preview'           => $preview,
				'createdAt'         => gmdate( 'c', strtotime( (string) $row['created_at'] ) ),
				'readAt'            => ! empty( $row['read_at'] ) ? gmdate( 'c', strtotime( (string) $row['read_at'] ) ) : null,
			);
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $channel
	 */
	private static function channel_label( array $channel, int $user_id, int $team_id ): string {
		$formatted = Neo_Pulse_App_Chat_Store::format_channel_payload( $channel, $user_id, $team_id );
		$type      = (string) ( $formatted['type'] ?? '' );
		if ( $type === 'dm' ) {
			return (string) ( $formatted['name'] ?? 'Direct message' );
		}
		$slug = (string) ( $formatted['slug'] ?? '' );
		$name = (string) ( $formatted['name'] ?? '' );
		$raw  = $slug !== '' ? $slug : $name;
		return $raw !== '' ? '#' . $raw : 'Channel';
	}

	public static function mark_read_for_message( int $user_id, int $message_id ): void {
		global $wpdb;
		$wpdb->update(
			$wpdb->prefix . 'neo_pulse_chat_mentions',
			array( 'read_at' => current_time( 'mysql', true ) ),
			array(
				'mentioned_user_id' => $user_id,
				'message_id'        => $message_id,
			),
			array( '%s' ),
			array( '%d', '%d' )
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<int,int>
	 */
	public static function parse_mentioned_user_ids_from_body( array $body ): array {
		$out = array();
		if ( ! isset( $body['mentionedUserIds'] ) || ! is_array( $body['mentionedUserIds'] ) ) {
			return $out;
		}
		foreach ( $body['mentionedUserIds'] as $id ) {
			$id = (int) $id;
			if ( $id > 0 ) {
				$out[] = $id;
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<int,int>
	 */
	public static function merge_mentioned_user_ids_from_body( array $body ): array {
		$ids = self::parse_mentioned_user_ids_from_body( $body );
		$html = isset( $body['bodyHtml'] ) ? (string) $body['bodyHtml'] : '';
		if ( $html !== '' ) {
			$ids = array_merge( $ids, self::parse_mentioned_user_ids_from_html( $html ) );
		}
		return array_values( array_unique( array_filter( array_map( 'intval', $ids ) ) ) );
	}

	/**
	 * @return array<int,int>
	 */
	public static function parse_mentioned_user_ids_from_html( string $html ): array {
		if ( $html === '' ) {
			return array();
		}
		$ids = array();
		if ( preg_match_all( '/data-type="mention"[^>]*data-id="(\d+)"|data-id="(\d+)"[^>]*data-type="mention"/', $html, $matches, PREG_SET_ORDER ) ) {
			foreach ( $matches as $match ) {
				$id = (int) ( $match[1] !== '' ? $match[1] : $match[2] );
				if ( $id > 0 ) {
					$ids[] = $id;
				}
			}
		}
		return array_values( array_unique( $ids ) );
	}
}
