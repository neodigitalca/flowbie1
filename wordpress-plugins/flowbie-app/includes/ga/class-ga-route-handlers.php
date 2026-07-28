<?php
/**
 * REST route handlers for /api/ga/* (Node-compatible JSON shapes).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Ga_Route_Handlers {

	/**
	 * HTTP dispatch from Flowbie_App_Api_Dispatcher.
	 *
	 * @param string              $subpath Route after ga/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'credentials-status' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json( Flowbie_App_Ga_Credentials::credentials_status() );
			return;
		}

		if ( $subpath === 'test' && $method === 'POST' ) {
			$result = Flowbie_App_Ga_Credentials::test( $body );
			Flowbie_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'test-and-save' && $method === 'POST' ) {
			$result = Flowbie_App_Ga_Credentials::test_and_save( $body );
			Flowbie_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'report-data' && $method === 'POST' ) {
			$result = Flowbie_App_Ga_Api::report_data( $body );
			Flowbie_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json(
			array(
				'error' => 'Not found',
				'path'  => 'ga/' . $subpath,
			),
			404
		);
	}
}
