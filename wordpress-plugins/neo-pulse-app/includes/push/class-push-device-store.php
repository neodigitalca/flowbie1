<?php
/**
 * Push device token storage.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Push_Device_Store {

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$table   = $wpdb->prefix . 'neo_pulse_push_devices';

		dbDelta(
			"CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				user_id bigint(20) unsigned NOT NULL,
				platform varchar(16) NOT NULL DEFAULT 'android',
				token varchar(512) NOT NULL,
				device_label varchar(191) NOT NULL DEFAULT '',
				app_version varchar(64) NOT NULL DEFAULT '',
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				UNIQUE KEY user_token (user_id, token(191)),
				KEY token_lookup (token(191))
			) {$charset};"
		);
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function register_device(
		int $user_id,
		string $token,
		string $platform,
		string $device_label = '',
		string $app_version = ''
	): ?array {
		global $wpdb;
		if ( $user_id <= 0 || $token === '' ) {
			return null;
		}

		self::install_tables();
		$table    = $wpdb->prefix . 'neo_pulse_push_devices';
		$platform = in_array( $platform, array( 'android', 'ios', 'web' ), true ) ? $platform : 'android';
		$now      = current_time( 'mysql', true );

		$existing = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT id FROM {$table} WHERE user_id = %d AND token = %s LIMIT 1",
				$user_id,
				$token
			),
			ARRAY_A
		);

		if ( is_array( $existing ) ) {
			$wpdb->update(
				$table,
				array(
					'platform'     => $platform,
					'device_label' => sanitize_text_field( $device_label ),
					'app_version'  => sanitize_text_field( $app_version ),
					'updated_at'   => $now,
				),
				array( 'id' => (int) $existing['id'] ),
				array( '%s', '%s', '%s', '%s' ),
				array( '%d' )
			);
		} else {
			$wpdb->insert(
				$table,
				array(
					'user_id'      => $user_id,
					'platform'     => $platform,
					'token'        => $token,
					'device_label' => sanitize_text_field( $device_label ),
					'app_version'  => sanitize_text_field( $app_version ),
					'updated_at'   => $now,
				),
				array( '%d', '%s', '%s', '%s', '%s', '%s' )
			);
		}

		return array(
			'userId'   => $user_id,
			'platform' => $platform,
			'token'    => $token,
		);
	}

	public static function unregister_device( int $user_id, string $token ): bool {
		global $wpdb;
		if ( $user_id <= 0 || $token === '' ) {
			return false;
		}
		self::install_tables();
		$table = $wpdb->prefix . 'neo_pulse_push_devices';
		$wpdb->delete(
			$table,
			array(
				'user_id' => $user_id,
				'token'   => $token,
			),
			array( '%d', '%s' )
		);
		return true;
	}

	public static function delete_token( string $token ): void {
		global $wpdb;
		if ( $token === '' ) {
			return;
		}
		self::install_tables();
		$table = $wpdb->prefix . 'neo_pulse_push_devices';
		$wpdb->delete( $table, array( 'token' => $token ), array( '%s' ) );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_for_user( int $user_id ): array {
		global $wpdb;
		if ( $user_id <= 0 ) {
			return array();
		}
		self::install_tables();
		$table = $wpdb->prefix . 'neo_pulse_push_devices';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, user_id, platform, token, device_label, app_version, updated_at
				FROM {$table} WHERE user_id = %d ORDER BY updated_at DESC",
				$user_id
			),
			ARRAY_A
		);
		return is_array( $rows ) ? $rows : array();
	}
}
