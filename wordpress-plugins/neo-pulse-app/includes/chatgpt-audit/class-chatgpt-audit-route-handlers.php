<?php
/**
 * POST /api/chatgpt-audit/jobs
 * GET  /api/chatgpt-audit/jobs/{jobId}
 * POST /api/chatgpt-audit/jobs/{jobId}/queries
 * POST /api/chatgpt-audit/jobs/{jobId}/finish
 * POST /api/chatgpt-audit/jobs/{jobId}/cancel
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_ChatGpt_Audit_Route_Handlers {

	/**
	 * @param string              $subpath Route after chatgpt-audit/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'jobs' && $method === 'POST' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_ChatGpt_Audit::start_job_from_body( $body ) );
			return;
		}

		if ( preg_match( '#^jobs/([a-f0-9-]{8,64})$#', $subpath, $matches ) && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_ChatGpt_Audit::read_job_progress( $matches[1] ) );
			return;
		}

		if ( preg_match( '#^jobs/([a-f0-9-]{8,64})/queries$#', $subpath, $matches ) && $method === 'POST' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_ChatGpt_Audit::append_query( $matches[1], $body ) );
			return;
		}

		if ( preg_match( '#^jobs/([a-f0-9-]{8,64})/new-chat$#', $subpath, $matches ) && $method === 'POST' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_ChatGpt_Audit::start_new_chat( $matches[1], $body ) );
			return;
		}

		if ( preg_match( '#^jobs/([a-f0-9-]{8,64})/finish$#', $subpath, $matches ) && $method === 'POST' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_ChatGpt_Audit::finish_job( $matches[1] ) );
			return;
		}

		if ( preg_match( '#^jobs/([a-f0-9-]{8,64})/cancel$#', $subpath, $matches ) && $method === 'POST' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_ChatGpt_Audit::cancel_job( $matches[1] ) );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}
}
