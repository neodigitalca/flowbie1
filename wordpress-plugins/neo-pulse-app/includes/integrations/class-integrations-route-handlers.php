<?php
/**
 * /api/integrations/* handlers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Integrations_Route_Handlers {

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
				$result = Neo_Pulse_App_Sites_Sync::save_mirror( $sites, $opts );
				Neo_Pulse_App_Api_Dispatcher::send_json( $result );
			} catch ( Exception $e ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => $e->getMessage() ), 500 );
			}
			return;
		}

		if ( $subpath === 'sync-active-wp-site' && $method === 'POST' ) {
			$id = isset( $body['activeSiteId'] ) && is_string( $body['activeSiteId'] ) ? trim( $body['activeSiteId'] ) : '';
			try {
				$result = Neo_Pulse_App_Sites_Sync::save_active_site_id( $id !== '' ? $id : null );
				Neo_Pulse_App_Api_Dispatcher::send_json( $result );
			} catch ( Exception $e ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => $e->getMessage() ), 500 );
			}
			return;
		}

		if ( $subpath === 'sync-email-worker-keys' && $method === 'POST' ) {
			$openrouter = isset( $body['openRouterApiKey'] ) ? trim( (string) $body['openRouterApiKey'] ) : '';
			$keys_path  = Neo_Pulse_App_Data_Paths::root() . '/email-worker-keys.json';
			Neo_Pulse_App_Json_File_Store::write(
				$keys_path,
				array(
					'agentmailApiKey'  => isset( $body['agentmailApiKey'] ) ? (string) $body['agentmailApiKey'] : '',
					'openRouterApiKey' => $openrouter,
					'updatedAt'        => gmdate( 'c' ),
				)
			);
			if ( $openrouter !== '' && class_exists( 'Neo_Pulse_Wp_Api' ) ) {
				Neo_Pulse_Wp_Api::save_agency_openrouter_api_key( $openrouter );
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found', 'path' => 'integrations/' . $subpath ), 404 );
	}
}
