<?php
/**
 * Per-user chat personalization preferences (team scoped).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Chat_Preferences {

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$table   = $wpdb->prefix . 'flowbie_chat_user_preferences';

		dbDelta(
			"CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				user_id bigint(20) unsigned NOT NULL,
				prefs_json longtext NOT NULL,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				UNIQUE KEY team_user (team_id, user_id)
			) {$charset};"
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function default_prefs( int $user_id ): array {
		$user = Flowbie_App_Teams_Store::get_user_by_id( $user_id );
		return array(
			'version'         => 2,
			'activePresetId'  => 'balanced',
			'profile'         => array(
				'displayName' => $user ? (string) $user['display_name'] : '',
				'avatarUrl'   => $user ? ( $user['avatar_url'] ?? null ) : null,
				'statusText'  => '',
				'timezone'    => 'UTC',
			),
			'appearance'    => array(
				'zoneThemes'      => array(
					'left'  => 'light',
					'main'  => 'light',
					'right' => 'light',
				),
				'headingTheme'    => 'light',
				'accentPreset'    => 'brand',
				'density'         => 'comfortable',
				'fontScale'       => 'default',
				'sidebarSections' => array(
					'channels' => true,
					'dms'      => true,
					'mentions' => true,
					'alerts'   => true,
				),
			),
			'notifications' => array(
				'mentions'         => true,
				'dms'              => true,
				'threads'          => true,
				'calls'            => true,
				'channelMessages'  => false,
				'desktopAlerts'    => false,
				'soundEnabled'     => false,
				'soundPreset'      => 'subtle',
				'keywordWatch'     => array(),
				'topicWatch'       => array(),
			),
			'behavior'      => array(
				'enterToSend'              => true,
				'showLinkPreviews'         => true,
				'showTypingIndicators'     => true,
				'collapseThreadsByDefault' => false,
			),
			'savedPresets'  => array(),
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function get_for_user( int $team_id, int $user_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_user_preferences';
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT prefs_json FROM ' . $table . ' WHERE team_id = %d AND user_id = %d',
				$team_id,
				$user_id
			),
			ARRAY_A
		);
		$defaults = self::default_prefs( $user_id );
		if ( ! is_array( $row ) || empty( $row['prefs_json'] ) ) {
			return $defaults;
		}
		$stored = json_decode( (string) $row['prefs_json'], true );
		if ( ! is_array( $stored ) ) {
			return $defaults;
		}
		return self::normalize_prefs( self::deep_merge( $defaults, $stored ) );
	}

	/**
	 * @param array<string,mixed> $prefs
	 * @return array<string,mixed>
	 */
	private static function normalize_prefs( array $prefs ): array {
		$prefs['version'] = 2;
		if ( ! isset( $prefs['appearance'] ) || ! is_array( $prefs['appearance'] ) ) {
			return $prefs;
		}
		$appearance = $prefs['appearance'];
		$legacy     = isset( $appearance['themeId'] ) ? (string) $appearance['themeId'] : 'light';
		if ( ! isset( $appearance['zoneThemes'] ) || ! is_array( $appearance['zoneThemes'] ) ) {
			$appearance['zoneThemes'] = array(
				'left'  => $legacy,
				'main'  => $legacy,
				'right' => $legacy,
			);
		}
		if ( ! isset( $appearance['headingTheme'] ) ) {
			$appearance['headingTheme'] = $legacy;
		}
		unset( $appearance['themeId'] );
		$prefs['appearance'] = $appearance;
		return $prefs;
	}

	/**
	 * @param array<string,mixed> $patch
	 * @return array<string,mixed>|null
	 */
	public static function patch_for_user( int $team_id, int $user_id, array $patch ): ?array {
		$current = self::get_for_user( $team_id, $user_id );
		$merged  = self::deep_merge( $current, $patch );
		$json    = wp_json_encode( $merged );
		if ( ! is_string( $json ) ) {
			return null;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_chat_user_preferences';
		$now   = current_time( 'mysql', true );
		$exists = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . $table . ' WHERE team_id = %d AND user_id = %d',
				$team_id,
				$user_id
			)
		);
		if ( $exists ) {
			$wpdb->update(
				$table,
				array(
					'prefs_json' => $json,
					'updated_at' => $now,
				),
				array(
					'team_id' => $team_id,
					'user_id' => $user_id,
				),
				array( '%s', '%s' ),
				array( '%d', '%d' )
			);
		} else {
			$wpdb->insert(
				$table,
				array(
					'team_id'    => $team_id,
					'user_id'    => $user_id,
					'prefs_json' => $json,
					'updated_at' => $now,
				),
				array( '%d', '%d', '%s', '%s' )
			);
		}

		if ( isset( $merged['profile']['displayName'] ) && is_string( $merged['profile']['displayName'] ) ) {
			$name = sanitize_text_field( $merged['profile']['displayName'] );
			if ( $name !== '' ) {
				$wpdb->update(
					$wpdb->prefix . 'flowbie_users',
					array( 'display_name' => $name ),
					array( 'id' => $user_id ),
					array( '%s' ),
					array( '%d' )
				);
			}
		}

		return $merged;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function upload_avatar( int $user_id, string $file_name, string $mime, string $binary ): ?array {
		$upload_dir = wp_upload_dir();
		if ( ! empty( $upload_dir['error'] ) ) {
			return null;
		}
		$subdir = '/flowbie-chat-avatars';
		$dir    = $upload_dir['basedir'] . $subdir;
		if ( ! wp_mkdir_p( $dir ) ) {
			return null;
		}
		$safe_name = sanitize_file_name( $file_name );
		if ( $safe_name === '' ) {
			$safe_name = 'avatar.jpg';
		}
		$path = $dir . '/' . $user_id . '-' . wp_generate_password( 8, false ) . '-' . $safe_name;
		if ( file_put_contents( $path, $binary ) === false ) {
			return null;
		}
		$url = $upload_dir['baseurl'] . $subdir . '/' . basename( $path );

		global $wpdb;
		$wpdb->update(
			$wpdb->prefix . 'flowbie_users',
			array( 'avatar_url' => esc_url_raw( $url ) ),
			array( 'id' => $user_id ),
			array( '%s' ),
			array( '%d' )
		);

		return array( 'avatarUrl' => $url );
	}

	/**
	 * @param array<string,mixed> $base
	 * @param array<string,mixed> $over
	 * @return array<string,mixed>
	 */
	private static function deep_merge( array $base, array $over ): array {
		foreach ( $over as $key => $value ) {
			if ( is_array( $value ) && isset( $base[ $key ] ) && is_array( $base[ $key ] ) && self::is_assoc( $value ) && self::is_assoc( $base[ $key ] ) ) {
				$base[ $key ] = self::deep_merge( $base[ $key ], $value );
			} else {
				$base[ $key ] = $value;
			}
		}
		return $base;
	}

	/**
	 * @param array<mixed> $arr
	 */
	private static function is_assoc( array $arr ): bool {
		if ( $arr === array() ) {
			return true;
		}
		return array_keys( $arr ) !== range( 0, count( $arr ) - 1 );
	}
}
