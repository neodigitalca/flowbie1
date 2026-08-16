<?php
/**
 * REST route handlers for /api/ga/* (Node-compatible JSON shapes).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Ga_Route_Handlers {

	/**
	 * HTTP dispatch from Neo_Pulse_App_Api_Dispatcher.
	 *
	 * @param string              $subpath Route after ga/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'credentials-status' && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Ga_Credentials::credentials_status() );
			return;
		}

		if ( $subpath === 'test' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Ga_Credentials::test( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'test-and-save' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Ga_Credentials::test_and_save( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'report-data' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Ga_Api::report_data( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'error' => 'Not found',
				'path'  => 'ga/' . $subpath,
			),
			404
		);
	}
}
