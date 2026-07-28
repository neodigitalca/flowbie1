<?php
/**
 * POST /api/grid-local/maps-serp-batch
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Grid_Local_Route_Handlers {

	/**
	 * @param string              $subpath Route after grid-local/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'maps-serp-batch' && $method === 'POST' ) {
			try {
				Flowbie_App_Api_Dispatcher::send_json( Flowbie_App_Grid_Local_Maps_Dfs::run( $body ) );
			} catch ( Exception $e ) {
				$msg  = $e->getMessage() ?: 'Grid Local Maps scan failed';
				$code = ( strpos( $msg, 'required' ) !== false || strpos( $msg, 'Maximum' ) !== false ) ? 400 : 500;
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => $msg ), $code );
			}
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}
}
