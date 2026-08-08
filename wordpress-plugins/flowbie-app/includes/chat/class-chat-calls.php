<?php
/**
 * Team chat voice/video call sessions, signaling, and transcript storage.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Chat_Calls {

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset    = $wpdb->get_charset_collate();
		$calls      = $wpdb->prefix . 'flowbie_chat_calls';
		$signals    = $wpdb->prefix . 'flowbie_chat_call_signals';
		$transcript = $wpdb->prefix . 'flowbie_chat_call_transcript';

		dbDelta(
			"CREATE TABLE {$calls} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				channel_id bigint(20) unsigned NOT NULL,
				caller_user_id bigint(20) unsigned NOT NULL,
				callee_user_id bigint(20) unsigned NOT NULL,
				status varchar(16) NOT NULL DEFAULT 'ringing',
				started_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				ended_at datetime DEFAULT NULL,
				PRIMARY KEY (id),
				KEY team_channel (team_id, channel_id),
				KEY callee_status (callee_user_id, status)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$signals} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				call_id bigint(20) unsigned NOT NULL,
				from_user_id bigint(20) unsigned NOT NULL,
				payload_json longtext NOT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY call_id (call_id)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$transcript} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				call_id bigint(20) unsigned NOT NULL,
				user_id bigint(20) unsigned NOT NULL,
				display_name varchar(255) NOT NULL DEFAULT '',
				text text NOT NULL,
				spoken_at_ms bigint(20) unsigned NOT NULL DEFAULT 0,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY call_spoken (call_id, spoken_at_ms)
			) {$charset};"
		);

		$participants = $wpdb->prefix . 'flowbie_chat_call_participants';
		dbDelta(
			"CREATE TABLE {$participants} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				call_id bigint(20) unsigned NOT NULL,
				user_id bigint(20) unsigned NOT NULL,
				joined_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				left_at datetime DEFAULT NULL,
				PRIMARY KEY (id),
				UNIQUE KEY call_user (call_id, user_id),
				KEY call_active (call_id, left_at)
			) {$charset};"
		);
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_call( int $call_id ): ?array {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM ' . $wpdb->prefix . 'flowbie_chat_calls WHERE id = %d', $call_id ),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function format_call( array $row, bool $with_huddle_meta = true ): array {
		$call = array(
			'id'           => (int) $row['id'],
			'teamId'       => (int) $row['team_id'],
			'channelId'    => (int) $row['channel_id'],
			'callerUserId' => (int) $row['caller_user_id'],
			'calleeUserId' => (int) $row['callee_user_id'],
			'status'       => (string) $row['status'],
			'startedAt'    => gmdate( 'c', strtotime( (string) $row['started_at'] ) ),
			'endedAt'      => ! empty( $row['ended_at'] ) ? gmdate( 'c', strtotime( (string) $row['ended_at'] ) ) : null,
		);
		if ( $with_huddle_meta && self::is_flo_huddle_row( $row ) ) {
			$call_id                       = (int) $row['id'];
			$call['isFloHuddle']             = true;
			$call['participantUserIds']      = self::list_active_participant_ids( $call_id );
			$call['participantCount']        = count( $call['participantUserIds'] );
		}
		return $call;
	}

	public static function is_flo_huddle_row( array $row ): bool {
		return class_exists( 'Flowbie_App_Chat_Flo' )
			&& Flowbie_App_Chat_Flo::is_flo( (int) $row['callee_user_id'] );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function start_call( int $team_id, int $channel_id, int $caller_user_id, bool $flo_huddle = false ): ?array {
		$channel = Flowbie_App_Chat_Store::get_channel( $channel_id );
		if ( ! $channel || (int) $channel['team_id'] !== $team_id ) {
			return null;
		}
		if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $caller_user_id ) ) {
			return null;
		}

		$is_dm     = (string) $channel['type'] === 'dm';
		$other_id  = $is_dm ? self::get_dm_other_user_id( $channel_id, $caller_user_id ) : null;
		$is_flo_dm = $is_dm && $other_id && class_exists( 'Flowbie_App_Chat_Flo' ) && Flowbie_App_Chat_Flo::is_flo( $other_id );

		if ( $flo_huddle || ! $is_dm || $is_flo_dm ) {
			return self::start_flo_huddle( $team_id, $channel_id, $caller_user_id );
		}

		if ( ! $is_dm || ! $other_id ) {
			return null;
		}

		$callee_user_id = $other_id;

		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_calls';

		$existing = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE channel_id = %d AND status IN ('ringing','active') ORDER BY id DESC LIMIT 1",
				$channel_id
			),
			ARRAY_A
		);
		if ( is_array( $existing ) ) {
			return self::format_call( $existing );
		}

		$wpdb->insert(
			$table,
			array(
				'team_id'        => $team_id,
				'channel_id'     => $channel_id,
				'caller_user_id' => $caller_user_id,
				'callee_user_id' => $callee_user_id,
				'status'         => 'ringing',
				'started_at'     => current_time( 'mysql', true ),
			),
			array( '%d', '%d', '%d', '%d', '%s', '%s' )
		);
		$id = (int) $wpdb->insert_id;
		if ( $id <= 0 ) {
			return null;
		}
		if ( Flowbie_App_Chat_Flo::is_flo( $callee_user_id ) ) {
			$wpdb->update(
				$table,
				array( 'status' => 'active' ),
				array( 'id' => $id ),
				array( '%s' ),
				array( '%d' )
			);
		}
		$row = self::get_call( $id );
		return $row ? self::format_call( $row ) : null;
	}

	public static function get_dm_other_user_id( int $channel_id, int $user_id ): ?int {
		global $wpdb;
		$other = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT user_id FROM ' . $wpdb->prefix . 'flowbie_chat_channel_members WHERE channel_id = %d AND user_id != %d LIMIT 1',
				$channel_id,
				$user_id
			)
		);
		return $other ? (int) $other : null;
	}

	public static function user_is_participant( array $call, int $user_id ): bool {
		if ( class_exists( 'Flowbie_App_Chat_Flo' ) && Flowbie_App_Chat_Flo::is_flo( $user_id ) && self::is_flo_huddle_row( $call ) ) {
			return true;
		}
		$caller = (int) $call['caller_user_id'];
		$callee = (int) $call['callee_user_id'];
		if ( $user_id === $caller || $user_id === $callee ) {
			return true;
		}
		return self::is_active_participant( (int) $call['id'], $user_id );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function accept_call( int $call_id, int $user_id ): ?array {
		$row = self::get_call( $call_id );
		if ( ! $row || (int) $row['callee_user_id'] !== $user_id || (string) $row['status'] !== 'ringing' ) {
			return null;
		}
		global $wpdb;
		$wpdb->update(
			$wpdb->prefix . 'flowbie_chat_calls',
			array( 'status' => 'active' ),
			array( 'id' => $call_id ),
			array( '%s' ),
			array( '%d' )
		);
		$updated = self::get_call( $call_id );
		return $updated ? self::format_call( $updated ) : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function decline_call( int $call_id, int $user_id ): ?array {
		$row = self::get_call( $call_id );
		if ( ! $row || (int) $row['callee_user_id'] !== $user_id || (string) $row['status'] !== 'ringing' ) {
			return null;
		}
		return self::set_terminal_status( $call_id, 'declined' );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function end_call( int $call_id, int $user_id ): ?array {
		$row = self::get_call( $call_id );
		if ( ! $row || ! self::user_is_participant( $row, $user_id ) ) {
			return null;
		}
		if ( self::is_flo_huddle_row( $row ) ) {
			return self::leave_huddle( $call_id, $user_id );
		}
		$status = (string) $row['status'];
		if ( in_array( $status, array( 'ended', 'declined', 'missed' ), true ) ) {
			return self::format_call( $row );
		}
		if ( $status === 'ringing' && (int) $row['caller_user_id'] === $user_id ) {
			return self::set_terminal_status( $call_id, 'missed' );
		}
		return self::set_terminal_status( $call_id, 'ended' );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function set_terminal_status( int $call_id, string $status ): ?array {
		global $wpdb;
		$wpdb->update(
			$wpdb->prefix . 'flowbie_chat_calls',
			array(
				'status'   => $status,
				'ended_at' => current_time( 'mysql', true ),
			),
			array( 'id' => $call_id ),
			array( '%s', '%s' ),
			array( '%d' )
		);
		$row = self::get_call( $call_id );
		return $row ? self::format_call( $row ) : null;
	}

	public static function append_signal( int $call_id, int $from_user_id, array $payload ): bool {
		$row = self::get_call( $call_id );
		if ( ! $row || ! self::user_is_participant( $row, $from_user_id ) ) {
			return false;
		}
		if ( ! in_array( (string) $row['status'], array( 'ringing', 'active' ), true ) ) {
			return false;
		}
		global $wpdb;
		$json = wp_json_encode( $payload );
		if ( ! is_string( $json ) ) {
			return false;
		}
		return (bool) $wpdb->insert(
			$wpdb->prefix . 'flowbie_chat_call_signals',
			array(
				'call_id'      => $call_id,
				'from_user_id' => $from_user_id,
				'payload_json' => $json,
				'created_at'   => current_time( 'mysql', true ),
			),
			array( '%d', '%d', '%s', '%s' )
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_signals_since( int $call_id, int $since_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_call_signals';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, from_user_id, payload_json, created_at FROM {$table} WHERE call_id = %d AND id > %d ORDER BY id ASC LIMIT 200",
				$call_id,
				$since_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$payload = json_decode( (string) $row['payload_json'], true );
			if ( ! is_array( $payload ) ) {
				continue;
			}
			$out[] = array(
				'id'         => (int) $row['id'],
				'fromUserId' => (int) $row['from_user_id'],
				'payload'    => $payload,
				'createdAt'  => gmdate( 'c', strtotime( (string) $row['created_at'] ) ),
			);
		}
		return $out;
	}

	public static function append_transcript(
		int $call_id,
		int $user_id,
		string $display_name,
		string $text,
		int $spoken_at_ms
	): bool {
		$row = self::get_call( $call_id );
		if ( ! $row || ! self::user_is_participant( $row, $user_id ) ) {
			return false;
		}
		if ( (string) $row['status'] !== 'active' ) {
			return false;
		}
		$text = trim( $text );
		if ( $text === '' ) {
			return false;
		}
		global $wpdb;
		return (bool) $wpdb->insert(
			$wpdb->prefix . 'flowbie_chat_call_transcript',
			array(
				'call_id'      => $call_id,
				'user_id'      => $user_id,
				'display_name' => sanitize_text_field( $display_name ),
				'text'         => $text,
				'spoken_at_ms' => max( 0, $spoken_at_ms ),
				'created_at'   => current_time( 'mysql', true ),
			),
			array( '%d', '%d', '%s', '%s', '%d', '%s' )
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function get_merged_transcript( int $call_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_call_transcript';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT user_id, display_name, text, spoken_at_ms FROM {$table} WHERE call_id = %d ORDER BY spoken_at_ms ASC, id ASC",
				$call_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$out[] = array(
				'userId'      => (int) $row['user_id'],
				'displayName' => (string) $row['display_name'],
				'text'        => (string) $row['text'],
				'spokenAtMs'  => (int) $row['spoken_at_ms'],
			);
		}
		return $out;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function get_incoming_for_user( int $team_id, int $user_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_calls';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND callee_user_id = %d AND status = 'ringing' ORDER BY id DESC LIMIT 5",
				$team_id,
				$user_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$out[] = self::format_call( $row );
		}
		return $out;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function start_flo_huddle( int $team_id, int $channel_id, int $starter_user_id ): ?array {
		if ( ! class_exists( 'Flowbie_App_Chat_Flo' ) ) {
			return null;
		}
		$channel = Flowbie_App_Chat_Store::get_channel( $channel_id );
		if ( ! $channel || (int) $channel['team_id'] !== $team_id ) {
			return null;
		}
		if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $starter_user_id ) ) {
			return null;
		}

		$existing = self::get_active_call_row_for_channel( $channel_id );
		if ( is_array( $existing ) ) {
			self::join_huddle( (int) $existing['id'], $starter_user_id );
			$row = self::get_call( (int) $existing['id'] );
			return $row ? self::format_call( $row ) : null;
		}

		$flo_id = Flowbie_App_Chat_Flo::user_id();
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_calls';

		$wpdb->insert(
			$table,
			array(
				'team_id'        => $team_id,
				'channel_id'     => $channel_id,
				'caller_user_id' => $starter_user_id,
				'callee_user_id' => $flo_id,
				'status'         => 'active',
				'started_at'     => current_time( 'mysql', true ),
			),
			array( '%d', '%d', '%d', '%d', '%s', '%s' )
		);
		$id = (int) $wpdb->insert_id;
		if ( $id <= 0 ) {
			return null;
		}

		self::add_participant( $id, $starter_user_id );
		self::append_transcript(
			$id,
			$flo_id,
			Flowbie_App_Chat_Flo::DISPLAY_NAME,
			'Hi! I am here in the huddle. What can I help with?',
			0
		);

		$row = self::get_call( $id );
		return $row ? self::format_call( $row ) : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function join_huddle( int $call_id, int $user_id ): ?array {
		$row = self::get_call( $call_id );
		if ( ! $row || ! self::is_flo_huddle_row( $row ) || (string) $row['status'] !== 'active' ) {
			return null;
		}
		$team_id    = (int) $row['team_id'];
		$channel_id = (int) $row['channel_id'];
		if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
			return null;
		}
		self::add_participant( $call_id, $user_id );
		$updated = self::get_call( $call_id );
		return $updated ? self::format_call( $updated ) : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function leave_huddle( int $call_id, int $user_id ): ?array {
		$row = self::get_call( $call_id );
		if ( ! $row || ! self::is_flo_huddle_row( $row ) ) {
			return null;
		}
		if ( ! self::user_is_participant( $row, $user_id ) ) {
			return null;
		}
		self::mark_participant_left( $call_id, $user_id );

		if ( self::count_active_human_participants( $call_id ) <= 0 ) {
			return self::set_terminal_status( $call_id, 'ended' );
		}

		$updated = self::get_call( $call_id );
		return $updated ? self::format_call( $updated ) : null;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_active_huddles( int $team_id, int $user_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_calls';
		$flo_id = class_exists( 'Flowbie_App_Chat_Flo' ) ? Flowbie_App_Chat_Flo::user_id() : 0;
		if ( $flo_id <= 0 ) {
			return array();
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND callee_user_id = %d AND status = 'active' ORDER BY id DESC LIMIT 50",
				$team_id,
				$flo_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}

		$out = array();
		foreach ( $rows as $row ) {
			$channel_id = (int) $row['channel_id'];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				continue;
			}
			$call_id              = (int) $row['id'];
			$participant_ids      = self::list_active_participant_ids( $call_id );
			$out[]                = array(
				'callId'             => $call_id,
				'channelId'          => $channel_id,
				'startedAt'          => gmdate( 'c', strtotime( (string) $row['started_at'] ) ),
				'participantCount'   => count( $participant_ids ),
				'participantUserIds' => $participant_ids,
				'joinedByMe'         => in_array( $user_id, $participant_ids, true ),
			);
		}
		return $out;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function get_active_call_row_for_channel( int $channel_id ): ?array {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}flowbie_chat_calls WHERE channel_id = %d AND status = 'active' ORDER BY id DESC LIMIT 1",
				$channel_id
			),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	private static function add_participant( int $call_id, int $user_id ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_call_participants';
		$existing = $wpdb->get_row(
			$wpdb->prepare( "SELECT id, left_at FROM {$table} WHERE call_id = %d AND user_id = %d LIMIT 1", $call_id, $user_id ),
			ARRAY_A
		);
		if ( is_array( $existing ) ) {
			if ( ! empty( $existing['left_at'] ) ) {
				$wpdb->update(
					$table,
					array(
						'left_at'   => null,
						'joined_at' => current_time( 'mysql', true ),
					),
					array( 'id' => (int) $existing['id'] ),
					array( '%s', '%s' ),
					array( '%d' )
				);
			}
			return;
		}
		$wpdb->insert(
			$table,
			array(
				'call_id'   => $call_id,
				'user_id'   => $user_id,
				'joined_at' => current_time( 'mysql', true ),
			),
			array( '%d', '%d', '%s' )
		);
	}

	private static function mark_participant_left( int $call_id, int $user_id ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_call_participants';
		$wpdb->update(
			$table,
			array( 'left_at' => current_time( 'mysql', true ) ),
			array(
				'call_id' => $call_id,
				'user_id' => $user_id,
			),
			array( '%s' ),
			array( '%d', '%d' )
		);
	}

	public static function is_active_participant( int $call_id, int $user_id ): bool {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_call_participants';
		$found = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT user_id FROM {$table} WHERE call_id = %d AND user_id = %d AND left_at IS NULL LIMIT 1",
				$call_id,
				$user_id
			)
		);
		return (int) $found === $user_id;
	}

	/**
	 * @return array<int,int>
	 */
	public static function list_active_participant_ids( int $call_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_call_participants';
		$rows  = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT user_id FROM {$table} WHERE call_id = %d AND left_at IS NULL ORDER BY joined_at ASC",
				$call_id
			)
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $uid ) {
			$out[] = (int) $uid;
		}
		return $out;
	}

	private static function count_active_human_participants( int $call_id ): int {
		$flo_id = class_exists( 'Flowbie_App_Chat_Flo' ) ? Flowbie_App_Chat_Flo::user_id() : 0;
		$count  = 0;
		foreach ( self::list_active_participant_ids( $call_id ) as $uid ) {
			if ( $uid !== $flo_id ) {
				++$count;
			}
		}
		return $count;
	}
}
