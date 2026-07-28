<?php
/**
 * /api/integrations/* handlers.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Integrations_Route_Handlers {

	/**
	 * @param string              $subpath Route after integrations/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'sync-wordpress-sites' && $method === 'POST' ) {
			$sites = isset( $body['sites'] ) && is_array( $body['sites'] ) ? $body['sites'] : array();
			$opts  = array();
			if ( isset( $body['activeSiteId'] ) && is_string( $body['activeSiteId'] ) ) {
				$opts['activeSiteId'] = trim( $body['activeSiteId'] );
			}
			try {
				$result = Flowbie_App_Sites_Sync::save_mirror( $sites, $opts );
				Flowbie_App_Api_Dispatcher::send_json( $result );
			} catch ( Exception $e ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => $e->getMessage() ), 500 );
			}
			return;
		}

		if ( $subpath === 'sync-active-wp-site' && $method === 'POST' ) {
			$id = isset( $body['activeSiteId'] ) && is_string( $body['activeSiteId'] ) ? trim( $body['activeSiteId'] ) : '';
			try {
				$result = Flowbie_App_Sites_Sync::save_active_site_id( $id !== '' ? $id : null );
				Flowbie_App_Api_Dispatcher::send_json( $result );
			} catch ( Exception $e ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => $e->getMessage() ), 500 );
			}
			return;
		}

		if ( $subpath === 'sync-email-worker-keys' && $method === 'POST' ) {
			$keys_path = Flowbie_App_Data_Paths::root() . '/email-worker-keys.json';
			Flowbie_App_Json_File_Store::write(
				$keys_path,
				array(
					'agentmailApiKey'  => isset( $body['agentmailApiKey'] ) ? (string) $body['agentmailApiKey'] : '',
					'openRouterApiKey' => isset( $body['openRouterApiKey'] ) ? (string) $body['openRouterApiKey'] : '',
					'updatedAt'        => gmdate( 'c' ),
				)
			);
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Not found', 'path' => 'integrations/' . $subpath ), 404 );
	}
}
