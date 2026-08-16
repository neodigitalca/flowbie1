<?php
/**
 * /api/push/* route handlers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Push_Route_Handlers {

	/**
	 * @param string              $subpath Route after push/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		Neo_Pulse_App_Push_Device_Store::install_tables();
		Neo_Pulse_App_Push_Preferences::install_tables();

		$user = Neo_Pulse_App_Auth_Session::require_user();
		if ( ! $user ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Unauthorized' ), 401 );
			return;
		}

		$user_id = (int) ( $user['id'] ?? 0 );
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'devices' && $method === 'POST' ) {
			self::register_device( $body, $user_id );
			return;
		}

		if ( $subpath === 'devices' && $method === 'DELETE' ) {
			self::unregister_device( $body, $user_id );
			return;
		}

		if ( $subpath === 'preferences' && $method === 'GET' ) {
			self::get_preferences( $user_id );
			return;
		}

		if ( $subpath === 'preferences' && $method === 'PATCH' ) {
			self::patch_preferences( $body, $user_id );
			return;
		}

		if ( $subpath === 'actions' && $method === 'GET' ) {
			self::list_actions();
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function register_device( array $body, int $user_id ): void {
		$token = sanitize_text_field( (string) ( $body['token'] ?? '' ) );
		if ( $token === '' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'token required' ), 400 );
			return;
		}
		$platform = sanitize_key( (string) ( $body['platform'] ?? 'android' ) );
		$device   = Neo_Pulse_App_Push_Device_Store::register_device(
			$user_id,
			$token,
			$platform,
			(string) ( $body['deviceLabel'] ?? $body['device_label'] ?? '' ),
			(string) ( $body['appVersion'] ?? $body['app_version'] ?? '' )
		);
		if ( ! $device ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not register device' ), 400 );
			return;
		}
		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'     => true,
				'device' => $device,
			)
		);
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function unregister_device( array $body, int $user_id ): void {
		$token = sanitize_text_field( (string) ( $body['token'] ?? '' ) );
		if ( $token === '' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'token required' ), 400 );
			return;
		}
		Neo_Pulse_App_Push_Device_Store::unregister_device( $user_id, $token );
		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
	}

	private static function get_preferences( int $user_id ): void {
		$team_id = self::resolve_team_id();
		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'           => true,
				'preferences'  => Neo_Pulse_App_Push_Preferences::get_for_user( $user_id, $team_id ),
				'actions'      => array_values( Neo_Pulse_App_Push_Notification_Actions::catalog() ),
			)
		);
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function patch_preferences( array $body, int $user_id ): void {
		$patch = isset( $body['preferences'] ) && is_array( $body['preferences'] ) ? $body['preferences'] : $body;
		$team_id = self::resolve_team_id();
		$prefs = Neo_Pulse_App_Push_Preferences::patch_for_user( $user_id, $team_id, $patch );
		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'          => true,
				'preferences' => $prefs,
			)
		);
	}

	private static function list_actions(): void {
		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'      => true,
				'actions' => array_values( Neo_Pulse_App_Push_Notification_Actions::catalog() ),
			)
		);
	}

	private static function resolve_team_id(): int {
		if ( isset( $_GET['teamId'] ) ) {
			return (int) wp_unslash( $_GET['teamId'] );
		}
		$active = Neo_Pulse_App_Auth_Session::active_team_id();
		return $active > 0 ? $active : 0;
	}
}
