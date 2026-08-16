<?php
/**
 * Team chat DB schema and data access.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Chat_Store {

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset  = $wpdb->get_charset_collate();
		$channels = $wpdb->prefix . 'neo_pulse_chat_channels';
		$members  = $wpdb->prefix . 'neo_pulse_chat_channel_members';
		$messages = $wpdb->prefix . 'neo_pulse_chat_messages';
		$read     = $wpdb->prefix . 'neo_pulse_chat_read_state';

		dbDelta(
			"CREATE TABLE {$channels} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				type varchar(16) NOT NULL DEFAULT 'public',
				name varchar(255) DEFAULT NULL,
				slug varchar(255) DEFAULT NULL,
				created_by bigint(20) unsigned NOT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				archived_at datetime DEFAULT NULL,
				topic text DEFAULT NULL,
				PRIMARY KEY (id),
				KEY team_id (team_id),
				KEY team_slug (team_id, slug)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$members} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				channel_id bigint(20) unsigned NOT NULL,
				user_id bigint(20) unsigned NOT NULL,
				role varchar(16) NOT NULL DEFAULT 'member',
				joined_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				UNIQUE KEY channel_user (channel_id, user_id),
				KEY user_id (user_id)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$messages} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				channel_id bigint(20) unsigned NOT NULL,
				user_id bigint(20) unsigned NOT NULL,
				body_html longtext NOT NULL,
				body_plain longtext NOT NULL,
				parent_message_id bigint(20) unsigned DEFAULT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				edited_at datetime DEFAULT NULL,
				deleted_at datetime DEFAULT NULL,
				PRIMARY KEY (id),
				KEY channel_created (channel_id, created_at),
				KEY channel_id (channel_id)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$read} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				user_id bigint(20) unsigned NOT NULL,
				channel_id bigint(20) unsigned NOT NULL,
				last_read_message_id bigint(20) unsigned NOT NULL DEFAULT 0,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				UNIQUE KEY user_channel (user_id, channel_id)
			) {$charset};"
		);

		$assets = $wpdb->prefix . 'neo_pulse_chat_assets';
		$previews = $wpdb->prefix . 'neo_pulse_chat_link_previews';
		$activity = $wpdb->prefix . 'neo_pulse_chat_activity_log';

		dbDelta(
			"CREATE TABLE {$assets} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				channel_id bigint(20) unsigned NOT NULL,
				message_id bigint(20) unsigned NOT NULL DEFAULT 0,
				user_id bigint(20) unsigned NOT NULL,
				file_name varchar(255) NOT NULL,
				mime varchar(128) NOT NULL,
				bytes bigint(20) unsigned NOT NULL DEFAULT 0,
				storage_path varchar(512) NOT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				deleted_at datetime DEFAULT NULL,
				PRIMARY KEY (id),
				KEY team_channel (team_id, channel_id),
				KEY message_id (message_id)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$previews} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				message_id bigint(20) unsigned NOT NULL,
				url varchar(2048) NOT NULL,
				title varchar(512) DEFAULT NULL,
				description text DEFAULT NULL,
				image_url varchar(2048) DEFAULT NULL,
				site_name varchar(255) DEFAULT NULL,
				fetched_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY message_id (message_id)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$activity} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				channel_id bigint(20) unsigned NOT NULL,
				payload_json text NOT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY team_channel_created (team_id, channel_id, created_at)
			) {$charset};"
		);

		$thread_read = $wpdb->prefix . 'neo_pulse_chat_thread_read_state';
		dbDelta(
			"CREATE TABLE {$thread_read} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				user_id bigint(20) unsigned NOT NULL,
				channel_id bigint(20) unsigned NOT NULL,
				thread_root_id bigint(20) unsigned NOT NULL,
				last_read_message_id bigint(20) unsigned NOT NULL DEFAULT 0,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				UNIQUE KEY user_channel_thread (user_id, channel_id, thread_root_id)
			) {$charset};"
		);

		Neo_Pulse_App_Chat_Typing::install_table();
		Neo_Pulse_App_Chat_Calls::install_tables();
		Neo_Pulse_App_Chat_Mentions::install_tables();
		Neo_Pulse_App_Chat_Preferences::install_tables();
	}

	public static function ensure_default_channels( int $team_id, int $creator_user_id ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_channels';
		$count = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE team_id = %d AND archived_at IS NULL", $team_id )
		);
		if ( $count > 0 ) {
			return;
		}
		self::create_channel( $team_id, $creator_user_id, 'public', 'general', 'general', array() );
		self::create_channel( $team_id, $creator_user_id, 'public', 'random', 'random', array() );
	}

	/**
	 * @param array<int,int> $member_user_ids
	 * @return array<string,mixed>|null
	 */
	public static function create_channel(
		int $team_id,
		int $creator_user_id,
		string $type,
		string $name,
		string $slug,
		array $member_user_ids
	): ?array {
		global $wpdb;
		$channels = $wpdb->prefix . 'neo_pulse_chat_channels';
		$members  = $wpdb->prefix . 'neo_pulse_chat_channel_members';

		$wpdb->insert(
			$channels,
			array(
				'team_id'    => $team_id,
				'type'       => $type,
				'name'       => $name !== '' ? $name : null,
				'slug'       => $slug !== '' ? $slug : null,
				'created_by' => $creator_user_id,
			),
			array( '%d', '%s', '%s', '%s', '%d' )
		);
		$channel_id = (int) $wpdb->insert_id;
		if ( $channel_id <= 0 ) {
			return null;
		}

		$member_ids = array_unique( array_merge( array( $creator_user_id ), $member_user_ids ) );
		foreach ( $member_ids as $uid ) {
			$wpdb->insert(
				$members,
				array(
					'channel_id' => $channel_id,
					'user_id'      => (int) $uid,
					'role'         => (int) $uid === $creator_user_id ? 'admin' : 'member',
				),
				array( '%d', '%d', '%s' )
			);
		}

		return self::get_channel( $channel_id );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_channel( int $channel_id ): ?array {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM ' . $wpdb->prefix . 'neo_pulse_chat_channels WHERE id = %d', $channel_id ),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	public static function user_can_access_channel( int $channel_id, int $team_id, int $user_id ): bool {
		$channel = self::get_channel( $channel_id );
		if ( ! $channel || (int) $channel['team_id'] !== $team_id || ! empty( $channel['archived_at'] ) ) {
			return false;
		}
		$type = (string) $channel['type'];
		if ( $type === 'public' ) {
			return Neo_Pulse_App_Teams_Store::get_membership( $team_id, $user_id ) !== null;
		}
		global $wpdb;
		$exists = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . $wpdb->prefix . 'neo_pulse_chat_channel_members WHERE channel_id = %d AND user_id = %d',
				$channel_id,
				$user_id
			)
		);
		return (bool) $exists;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_or_create_dm( int $team_id, int $user_id, int $other_user_id ): ?array {
		if ( $user_id === $other_user_id ) {
			return null;
		}
		if ( ! Neo_Pulse_App_Teams_Store::get_membership( $team_id, $other_user_id ) ) {
			return null;
		}

		global $wpdb;
		$channels = $wpdb->prefix . 'neo_pulse_chat_channels';
		$members  = $wpdb->prefix . 'neo_pulse_chat_channel_members';

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT c.id FROM {$channels} c
				INNER JOIN {$members} m1 ON m1.channel_id = c.id AND m1.user_id = %d
				INNER JOIN {$members} m2 ON m2.channel_id = c.id AND m2.user_id = %d
				WHERE c.team_id = %d AND c.type = 'dm' AND c.archived_at IS NULL
				LIMIT 1",
				$user_id,
				$other_user_id,
				$team_id
			),
			ARRAY_A
		);
		if ( is_array( $rows ) && count( $rows ) > 0 ) {
			return self::get_channel( (int) $rows[0]['id'] );
		}

		return self::create_channel( $team_id, $user_id, 'dm', '', '', array( $other_user_id ) );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_channels_for_user( int $team_id, int $user_id ): array {
		global $wpdb;
		$channels = $wpdb->prefix . 'neo_pulse_chat_channels';
		$members  = $wpdb->prefix . 'neo_pulse_chat_channel_members';

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT c.* FROM {$channels} c
				LEFT JOIN {$members} m ON m.channel_id = c.id AND m.user_id = %d
				WHERE c.team_id = %d AND c.archived_at IS NULL
				AND (c.type = 'public' OR m.id IS NOT NULL)
				ORDER BY c.type ASC, c.name ASC",
				$user_id,
				$team_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}

		$out = array();
		foreach ( $rows as $row ) {
			$out[] = self::format_channel_payload( $row, $user_id, $team_id );
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>
	 */
	public static function format_channel_payload( array $row, int $user_id, int $team_id ): array {
		$channel_id = (int) $row['id'];
		$type       = (string) $row['type'];
		$name       = (string) ( $row['name'] ?? '' );
		$slug       = (string) ( $row['slug'] ?? '' );
		$dm_user_id = null;
		$dm_label   = $name;

		if ( $type === 'dm' ) {
			global $wpdb;
			$other = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT user_id FROM ' . $wpdb->prefix . 'neo_pulse_chat_channel_members WHERE channel_id = %d AND user_id != %d LIMIT 1',
					$channel_id,
					$user_id
				)
			);
			if ( $other ) {
				$dm_user_id = (int) $other;
				$user       = Neo_Pulse_App_Teams_Store::get_user_by_id( $dm_user_id );
				$dm_label   = $user ? (string) $user['display_name'] : 'Direct message';
			}
		}

		$last_msg           = self::get_last_message( $channel_id );
		$unread             = self::count_unread( $channel_id, $user_id );
		$thread_unread      = self::count_thread_unread( $channel_id, $user_id );
		$topic              = isset( $row['topic'] ) ? (string) $row['topic'] : '';

		return array(
			'id'                   => $channel_id,
			'teamId'               => $team_id,
			'type'                 => $type,
			'name'                 => $type === 'dm' ? $dm_label : $name,
			'slug'                 => $slug !== '' ? $slug : null,
			'topic'                => $topic !== '' ? $topic : null,
			'dmUserId'             => $dm_user_id,
			'createdBy'            => (int) $row['created_by'],
			'createdAt'            => gmdate( 'c', strtotime( (string) $row['created_at'] ) ),
			'unreadCount'          => $unread,
			'threadUnreadCount'    => $thread_unread,
			'lastMessageAt'        => $last_msg ? gmdate( 'c', strtotime( (string) $last_msg['created_at'] ) ) : null,
			'lastMessagePreview'   => $last_msg ? self::preview_plain( (string) $last_msg['body_plain'] ) : null,
		);
	}

	private static function preview_plain( string $plain ): string {
		$plain = trim( preg_replace( '/\s+/', ' ', $plain ) );
		if ( strlen( $plain ) <= 80 ) {
			return $plain;
		}
		return substr( $plain, 0, 77 ) . '...';
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function get_last_message( int $channel_id ): ?array {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . $wpdb->prefix . 'neo_pulse_chat_messages WHERE channel_id = %d AND deleted_at IS NULL ORDER BY id DESC LIMIT 1',
				$channel_id
			),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	public static function count_unread( int $channel_id, int $user_id ): int {
		global $wpdb;
		$read_table = $wpdb->prefix . 'neo_pulse_chat_read_state';
		$msg_table  = $wpdb->prefix . 'neo_pulse_chat_messages';
		$last_id    = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT last_read_message_id FROM {$read_table} WHERE user_id = %d AND channel_id = %d",
				$user_id,
				$channel_id
			)
		);
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$msg_table} WHERE channel_id = %d AND id > %d AND deleted_at IS NULL AND user_id != %d AND parent_message_id IS NULL",
				$channel_id,
				$last_id,
				$user_id
			)
		);
	}

	public static function mark_read( int $channel_id, int $user_id, int $message_id ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_read_state';
		$existing = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$table} WHERE user_id = %d AND channel_id = %d",
				$user_id,
				$channel_id
			)
		);
		$now = current_time( 'mysql', true );
		if ( $existing ) {
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$table} SET last_read_message_id = GREATEST(last_read_message_id, %d), updated_at = %s WHERE user_id = %d AND channel_id = %d",
					$message_id,
					$now,
					$user_id,
					$channel_id
				)
			);
		} else {
			$wpdb->insert(
				$table,
				array(
					'user_id'               => $user_id,
					'channel_id'            => $channel_id,
					'last_read_message_id'  => $message_id,
					'updated_at'            => $now,
				),
				array( '%d', '%d', '%d', '%s' )
			);
		}
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_messages(
		int $channel_id,
		int $after_id,
		int $before_id,
		int $limit,
		string $scope = 'channel',
		int $parent_id = 0
	): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_messages';
		$limit = max( 1, min( 100, $limit ) );
		$scope = $scope === 'thread' ? 'thread' : 'channel';

		$scope_sql = '';
		$scope_params = array();
		if ( $scope === 'channel' ) {
			$scope_sql = ' AND parent_message_id IS NULL';
		} elseif ( $parent_id > 0 ) {
			$scope_sql = ' AND (id = %d OR parent_message_id = %d)';
			$scope_params = array( $parent_id, $parent_id );
		}

		if ( $after_id > 0 ) {
			$sql = "SELECT * FROM {$table} WHERE channel_id = %d AND id > %d AND deleted_at IS NULL{$scope_sql} ORDER BY id ASC LIMIT %d";
			$params = array_merge( array( $channel_id, $after_id ), $scope_params, array( $limit ) );
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A );
		} elseif ( $before_id > 0 ) {
			$sql = "SELECT * FROM {$table} WHERE channel_id = %d AND id < %d AND deleted_at IS NULL{$scope_sql} ORDER BY id DESC LIMIT %d";
			$params = array_merge( array( $channel_id, $before_id ), $scope_params, array( $limit ) );
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A );
			if ( is_array( $rows ) ) {
				$rows = array_reverse( $rows );
			}
		} else {
			$sql = "SELECT * FROM {$table} WHERE channel_id = %d AND deleted_at IS NULL{$scope_sql} ORDER BY id DESC LIMIT %d";
			$params = array_merge( array( $channel_id ), $scope_params, array( $limit ) );
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A );
			if ( is_array( $rows ) ) {
				$rows = array_reverse( $rows );
			}
		}

		if ( ! is_array( $rows ) ) {
			return array();
		}
		$message_ids = array_map(
			static function ( $row ) {
				return (int) $row['id'];
			},
			$rows
		);
		$channel     = self::get_channel( $channel_id );
		$team_id     = $channel ? (int) $channel['team_id'] : 0;
		$attachments = $team_id > 0 ? Neo_Pulse_App_Chat_Assets::get_for_messages( $message_ids, $team_id ) : array();
		$previews    = Neo_Pulse_App_Chat_Link_Unfurl::get_for_messages( $message_ids );

		$thread_stats = array();
		if ( $scope === 'channel' ) {
			$thread_stats = self::thread_stats_for_channel( $channel_id );
		}

		$out = array();
		foreach ( $rows as $row ) {
			$mid       = (int) $row['id'];
			$formatted = self::format_message_payload( $row );
			$formatted['linkPreviews'] = $previews[ $mid ] ?? array();
			$formatted['attachments']  = $attachments[ $mid ] ?? array();
			if ( $scope === 'channel' && empty( $row['parent_message_id'] ) && isset( $thread_stats[ $mid ] ) ) {
				$formatted['threadReplyCount']    = (int) $thread_stats[ $mid ]['count'];
				$formatted['threadLastReplyAt']   = $thread_stats[ $mid ]['lastAt'];
			}
			$out[] = $formatted;
		}
		return $out;
	}

	/**
	 * @return array<int,array{count:int,lastAt:string|null}>
	 */
	private static function thread_stats_for_channel( int $channel_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_messages';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT parent_message_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
				FROM {$table}
				WHERE channel_id = %d AND parent_message_id IS NOT NULL AND deleted_at IS NULL
				GROUP BY parent_message_id",
				$channel_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$root = (int) $row['parent_message_id'];
			$out[ $root ] = array(
				'count'  => (int) $row['cnt'],
				'lastAt' => ! empty( $row['last_at'] ) ? gmdate( 'c', strtotime( (string) $row['last_at'] ) ) : null,
			);
		}
		return $out;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function search_channel_messages( int $channel_id, string $q, int $limit ): array {
		global $wpdb;
		$q     = trim( $q );
		if ( $q === '' ) {
			return array();
		}
		$table = $wpdb->prefix . 'neo_pulse_chat_messages';
		$limit = max( 1, min( 50, $limit ) );
		$like  = '%' . $wpdb->esc_like( $q ) . '%';
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE channel_id = %d AND deleted_at IS NULL AND parent_message_id IS NULL AND LOWER(body_plain) LIKE LOWER(%s) ORDER BY id DESC LIMIT %d",
				$channel_id,
				$like,
				$limit
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) || count( $rows ) === 0 ) {
			return array();
		}
		$rows = array_reverse( $rows );
		$message_ids = array_map(
			static function ( $row ) {
				return (int) $row['id'];
			},
			$rows
		);
		$channel = self::get_channel( $channel_id );
		$team_id = $channel ? (int) $channel['team_id'] : 0;
		$attachments = $team_id > 0 ? Neo_Pulse_App_Chat_Assets::get_for_messages( $message_ids, $team_id ) : array();
		$previews    = Neo_Pulse_App_Chat_Link_Unfurl::get_for_messages( $message_ids );
		$thread_stats = self::thread_stats_for_channel( $channel_id );
		$out = array();
		foreach ( $rows as $row ) {
			$mid       = (int) $row['id'];
			$formatted = self::format_message_payload( $row );
			$formatted['linkPreviews'] = $previews[ $mid ] ?? array();
			$formatted['attachments']  = $attachments[ $mid ] ?? array();
			if ( isset( $thread_stats[ $mid ] ) ) {
				$formatted['threadReplyCount']   = $thread_stats[ $mid ]['count'];
				$formatted['threadLastReplyAt']  = $thread_stats[ $mid ]['lastAt'];
			}
			$out[] = $formatted;
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>
	 */
	public static function format_message_payload( array $row ): array {
		$user_id = (int) $row['user_id'];
		$user    = Neo_Pulse_App_Teams_Store::get_user_by_id( $user_id );
		return array(
			'id'              => (int) $row['id'],
			'channelId'       => (int) $row['channel_id'],
			'userId'          => $user_id,
			'displayName'     => $user ? (string) $user['display_name'] : 'Unknown',
			'avatarUrl'       => $user ? $user['avatar_url'] : null,
			'bodyHtml'        => (string) $row['body_html'],
			'bodyPlain'       => (string) $row['body_plain'],
			'parentMessageId' => ! empty( $row['parent_message_id'] ) ? (int) $row['parent_message_id'] : null,
			'createdAt'       => gmdate( 'c', strtotime( (string) $row['created_at'] ) ),
			'editedAt'        => ! empty( $row['edited_at'] ) ? gmdate( 'c', strtotime( (string) $row['edited_at'] ) ) : null,
			'deletedAt'       => ! empty( $row['deleted_at'] ) ? gmdate( 'c', strtotime( (string) $row['deleted_at'] ) ) : null,
		);
	}

	public static function html_to_plain( string $html ): string {
		$plain = wp_strip_all_tags( $html );
		$plain = html_entity_decode( $plain, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		return trim( preg_replace( '/\s+/', ' ', $plain ) );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	/**
	 * @param array<int,int> $attachment_asset_ids
	 * @return array<string,mixed>|null
	 */
	public static function create_message(
		int $channel_id,
		int $user_id,
		string $body_html,
		?int $parent_message_id = null,
		array $attachment_asset_ids = array(),
		array $mentioned_user_ids = array()
	): ?array {
		global $wpdb;
		$body_html  = Neo_Pulse_App_Chat_Mentions::sanitize_chat_body_html( $body_html );
		$body_plain = self::html_to_plain( $body_html );
		if ( $body_plain === '' && count( $attachment_asset_ids ) === 0 ) {
			return null;
		}

		$data = array(
			'channel_id' => $channel_id,
			'user_id'    => $user_id,
			'body_html'  => $body_html,
			'body_plain' => $body_plain,
		);
		$formats = array( '%d', '%d', '%s', '%s' );
		if ( $parent_message_id ) {
			$data['parent_message_id'] = $parent_message_id;
			$formats[]                 = '%d';
		}

		$wpdb->insert(
			$wpdb->prefix . 'neo_pulse_chat_messages',
			$data,
			$formats
		);
		$id = (int) $wpdb->insert_id;
		if ( $id <= 0 ) {
			return null;
		}
		if ( $parent_message_id ) {
			self::mark_thread_read( $channel_id, $user_id, $parent_message_id, $id );
		} else {
			self::mark_read( $channel_id, $user_id, $id );
		}
		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM ' . $wpdb->prefix . 'neo_pulse_chat_messages WHERE id = %d', $id ),
			ARRAY_A
		);
		if ( ! is_array( $row ) ) {
			return null;
		}
		$payload = self::format_message_payload( $row );
		self::enrich_message_payload( $payload, $channel_id, $attachment_asset_ids, $user_id, true );
		$channel = self::get_channel( $channel_id );
		if ( $channel ) {
			Neo_Pulse_App_Chat_Mentions::sync_for_message(
				$id,
				$channel_id,
				(int) $channel['team_id'],
				$user_id,
				$mentioned_user_ids,
				$parent_message_id ?: null
			);
			if ( class_exists( 'Neo_Pulse_App_Push_Events' ) ) {
				Neo_Pulse_App_Push_Events::on_message_created(
					$payload,
					$channel,
					$user_id,
					$parent_message_id ?: null
				);
			}
		}
		return $payload;
	}

	/**
	 * @param array<string,mixed>   $payload
	 * @param array<int,int>        $attachment_asset_ids
	 */
	private static function enrich_message_payload(
		array &$payload,
		int $channel_id,
		array $attachment_asset_ids,
		int $user_id,
		bool $is_new
	): void {
		$channel = self::get_channel( $channel_id );
		if ( ! $channel ) {
			return;
		}
		$team_id    = (int) $channel['team_id'];
		$message_id = (int) $payload['id'];

		if ( count( $attachment_asset_ids ) > 0 ) {
			Neo_Pulse_App_Chat_Assets::link_to_message( $team_id, $channel_id, $message_id, $user_id, $attachment_asset_ids );
		}
		if ( $is_new || ! empty( $payload['bodyHtml'] ) ) {
			Neo_Pulse_App_Chat_Link_Unfurl::process_message( $message_id, (string) $payload['bodyHtml'], $channel_id, $team_id, $user_id );
		}

		$attachments = Neo_Pulse_App_Chat_Assets::get_for_messages( array( $message_id ), $team_id );
		$previews    = Neo_Pulse_App_Chat_Link_Unfurl::get_for_messages( array( $message_id ) );
		$payload['attachments']  = $attachments[ $message_id ] ?? array();
		$payload['linkPreviews'] = $previews[ $message_id ] ?? array();
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_message( int $message_id ): ?array {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM ' . $wpdb->prefix . 'neo_pulse_chat_messages WHERE id = %d', $message_id ),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	/**
	 * @param array<int,int> $attachment_asset_ids
	 * @return array<string,mixed>|null
	 */
	public static function edit_message(
		int $message_id,
		int $user_id,
		string $body_html,
		array $attachment_asset_ids = array(),
		array $mentioned_user_ids = array()
	): ?array {
		global $wpdb;
		$row = self::get_message( $message_id );
		if ( ! $row || ! empty( $row['deleted_at'] ) || (int) $row['user_id'] !== $user_id ) {
			return null;
		}
		$channel_id = (int) $row['channel_id'];
		$body_html  = Neo_Pulse_App_Chat_Mentions::sanitize_chat_body_html( $body_html );
		$body_plain = self::html_to_plain( $body_html );
		if ( $body_plain === '' && count( $attachment_asset_ids ) === 0 ) {
			$existing = Neo_Pulse_App_Chat_Assets::get_for_messages( array( $message_id ), (int) ( self::get_channel( $channel_id )['team_id'] ?? 0 ) );
			if ( count( $existing[ $message_id ] ?? array() ) === 0 ) {
				return null;
			}
		}
		$now = current_time( 'mysql', true );
		$wpdb->update(
			$wpdb->prefix . 'neo_pulse_chat_messages',
			array(
				'body_html'  => $body_html,
				'body_plain' => $body_plain,
				'edited_at'  => $now,
			),
			array( 'id' => $message_id ),
			array( '%s', '%s', '%s' ),
			array( '%d' )
		);
		Neo_Pulse_App_Chat_Link_Unfurl::clear_for_message( $message_id );

		$updated_row = self::get_message( $message_id );
		if ( ! is_array( $updated_row ) ) {
			return null;
		}
		$payload = self::format_message_payload( $updated_row );
		self::enrich_message_payload( $payload, $channel_id, $attachment_asset_ids, $user_id, true );
		$channel = self::get_channel( $channel_id );
		if ( $channel ) {
			$thread_root = ! empty( $updated_row['parent_message_id'] ) ? (int) $updated_row['parent_message_id'] : null;
			Neo_Pulse_App_Chat_Mentions::sync_for_message(
				$message_id,
				$channel_id,
				(int) $channel['team_id'],
				$user_id,
				$mentioned_user_ids,
				$thread_root
			);
		}
		return $payload;
	}

	public static function delete_message( int $message_id, int $user_id, bool $is_admin ): bool {
		$row = self::get_message( $message_id );
		if ( ! $row || ! empty( $row['deleted_at'] ) ) {
			return false;
		}
		if ( (int) $row['user_id'] !== $user_id && ! $is_admin ) {
			return false;
		}
		$channel    = self::get_channel( (int) $row['channel_id'] );
		$team_id    = $channel ? (int) $channel['team_id'] : 0;
		$channel_id = (int) $row['channel_id'];
		if ( $team_id > 0 ) {
			Neo_Pulse_App_Chat_Assets::soft_delete_for_message( $team_id, $channel_id, $message_id, (int) $row['user_id'] );
			Neo_Pulse_App_Chat_Activity_Log::purge_shared_for_message( $team_id, $channel_id, $message_id, (int) $row['user_id'] );
			Neo_Pulse_App_Chat_Link_Unfurl::clear_for_message( $message_id );
			Neo_Pulse_App_Chat_Mentions::purge_for_message( $message_id );
		}
		global $wpdb;
		return (bool) $wpdb->update(
			$wpdb->prefix . 'neo_pulse_chat_messages',
			array( 'deleted_at' => current_time( 'mysql', true ) ),
			array( 'id' => $message_id ),
			array( '%s' ),
			array( '%d' )
		);
	}

	public static function unique_channel_slug( int $team_id, string $name ): string {
		global $wpdb;
		$base = sanitize_title( $name );
		if ( $base === '' ) {
			$base = 'channel';
		}
		$slug = $base;
		$i    = 2;
		$table = $wpdb->prefix . 'neo_pulse_chat_channels';
		while ( $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE team_id = %d AND slug = %s", $team_id, $slug ) ) ) {
			$slug = $base . '-' . $i;
			++$i;
		}
		return $slug;
	}

	/**
	 * @param array<int,int> $member_user_ids
	 */
	public static function add_channel_members( int $channel_id, array $member_user_ids ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_channel_members';
		foreach ( $member_user_ids as $uid ) {
			$uid = (int) $uid;
			$exists = $wpdb->get_var(
				$wpdb->prepare( "SELECT id FROM {$table} WHERE channel_id = %d AND user_id = %d", $channel_id, $uid )
			);
			if ( ! $exists ) {
				$wpdb->insert(
					$table,
					array(
						'channel_id' => $channel_id,
						'user_id'    => $uid,
						'role'       => 'member',
					),
					array( '%d', '%d', '%s' )
				);
			}
		}
	}

	public static function patch_channel( int $channel_id, array $updates ): bool {
		global $wpdb;
		$allowed = array();
		$formats = array();
		if ( isset( $updates['name'] ) ) {
			$allowed['name'] = sanitize_text_field( (string) $updates['name'] );
			$formats[]       = '%s';
		}
		if ( isset( $updates['archived'] ) && $updates['archived'] ) {
			$allowed['archived_at'] = current_time( 'mysql', true );
			$formats[]              = '%s';
		}
		if ( array_key_exists( 'topic', $updates ) ) {
			$allowed['topic'] = sanitize_text_field( (string) $updates['topic'] );
			$formats[]        = '%s';
		}
		if ( count( $allowed ) === 0 ) {
			return false;
		}
		return (bool) $wpdb->update(
			$wpdb->prefix . 'neo_pulse_chat_channels',
			$allowed,
			array( 'id' => $channel_id ),
			$formats,
			array( '%d' )
		);
	}

	public static function mark_thread_read( int $channel_id, int $user_id, int $thread_root_id, int $message_id ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_thread_read_state';
		$existing = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$table} WHERE user_id = %d AND channel_id = %d AND thread_root_id = %d",
				$user_id,
				$channel_id,
				$thread_root_id
			)
		);
		$now = current_time( 'mysql', true );
		if ( $existing ) {
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$table} SET last_read_message_id = GREATEST(last_read_message_id, %d), updated_at = %s WHERE user_id = %d AND channel_id = %d AND thread_root_id = %d",
					$message_id,
					$now,
					$user_id,
					$channel_id,
					$thread_root_id
				)
			);
		} else {
			$wpdb->insert(
				$table,
				array(
					'user_id'              => $user_id,
					'channel_id'           => $channel_id,
					'thread_root_id'       => $thread_root_id,
					'last_read_message_id' => $message_id,
					'updated_at'           => $now,
				),
				array( '%d', '%d', '%d', '%d', '%s' )
			);
		}
	}

	public static function count_thread_unread( int $channel_id, int $user_id ): int {
		$threads = self::threads_with_unread( $channel_id, $user_id );
		$sum     = 0;
		foreach ( $threads as $t ) {
			$sum += (int) ( $t['unreadCount'] ?? 0 );
		}
		return $sum;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function threads_with_unread( int $channel_id, int $user_id ): array {
		global $wpdb;
		$msg_table   = $wpdb->prefix . 'neo_pulse_chat_messages';
		$read_table  = $wpdb->prefix . 'neo_pulse_chat_thread_read_state';

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT m.parent_message_id AS thread_root_id, COUNT(*) AS unread_count, MAX(m.created_at) AS last_reply_at
				FROM {$msg_table} m
				LEFT JOIN {$read_table} r ON r.thread_root_id = m.parent_message_id AND r.user_id = %d AND r.channel_id = %d
				WHERE m.channel_id = %d AND m.parent_message_id IS NOT NULL AND m.deleted_at IS NULL AND m.user_id != %d
				AND m.id > COALESCE(r.last_read_message_id, 0)
				GROUP BY m.parent_message_id",
				$user_id,
				$channel_id,
				$channel_id,
				$user_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$count = (int) $row['unread_count'];
			if ( $count <= 0 ) {
				continue;
			}
			$out[] = array(
				'threadRootId'  => (int) $row['thread_root_id'],
				'unreadCount'   => $count,
				'lastReplyAt'   => ! empty( $row['last_reply_at'] ) ? gmdate( 'c', strtotime( (string) $row['last_reply_at'] ) ) : null,
			);
		}
		return $out;
	}

	public static function thread_unread_map( int $channel_id, int $user_id ): array {
		$map = array();
		foreach ( self::threads_with_unread( $channel_id, $user_id ) as $t ) {
			$map[ (int) $t['threadRootId'] ] = (int) $t['unreadCount'];
		}
		return $map;
	}

	public static function activity_thread_root( int $message_id ): ?int {
		$row = self::get_message( $message_id );
		if ( ! $row || empty( $row['parent_message_id'] ) ) {
			return null;
		}
		return (int) $row['parent_message_id'];
	}

	public static function enrich_messages_thread_unread( array $messages, int $channel_id, int $user_id ): array {
		$map = self::thread_unread_map( $channel_id, $user_id );
		foreach ( $messages as &$msg ) {
			$root = (int) ( $msg['id'] ?? 0 );
			if ( isset( $map[ $root ] ) ) {
				$msg['threadUnreadCount'] = $map[ $root ];
			}
		}
		unset( $msg );
		return $messages;
	}
}
