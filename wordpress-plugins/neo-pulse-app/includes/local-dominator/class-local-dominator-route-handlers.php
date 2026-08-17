<?php
/**
 * POST /api/local-dominator/export-grid
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Local_Dominator_Route_Handlers {

	/**
	 * @param string              $subpath Route after local-dominator/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'export-grid' && $method === 'POST' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Local_Dominator_Export::export_grid( $body ) );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}
}
