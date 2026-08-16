<?php
/**
 * FCM HTTP v1 push dispatcher.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Push_Dispatcher {

	private static $access_token = null;
	private static $access_token_expires = 0;

	/**
	 * @param array<string,mixed> $context
	 */
	public static function send_action( int $user_id, int $team_id, string $action_id, array $context ): void {
		if ( $user_id <= 0 || $team_id <= 0 || ! Neo_Pulse_App_Push_Notification_Actions::is_valid( $action_id ) ) {
			return;
		}
		if ( ! Neo_Pulse_App_Push_Preferences::should_send( $user_id, $team_id, $action_id ) ) {
			return;
		}

		$context['teamId'] = $team_id;
		$notification      = Neo_Pulse_App_Push_Notification_Actions::build_notification( $action_id, $context );
		if ( ! $notification ) {
			return;
		}

		$devices = Neo_Pulse_App_Push_Device_Store::list_for_user( $user_id );
		if ( count( $devices ) === 0 ) {
			return;
		}

		foreach ( $devices as $device ) {
			$token = (string) ( $device['token'] ?? '' );
			if ( $token === '' ) {
				continue;
			}
			$result = self::send_to_token(
				$token,
				(string) $notification['title'],
				(string) $notification['body'],
				is_array( $notification['data'] ) ? $notification['data'] : array()
			);
			if ( $result === 'invalid_token' ) {
				Neo_Pulse_App_Push_Device_Store::delete_token( $token );
			}
		}
	}

	/**
	 * @param array<string,string> $data
	 * @return 'ok'|'invalid_token'|'failed'
	 */
	private static function send_to_token( string $token, string $title, string $body, array $data ): string {
		$service = self::service_account();
		if ( ! $service ) {
			return 'failed';
		}

		$access_token = self::get_access_token( $service );
		if ( $access_token === '' ) {
			return 'failed';
		}

		$project_id = (string) ( $service['project_id'] ?? '' );
		if ( $project_id === '' ) {
			return 'failed';
		}

		$string_data = array();
		foreach ( $data as $key => $value ) {
			$string_data[ (string) $key ] = (string) $value;
		}

		$payload = array(
			'message' => array(
				'token'        => $token,
				'notification' => array(
					'title' => $title,
					'body'  => $body,
				),
				'data'         => $string_data,
				'android'      => array(
					'priority'     => 'HIGH',
					'notification' => array(
						'channel_id' => 'neo_pulse_default',
					),
				),
			),
		);

		$response = wp_remote_post(
			'https://fcm.googleapis.com/v1/projects/' . rawurlencode( $project_id ) . '/messages:send',
			array(
				'timeout' => 15,
				'headers' => array(
					'Authorization' => 'Bearer ' . $access_token,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $payload ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return 'failed';
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( $code >= 200 && $code < 300 ) {
			return 'ok';
		}

		$raw = (string) wp_remote_retrieve_body( $response );
		if ( self::is_invalid_token_response( $raw, $code ) ) {
			return 'invalid_token';
		}

		return 'failed';
	}

	private static function is_invalid_token_response( string $raw, int $code ): bool {
		if ( $code === 404 ) {
			return true;
		}
		if ( $code !== 400 && $code !== 403 ) {
			return false;
		}
		$decoded = json_decode( $raw, true );
		if ( ! is_array( $decoded ) ) {
			return false;
		}
		$error = is_array( $decoded['error'] ?? null ) ? $decoded['error'] : array();
		$status = strtoupper( (string) ( $error['status'] ?? '' ) );
		$message = strtolower( wp_json_encode( $error ) );
		if ( $status === 'NOT_FOUND' ) {
			return true;
		}
		return str_contains( $message, 'notregistered' )
			|| str_contains( $message, 'registration token' )
			|| str_contains( $message, 'invalid argument' );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function service_account(): ?array {
		$json = Neo_Pulse_App_Secrets::fcm_service_account_json();
		if ( $json === '' ) {
			return null;
		}
		$decoded = json_decode( $json, true );
		return is_array( $decoded ) ? $decoded : null;
	}

	/**
	 * @param array<string,mixed> $service
	 */
	private static function get_access_token( array $service ): string {
		$now = time();
		if ( self::$access_token && self::$access_token_expires > ( $now + 60 ) ) {
			return self::$access_token;
		}

		$client_email = (string) ( $service['client_email'] ?? '' );
		$private_key  = (string) ( $service['private_key'] ?? '' );
		if ( $client_email === '' || $private_key === '' ) {
			return '';
		}

		$jwt = self::build_jwt(
			$client_email,
			$private_key,
			'https://oauth2.googleapis.com/token',
			'https://www.googleapis.com/auth/firebase.messaging',
			$now
		);
		if ( $jwt === '' ) {
			return '';
		}

		$response = wp_remote_post(
			'https://oauth2.googleapis.com/token',
			array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/x-www-form-urlencoded' ),
				'body'    => array(
					'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
					'assertion'  => $jwt,
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return '';
		}

		$decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $decoded ) || empty( $decoded['access_token'] ) ) {
			return '';
		}

		self::$access_token         = (string) $decoded['access_token'];
		self::$access_token_expires = $now + (int) ( $decoded['expires_in'] ?? 3600 );
		return self::$access_token;
	}

	private static function build_jwt(
		string $client_email,
		string $private_key,
		string $token_uri,
		string $scope,
		int $now
	): string {
		$header  = self::base64url_encode( wp_json_encode( array( 'alg' => 'RS256', 'typ' => 'JWT' ) ) );
		$claims  = array(
			'iss'   => $client_email,
			'scope' => $scope,
			'aud'   => $token_uri,
			'exp'   => $now + 3600,
			'iat'   => $now,
		);
		$payload = self::base64url_encode( wp_json_encode( $claims ) );
		$input   = $header . '.' . $payload;

		$signature = '';
		$key       = openssl_pkey_get_private( $private_key );
		if ( ! $key ) {
			return '';
		}
		$signed = openssl_sign( $input, $signature, $key, OPENSSL_ALGO_SHA256 );
		openssl_pkey_free( $key );
		if ( ! $signed ) {
			return '';
		}

		return $input . '.' . self::base64url_encode( $signature );
	}

	private static function base64url_encode( string $data ): string {
		return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
	}
}
