<?php
/**
 * Team support tickets DB schema and data access.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Support_Store {

	const STATUSES = array( 'open', 'closed' );

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset   = $wpdb->get_charset_collate();
		$tickets   = $wpdb->prefix . 'neo_pulse_team_support_tickets';
		$comments  = $wpdb->prefix . 'neo_pulse_team_support_comments';

		dbDelta(
			"CREATE TABLE {$tickets} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				created_by_user_id bigint(20) unsigned NOT NULL,
				title varchar(255) NOT NULL DEFAULT '',
				summary longtext NOT NULL,
				status varchar(32) NOT NULL DEFAULT 'open',
				source varchar(64) NOT NULL DEFAULT 'pulse-assist',
				chat_log_path varchar(512) NOT NULL DEFAULT '',
				payload_json longtext NOT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY team_id (team_id),
				KEY status (status),
				KEY created_at (created_at)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$comments} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				ticket_id bigint(20) unsigned NOT NULL,
				user_id bigint(20) unsigned NOT NULL,
				body longtext NOT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY team_ticket (team_id, ticket_id)
			) {$charset};"
		);
	}

	public static function is_active_member( array $member ): bool {
		return (string) ( $member['status'] ?? '' ) === 'active';
	}

	/**
	 * @param array<string,mixed> $payload
	 */
	public static function encode_payload( array $payload ): string {
		$json = wp_json_encode( $payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		return is_string( $json ) ? $json : '{}';
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function decode_payload( ?string $json ): array {
		if ( ! is_string( $json ) || $json === '' ) {
			return array();
		}
		$data = json_decode( $json, true );
		return is_array( $data ) ? $data : array();
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_tickets( int $team_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_support_tickets';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d ORDER BY created_at DESC, id DESC",
				$team_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format_ticket_list_item( $row );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_ticket( int $team_id, int $ticket_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_support_tickets';
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND id = %d",
				$team_id,
				$ticket_id
			),
			ARRAY_A
		);
		return is_array( $row ) ? self::format_ticket_detail( $row ) : null;
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function create_ticket( int $team_id, int $user_id, array $body ): ?array {
		global $wpdb;

		$title   = isset( $body['title'] ) ? sanitize_text_field( (string) $body['title'] ) : '';
		$summary = isset( $body['summary'] ) ? sanitize_textarea_field( (string) $body['summary'] ) : '';
		$source  = isset( $body['source'] ) ? sanitize_key( (string) $body['source'] ) : 'pulse-assist';
		$comment = isset( $body['comment'] ) ? sanitize_textarea_field( (string) $body['comment'] ) : '';

		$workspace = isset( $body['workspace'] ) && is_array( $body['workspace'] ) ? $body['workspace'] : array();
		$payload   = array(
			'workspace' => $workspace,
		);

		$table = $wpdb->prefix . 'neo_pulse_team_support_tickets';
		$wpdb->insert(
			$table,
			array(
				'team_id'            => $team_id,
				'created_by_user_id' => $user_id,
				'title'              => $title,
				'summary'            => $summary,
				'status'             => 'open',
				'source'             => $source !== '' ? $source : 'pulse-assist',
				'chat_log_path'      => '',
				'payload_json'       => self::encode_payload( $payload ),
			),
			array( '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s' )
		);

		$ticket_id = (int) $wpdb->insert_id;
		if ( $ticket_id <= 0 ) {
			return null;
		}

		$chat_log = isset( $body['chatLog'] ) && is_array( $body['chatLog'] ) ? $body['chatLog'] : null;
		if ( $chat_log !== null ) {
			$path = self::write_chat_log( $team_id, $ticket_id, $chat_log );
			if ( $path !== '' ) {
				$wpdb->update(
					$table,
					array( 'chat_log_path' => $path ),
					array( 'id' => $ticket_id, 'team_id' => $team_id ),
					array( '%s' ),
					array( '%d', '%d' )
				);
			}
		}

		if ( trim( $comment ) !== '' ) {
			self::add_comment( $team_id, $ticket_id, $user_id, $comment );
		}

		return self::get_ticket( $team_id, $ticket_id );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function patch_ticket( int $team_id, int $ticket_id, array $body ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_support_tickets';

		$updates = array();
		$formats = array();

		if ( isset( $body['title'] ) ) {
			$updates['title'] = sanitize_text_field( (string) $body['title'] );
			$formats[]        = '%s';
		}
		if ( isset( $body['summary'] ) ) {
			$updates['summary'] = sanitize_textarea_field( (string) $body['summary'] );
			$formats[]          = '%s';
		}
		if ( isset( $body['status'] ) ) {
			$status = sanitize_key( (string) $body['status'] );
			if ( in_array( $status, self::STATUSES, true ) ) {
				$updates['status'] = $status;
				$formats[]         = '%s';
			}
		}

		if ( count( $updates ) === 0 ) {
			return self::get_ticket( $team_id, $ticket_id );
		}

		$updates['updated_at'] = gmdate( 'Y-m-d H:i:s' );
		$formats[]             = '%s';

		$wpdb->update(
			$table,
			$updates,
			array(
				'id'      => $ticket_id,
				'team_id' => $team_id,
			),
			$formats,
			array( '%d', '%d' )
		);

		return self::get_ticket( $team_id, $ticket_id );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function add_comment( int $team_id, int $ticket_id, int $user_id, string $body ): ?array {
		global $wpdb;

		$body = trim( sanitize_textarea_field( $body ) );
		if ( $body === '' || ! self::get_ticket_row( $team_id, $ticket_id ) ) {
			return null;
		}

		$table = $wpdb->prefix . 'neo_pulse_team_support_comments';
		$wpdb->insert(
			$table,
			array(
				'team_id'   => $team_id,
				'ticket_id' => $ticket_id,
				'user_id'   => $user_id,
				'body'      => $body,
			),
			array( '%d', '%d', '%d', '%s' )
		);

		$comment_id = (int) $wpdb->insert_id;
		if ( $comment_id <= 0 ) {
			return null;
		}

		$wpdb->update(
			$wpdb->prefix . 'neo_pulse_team_support_tickets',
			array( 'updated_at' => gmdate( 'Y-m-d H:i:s' ) ),
			array(
				'id'      => $ticket_id,
				'team_id' => $team_id,
			),
			array( '%s' ),
			array( '%d', '%d' )
		);

		return self::format_comment( self::get_comment_row( $comment_id ) );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_comments( int $team_id, int $ticket_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_support_comments';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND ticket_id = %d ORDER BY created_at ASC, id ASC",
				$team_id,
				$ticket_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format_comment( $row );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $chat_log
	 */
	public static function write_chat_log( int $team_id, int $ticket_id, array $chat_log ): string {
		$dir = self::chat_log_dir( $team_id );
		if ( $dir === '' ) {
			return '';
		}

		$file_name = 'ticket-' . $ticket_id . '-chat-log.json';
		$path      = $dir . '/' . $file_name;
		$json      = wp_json_encode( $chat_log, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
		if ( ! is_string( $json ) || false === file_put_contents( $path, $json ) ) {
			return '';
		}

		return self::chat_log_rel_path( $team_id, $ticket_id );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function read_chat_log( int $team_id, int $ticket_id ): ?array {
		$row = self::get_ticket_row( $team_id, $ticket_id );
		if ( ! $row ) {
			return null;
		}
		$rel = (string) ( $row['chat_log_path'] ?? '' );
		if ( $rel === '' ) {
			return null;
		}
		$abs = self::resolve_chat_log_abs( $team_id, $ticket_id, $rel );
		if ( $abs === '' || ! is_readable( $abs ) ) {
			return null;
		}
		return self::decode_chat_log_file( $abs );
	}

	public static function serve_chat_log( int $team_id, int $ticket_id ): void {
		$row = self::get_ticket_row( $team_id, $ticket_id );
		if ( ! $row ) {
			status_header( 404 );
			exit;
		}
		$rel = (string) ( $row['chat_log_path'] ?? '' );
		if ( $rel === '' ) {
			status_header( 404 );
			exit;
		}
		$abs = self::resolve_chat_log_abs( $team_id, $ticket_id, $rel );
		if ( $abs === '' || ! is_readable( $abs ) ) {
			status_header( 404 );
			exit;
		}

		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Length: ' . (string) filesize( $abs ) );
		header(
			'Content-Disposition: attachment; filename="' . rawurlencode( 'ticket-' . $ticket_id . '-chat-log.json' ) . '"'
		);
		readfile( $abs );
		exit;
	}

	public static function delete_ticket( int $team_id, int $ticket_id ): bool {
		$row = self::get_ticket_row( $team_id, $ticket_id );
		if ( ! $row ) {
			return false;
		}

		self::unlink_chat_log_row( $row );

		global $wpdb;
		$comments_table = $wpdb->prefix . 'neo_pulse_team_support_comments';
		$tickets_table  = $wpdb->prefix . 'neo_pulse_team_support_tickets';
		$wpdb->delete(
			$comments_table,
			array(
				'team_id'   => $team_id,
				'ticket_id' => $ticket_id,
			),
			array( '%d', '%d' )
		);
		$deleted = $wpdb->delete(
			$tickets_table,
			array(
				'team_id' => $team_id,
				'id'      => $ticket_id,
			),
			array( '%d', '%d' )
		);

		return $deleted !== false && $deleted > 0;
	}

	public static function delete_all_tickets( int $team_id ): int {
		$rows  = self::list_tickets_raw( $team_id );
		$count = 0;
		foreach ( $rows as $row ) {
			$ticket_id = (int) ( $row['id'] ?? 0 );
			if ( $ticket_id > 0 && self::delete_ticket( $team_id, $ticket_id ) ) {
				++$count;
			}
		}
		return $count;
	}

	/**
	 * @param array<string,mixed> $row
	 */
	private static function unlink_chat_log_row( array $row ): void {
		$rel       = (string) ( $row['chat_log_path'] ?? '' );
		$team_id   = (int) ( $row['team_id'] ?? 0 );
		$ticket_id = (int) ( $row['id'] ?? 0 );
		if ( $rel === '' ) {
			return;
		}
		$paths = array(
			self::chat_log_abs_from_rel( $rel ),
		);
		if ( $team_id > 0 && $ticket_id > 0 ) {
			$legacy = self::legacy_chat_log_abs( $team_id, $ticket_id );
			if ( $legacy !== '' && ! in_array( $legacy, $paths, true ) ) {
				$paths[] = $legacy;
			}
		}
		foreach ( $paths as $abs ) {
			if ( $abs !== '' && is_file( $abs ) ) {
				wp_delete_file( $abs );
			}
		}
	}

	private static function chat_log_rel_path( int $team_id, int $ticket_id ): string {
		return 'support/teams/' . (int) $team_id . '/ticket-' . (int) $ticket_id . '-chat-log.json';
	}

	private static function chat_log_abs_from_rel( string $rel ): string {
		return Neo_Pulse_App_Data_Paths::root() . '/' . ltrim( $rel, '/' );
	}

	private static function chat_log_dir( int $team_id ): string {
		$dir = Neo_Pulse_App_Data_Paths::root() . '/support/teams/' . (int) $team_id;
		if ( ! wp_mkdir_p( $dir ) ) {
			return '';
		}
		if ( ! file_exists( $dir . '/index.php' ) ) {
			file_put_contents( $dir . '/index.php', '<?php // silence' );
		}
		return $dir;
	}

	private static function legacy_chat_log_abs( int $team_id, int $ticket_id ): string {
		$dir = Neo_Pulse_App_Data_Paths::subdir( 'support/teams/' . $team_id );
		return $dir . '/ticket-' . (int) $ticket_id . '-chat-log.json';
	}

	private static function resolve_chat_log_abs( int $team_id, int $ticket_id, string $rel ): string {
		$canonical = self::chat_log_abs_from_rel( $rel );
		if ( is_readable( $canonical ) ) {
			return $canonical;
		}

		$legacy = self::legacy_chat_log_abs( $team_id, $ticket_id );
		if ( $legacy === '' || ! is_readable( $legacy ) ) {
			return '';
		}

		if ( ! is_readable( $canonical ) ) {
			wp_mkdir_p( dirname( $canonical ) );
			if ( ! file_exists( dirname( $canonical ) . '/index.php' ) ) {
				file_put_contents( dirname( $canonical ) . '/index.php', '<?php // silence' );
			}
			copy( $legacy, $canonical );
		}

		return is_readable( $canonical ) ? $canonical : $legacy;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function decode_chat_log_file( string $abs ): ?array {
		$raw = file_get_contents( $abs );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return null;
		}
		$data = json_decode( $raw, true );
		return is_array( $data ) ? $data : null;
	}

	public static function export_all( array $team ): array {
		$team_id = (int) $team['id'];
		$tickets = array();
		foreach ( self::list_tickets_raw( $team_id ) as $row ) {
			$ticket_id = (int) $row['id'];
			$detail    = self::format_ticket_detail( $row );
			if ( ! $detail ) {
				continue;
			}
			$detail['comments'] = self::list_comments( $team_id, $ticket_id );
			$chat_log           = self::read_chat_log( $team_id, $ticket_id );
			if ( $chat_log !== null ) {
				$detail['chatLog'] = $chat_log;
			}
			$tickets[] = $detail;
		}

		return array(
			'exportedAt'  => gmdate( 'c' ),
			'team'        => array(
				'id'   => $team_id,
				'name' => (string) ( $team['name'] ?? '' ),
				'slug' => (string) ( $team['slug'] ?? '' ),
			),
			'ticketCount' => count( $tickets ),
			'tickets'     => $tickets,
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private static function list_tickets_raw( int $team_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_support_tickets';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d ORDER BY created_at DESC, id DESC",
				$team_id
			),
			ARRAY_A
		);
		return is_array( $rows ) ? $rows : array();
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function get_ticket_row( int $team_id, int $ticket_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_support_tickets';
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND id = %d",
				$team_id,
				$ticket_id
			),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function get_comment_row( int $comment_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_support_comments';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $comment_id ),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function format_ticket_list_item( array $row ): ?array {
		$detail = self::format_ticket_detail( $row );
		if ( ! $detail ) {
			return null;
		}
		unset( $detail['comments'] );
		return $detail;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function format_ticket_detail( array $row ): ?array {
		$ticket_id = (int) ( $row['id'] ?? 0 );
		$team_id   = (int) ( $row['team_id'] ?? 0 );
		if ( $ticket_id <= 0 || $team_id <= 0 ) {
			return null;
		}

		$user_id = (int) ( $row['created_by_user_id'] ?? 0 );
		$user    = Neo_Pulse_App_Teams_Store::get_user_by_id( $user_id );
		$payload = self::decode_payload( $row['payload_json'] ?? '' );

		return array(
			'id'          => $ticket_id,
			'teamId'      => $team_id,
			'title'       => (string) ( $row['title'] ?? '' ),
			'summary'     => (string) ( $row['summary'] ?? '' ),
			'status'      => (string) ( $row['status'] ?? 'open' ),
			'source'      => (string) ( $row['source'] ?? 'pulse-assist' ),
			'hasChatLog'  => (string) ( $row['chat_log_path'] ?? '' ) !== '',
			'workspace'   => isset( $payload['workspace'] ) && is_array( $payload['workspace'] ) ? $payload['workspace'] : array(),
			'createdBy'   => array(
				'userId'      => $user_id,
				'displayName' => $user ? (string) ( $user['display_name'] ?? '' ) : '',
				'email'       => $user ? (string) ( $user['email'] ?? '' ) : '',
			),
			'createdAt'   => self::format_datetime( $row['created_at'] ?? '' ),
			'updatedAt'   => self::format_datetime( $row['updated_at'] ?? '' ),
			'comments'    => self::list_comments( $team_id, $ticket_id ),
		);
	}

	/**
	 * @param array<string,mixed>|null $row
	 * @return array<string,mixed>|null
	 */
	private static function format_comment( ?array $row ): ?array {
		if ( ! $row ) {
			return null;
		}
		$user_id = (int) ( $row['user_id'] ?? 0 );
		$user    = Neo_Pulse_App_Teams_Store::get_user_by_id( $user_id );
		return array(
			'id'          => (int) ( $row['id'] ?? 0 ),
			'ticketId'    => (int) ( $row['ticket_id'] ?? 0 ),
			'userId'      => $user_id,
			'displayName' => $user ? (string) ( $user['display_name'] ?? '' ) : '',
			'body'        => (string) ( $row['body'] ?? '' ),
			'createdAt'   => self::format_datetime( $row['created_at'] ?? '' ),
		);
	}

	private static function format_datetime( string $value ): string {
		if ( $value === '' ) {
			return '';
		}
		$ts = strtotime( $value . ' UTC' );
		return $ts ? gmdate( 'c', $ts ) : $value;
	}
}
