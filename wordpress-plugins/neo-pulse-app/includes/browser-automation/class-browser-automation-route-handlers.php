<?php
/**
 * POST /api/browser-automation/jobs
 * GET  /api/browser-automation/jobs/{jobId}
 * POST /api/browser-automation/jobs/{jobId}/cancel
 * GET  /api/residential-proxy/status
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Browser_Automation_Route_Handlers {

	/**
	 * @param string              $subpath Route after browser-automation/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'jobs' && $method === 'POST' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Browser_Automation::start_job_from_body( $body ) );
			return;
		}

		if ( preg_match( '#^jobs/([a-f0-9-]{8,64})$#', $subpath, $matches ) && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Browser_Automation::read_job_progress( $matches[1] ) );
			return;
		}

		if ( preg_match( '#^jobs/([a-f0-9-]{8,64})/cancel$#', $subpath, $matches ) && $method === 'POST' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Browser_Automation::cancel_job( $matches[1] ) );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param string $method HTTP method.
	 */
	public static function dispatch_proxy_status( string $method ): void {
		if ( strtoupper( $method ) !== 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
			return;
		}
		$probe = isset( $_GET['probe'] ) && (string) $_GET['probe'] === '1';
		Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Browser_Automation::proxy_status( $probe ) );
	}
}
