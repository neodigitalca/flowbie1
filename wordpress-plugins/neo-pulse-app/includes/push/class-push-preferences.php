<?php
/**
 * Mobile push notification preferences (global per user, merged with chat prefs for dispatch).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Push_Preferences {

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$table   = $wpdb->prefix . 'neo_pulse_push_preferences';

		dbDelta(
			"CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				user_id bigint(20) unsigned NOT NULL,
				prefs_json longtext NOT NULL,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				UNIQUE KEY user_id (user_id)
			) {$charset};"
		);
	}

	/**
	 * @return array<string,bool>
	 */
	public static function get_mobile_only_defaults(): array {
		return array(
			'taskAssigned' => true,
			'agentRuns'    => true,
		);
	}

	/**
	 * @return array<string,bool>
	 */
	public static function get_stored_mobile_prefs( int $user_id ): array {
		global $wpdb;
		if ( $user_id <= 0 ) {
			return self::get_mobile_only_defaults();
		}
		self::install_tables();
		$table = $wpdb->prefix . 'neo_pulse_push_preferences';
		$row   = $wpdb->get_row(
			$wpdb->prepare( 'SELECT prefs_json FROM ' . $table . ' WHERE user_id = %d', $user_id ),
			ARRAY_A
		);
		$defaults = self::get_mobile_only_defaults();
		if ( ! is_array( $row ) || empty( $row['prefs_json'] ) ) {
			return $defaults;
		}
		$decoded = json_decode( (string) $row['prefs_json'], true );
		if ( ! is_array( $decoded ) ) {
			return $defaults;
		}
		foreach ( $defaults as $key => $default ) {
			if ( array_key_exists( $key, $decoded ) ) {
				$defaults[ $key ] = ! empty( $decoded[ $key ] );
			}
		}
		return $defaults;
	}

	/**
	 * @param array<string,mixed> $patch
	 * @return array<string,bool>
	 */
	public static function patch_mobile_prefs( int $user_id, array $patch ): array {
		global $wpdb;
		self::install_tables();
		$table   = $wpdb->prefix . 'neo_pulse_push_preferences';
		$current = self::get_stored_mobile_prefs( $user_id );
		foreach ( array( 'taskAssigned', 'agentRuns' ) as $key ) {
			if ( array_key_exists( $key, $patch ) ) {
				$current[ $key ] = ! empty( $patch[ $key ] );
			}
		}
		$now = current_time( 'mysql', true );
		$json = wp_json_encode( $current );
		$existing = $wpdb->get_var(
			$wpdb->prepare( 'SELECT id FROM ' . $table . ' WHERE user_id = %d', $user_id )
		);
		if ( $existing ) {
			$wpdb->update(
				$table,
				array(
					'prefs_json' => $json,
					'updated_at' => $now,
				),
				array( 'user_id' => $user_id ),
				array( '%s', '%s' ),
				array( '%d' )
			);
		} else {
			$wpdb->insert(
				$table,
				array(
					'user_id'    => $user_id,
					'prefs_json' => $json,
					'updated_at' => $now,
				),
				array( '%d', '%s', '%s' )
			);
		}
		return $current;
	}

	/**
	 * Full mobile push prefs for API + client UI.
	 *
	 * @return array<string,bool>
	 */
	public static function get_for_user( int $user_id, int $team_id = 0 ): array {
		$defaults = Neo_Pulse_App_Push_Notification_Actions::default_preferences();
		$mobile   = self::get_stored_mobile_prefs( $user_id );
		$prefs    = array_merge( $defaults, $mobile );

		if ( $team_id > 0 && class_exists( 'Neo_Pulse_App_Chat_Preferences' ) ) {
			$chat = Neo_Pulse_App_Chat_Preferences::get_for_user( $team_id, $user_id );
			$chat_notifications = is_array( $chat['notifications'] ?? null ) ? $chat['notifications'] : array();
			foreach ( array( 'mentions', 'dms', 'threads', 'calls', 'channelMessages' ) as $key ) {
				if ( array_key_exists( $key, $chat_notifications ) ) {
					$prefs[ $key ] = ! empty( $chat_notifications[ $key ] );
				}
			}
		}

		return $prefs;
	}

	/**
	 * @param array<string,mixed> $patch
	 * @return array<string,bool>
	 */
	public static function patch_for_user( int $user_id, int $team_id, array $patch ): array {
		$mobile_patch = array();
		foreach ( array( 'taskAssigned', 'agentRuns' ) as $key ) {
			if ( array_key_exists( $key, $patch ) ) {
				$mobile_patch[ $key ] = $patch[ $key ];
			}
		}
		if ( count( $mobile_patch ) > 0 ) {
			self::patch_mobile_prefs( $user_id, $mobile_patch );
		}

		$chat_patch = array();
		foreach ( array( 'mentions', 'dms', 'threads', 'calls', 'channelMessages' ) as $key ) {
			if ( array_key_exists( $key, $patch ) ) {
				$chat_patch[ $key ] = ! empty( $patch[ $key ] );
			}
		}
		if ( count( $chat_patch ) > 0 && $team_id > 0 && class_exists( 'Neo_Pulse_App_Chat_Preferences' ) ) {
			Neo_Pulse_App_Chat_Preferences::patch_for_user(
				$team_id,
				$user_id,
				array( 'notifications' => $chat_patch )
			);
		}

		return self::get_for_user( $user_id, $team_id );
	}

	public static function should_send( int $user_id, int $team_id, string $action_id ): bool {
		$action = Neo_Pulse_App_Push_Notification_Actions::get( $action_id );
		if ( ! $action ) {
			return false;
		}
		$prefs   = self::get_for_user( $user_id, $team_id );
		$pref_key = (string) ( $action['prefKey'] ?? '' );
		if ( $pref_key === '' || ! array_key_exists( $pref_key, $prefs ) ) {
			return ! empty( $action['defaultEnabled'] );
		}
		return ! empty( $prefs[ $pref_key ] );
	}
}
