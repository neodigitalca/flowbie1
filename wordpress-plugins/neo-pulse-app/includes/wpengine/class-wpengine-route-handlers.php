<?php
/**
 * /api/wpengine/* handlers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Wpengine_Route_Handlers {

	/**
	 * @param string              $subpath Route after wpengine/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'catalog/status' && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array_merge(
					array( 'ok' => true ),
					Neo_Pulse_App_Wpengine_Catalog::status()
				)
			);
			return;
		}

		if ( $subpath === 'catalog/sync' && $method === 'POST' ) {
			self::require_user();
			$rows = isset( $body['rows'] ) && is_array( $body['rows'] ) ? $body['rows'] : null;
			if ( $rows === null ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Missing rows array' ), 400 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Wpengine_Catalog::save_rows( $rows ) );
			return;
		}

		if ( $subpath === 'matches' && $method === 'POST' ) {
			self::require_user();
			$host_keys = array();
			if ( isset( $body['hostKeys'] ) && is_array( $body['hostKeys'] ) ) {
				foreach ( $body['hostKeys'] as $key ) {
					if ( is_string( $key ) && trim( $key ) !== '' ) {
						$host_keys[] = trim( $key );
					}
				}
			}
			$prefer_staging = ! empty( $body['preferStaging'] );
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'matches' => Neo_Pulse_App_Wpengine_Catalog::match_host_keys( $host_keys, $prefer_staging ),
				)
			);
			return;
		}

		if ( $subpath === 'deploy-plugin' && $method === 'POST' ) {
			self::require_user();
			@set_time_limit( 300 );
			$host = isset( $body['host'] ) ? trim( (string) $body['host'] ) : '';
			$user = isset( $body['username'] ) ? trim( (string) $body['username'] ) : '';
			$pass = isset( $body['password'] ) ? (string) $body['password'] : '';
			if ( $host === '' || $user === '' || $pass === '' ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Missing SFTP host, username, or password' ), 400 );
				return;
			}
			$row = array(
				'host'     => $host,
				'port'     => isset( $body['port'] ) && is_numeric( $body['port'] ) ? (int) $body['port'] : 2222,
				'username' => $user,
				'password' => $pass,
				'site'     => isset( $body['site'] ) ? trim( (string) $body['site'] ) : '',
			);
			$result = Neo_Pulse_App_Wpengine_Sftp_Deploy::deploy_neo_pulse_wp( $row );
			$code   = ! empty( $result['ok'] ) ? 200 : 500;
			Neo_Pulse_App_Api_Dispatcher::send_json( $result, $code );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}

	private static function require_user(): void {
		$user = Neo_Pulse_App_Auth_Session::require_user();
		if ( $user === null ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Unauthorized' ), 401 );
			exit;
		}
	}
}