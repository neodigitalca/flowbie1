<?php
/**
 * File-backed manager settings (workspace JSON on the API server).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Manager_Route_Handlers {

	private static function file_store_status(): array {
		return array(
			'ok'                  => true,
			'workspaceConfigured' => true,
			'urlHost'             => null,
			'canAutoCreateTable'  => false,
		);
	}

	/**
	 * @param string              $subpath Route after manager-cloud-settings/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_cloud( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );
		$path    = Neo_Pulse_App_Data_Paths::manager_settings_path();

		if ( $subpath === 'status' && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( self::file_store_status() );
			return;
		}

		if ( $subpath === 'save' && $method === 'POST' ) {
			$snapshot = isset( $body['snapshot'] ) ? $body['snapshot'] : null;
			$updated  = gmdate( 'c' );
			Neo_Pulse_App_Json_File_Store::write(
				$path,
				array(
					'snapshot'  => $snapshot,
					'updatedAt' => $updated,
				)
			);
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'updatedAt' => $updated ) );
			return;
		}

		if ( $subpath === 'load' && $method === 'GET' ) {
			$data = Neo_Pulse_App_Json_File_Store::read( $path );
			if ( ! is_array( $data ) ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'snapshot' => null, 'updatedAt' => null ) );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'        => true,
					'snapshot'  => $data['snapshot'] ?? null,
					'updatedAt' => $data['updatedAt'] ?? null,
				)
			);
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param string              $subpath Route after manager-wordpress-properties/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_properties( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'status' && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( self::file_store_status() );
			return;
		}

		if ( $subpath === 'save' && $method === 'POST' ) {
			$sites = isset( $body['sites'] ) && is_array( $body['sites'] ) ? $body['sites'] : array();
			Neo_Pulse_App_Sites_Sync::save_mirror( $sites );
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'count' => count( $sites ) ) );
			return;
		}

		if ( $subpath === 'load' && $method === 'GET' ) {
			$data  = Neo_Pulse_App_Sites_Sync::load_mirror();
			$sites = is_array( $data ) && isset( $data['sites'] ) && is_array( $data['sites'] ) ? $data['sites'] : array();
			$tokens = array();
			foreach ( $sites as $site ) {
				if ( ! is_array( $site ) ) {
					continue;
				}
				if ( ! empty( $site['pluginAccessToken'] ) && ! empty( $site['id'] ) ) {
					$tokens[] = array(
						'siteId'             => (string) $site['id'],
						'pluginAccessToken'  => (string) $site['pluginAccessToken'],
					);
				}
			}
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'     => true,
					'sites'  => $sites,
					'tokens' => $tokens,
				)
			);
			return;
		}

		if ( $subpath === 'sync-openrouter' && $method === 'POST' ) {
			$openrouter = isset( $body['openRouterApiKey'] ) ? trim( (string) $body['openRouterApiKey'] ) : '';
			if ( $openrouter !== '' && class_exists( 'Neo_Pulse_Wp_Api' ) ) {
				Neo_Pulse_Wp_Api::save_agency_openrouter_api_key( $openrouter );
			}
			if ( $openrouter !== '' ) {
				$keys_path = Neo_Pulse_App_Data_Paths::root() . '/email-worker-keys.json';
				$existing  = Neo_Pulse_App_Json_File_Store::read( $keys_path );
				if ( ! is_array( $existing ) ) {
					$existing = array();
				}
				$existing['openRouterApiKey'] = $openrouter;
				$existing['updatedAt']        = gmdate( 'c' );
				Neo_Pulse_App_Json_File_Store::write( $keys_path, $existing );
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'updated' => $openrouter !== '' ? 1 : 0 ) );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}
}
