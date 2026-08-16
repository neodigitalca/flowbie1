<?php
/**
 * Chat typing indicators (ephemeral).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Chat_Typing {

	public static function install_table(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$table   = $wpdb->prefix . 'neo_pulse_chat_typing';
		$charset = $wpdb->get_charset_collate();
		dbDelta(
			"CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				channel_id bigint(20) unsigned NOT NULL,
				user_id bigint(20) unsigned NOT NULL,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				UNIQUE KEY channel_user (channel_id, user_id)
			) {$charset};"
		);
	}

	public static function heartbeat( int $channel_id, int $user_id ): void {
		global $wpdb;
		self::install_table();
		$table = $wpdb->prefix . 'neo_pulse_chat_typing';
		$now   = current_time( 'mysql', true );
		$exists = $wpdb->get_var(
			$wpdb->prepare( "SELECT id FROM {$table} WHERE channel_id = %d AND user_id = %d", $channel_id, $user_id )
		);
		if ( $exists ) {
			$wpdb->update(
				$table,
				array( 'updated_at' => $now ),
				array( 'channel_id' => $channel_id, 'user_id' => $user_id ),
				array( '%s' ),
				array( '%d', '%d' )
			);
		} else {
			$wpdb->insert(
				$table,
				array(
					'channel_id' => $channel_id,
					'user_id'    => $user_id,
					'updated_at' => $now,
				),
				array( '%d', '%d', '%s' )
			);
		}
		self::purge_stale( $channel_id );
	}

	public static function purge_stale( int $channel_id ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_typing';
		$cutoff = gmdate( 'Y-m-d H:i:s', time() - 8 );
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$table} WHERE channel_id = %d AND updated_at < %s",
				$channel_id,
				$cutoff
			)
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_active( int $channel_id, int $exclude_user_id = 0 ): array {
		global $wpdb;
		self::install_table();
		self::purge_stale( $channel_id );
		$table = $wpdb->prefix . 'neo_pulse_chat_typing';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT user_id FROM {$table} WHERE channel_id = %d AND user_id != %d",
				$channel_id,
				$exclude_user_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$uid  = (int) $row['user_id'];
			$user = Neo_Pulse_App_Teams_Store::get_user_by_id( $uid );
			$out[] = array(
				'userId'      => $uid,
				'displayName' => $user ? (string) $user['display_name'] : 'Unknown',
			);
		}
		return $out;
	}
}
