<?php
/**
 * /api/research-jobs/* route handlers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Research_Route_Handlers {

	/**
	 * @param string              $subpath Route after research-jobs/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'dispatch' && $method === 'POST' ) {
			self::dispatch_job( $body );
			return;
		}

		if ( $subpath === 'callback' && $method === 'POST' ) {
			self::callback( $body );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function dispatch_job( array $body ): void {
		$user = Neo_Pulse_App_Auth_Session::require_user();
		if ( ! $user ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Unauthorized' ), 401 );
			return;
		}

		$team_id = (int) ( $body['teamId'] ?? 0 );
		if ( $team_id <= 0 ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'teamId is required.' ), 400 );
			return;
		}

		$member = Neo_Pulse_App_Teams_Store::get_membership( $team_id, (int) ( $user['id'] ?? 0 ) );
		if ( ! is_array( $member ) || ! Neo_Pulse_App_Tasks_Store::is_active_member( $member ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}

		$job_key      = sanitize_key( (string) ( $body['jobKey'] ?? '' ) );
		$execution_id = (int) ( $body['executionId'] ?? 0 );
		$agent_run_id = (int) ( $body['agentRunId'] ?? 0 );
		$payload      = isset( $body['payload'] ) && is_array( $body['payload'] ) ? $body['payload'] : array();

		if ( $job_key === '' || $execution_id <= 0 ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array( 'ok' => false, 'error' => 'jobKey and executionId are required.' ),
				400
			);
			return;
		}

		$execution = Neo_Pulse_App_Task_Execution_Store::get( $team_id, $execution_id );
		if ( ! $execution ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Execution not found.' ), 404 );
			return;
		}

		$dispatch_payload = array_merge(
			$payload,
			array(
				'teamId'      => $team_id,
				'executionId' => $execution_id,
				'agentRunId'  => $agent_run_id,
			)
		);

		$result = Neo_Pulse_App_Research_Github::dispatch_workflow( $job_key, $dispatch_payload );
		if ( empty( $result['ok'] ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( $result, 400 );
			return;
		}

		Neo_Pulse_App_Task_Execution_Store::update(
			$team_id,
			$execution_id,
			array( 'status' => 'running' )
		);
		Neo_Pulse_App_Task_Execution_Progress::update(
			$team_id,
			$execution_id,
			array(
				'status'  => 'running',
				'message' => 'Running on GitHub Actions…',
			)
		);

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'     => true,
				'status' => 'running',
			)
		);
	}

	/**
	 * @param array<string,mixed> $body Parsed JSON (may be replaced by raw verify).
	 */
	private static function callback( array $body ): void {
		$raw_body = file_get_contents( 'php://input' );
		if ( ! is_string( $raw_body ) || $raw_body === '' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Empty body.' ), 400 );
			return;
		}

		$header = isset( $_SERVER['HTTP_X_NEO_PULSE_RESEARCH_SIGNATURE'] )
			? (string) wp_unslash( $_SERVER['HTTP_X_NEO_PULSE_RESEARCH_SIGNATURE'] )
			: '';

		if ( ! Neo_Pulse_App_Research_Job_Callback::verify_signature( $raw_body, $header ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Invalid signature.' ), 403 );
			return;
		}

		$data = json_decode( $raw_body, true );
		if ( ! is_array( $data ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Invalid JSON.' ), 400 );
			return;
		}

		$result = Neo_Pulse_App_Research_Job_Callback::handle( $data );
		Neo_Pulse_App_Api_Dispatcher::send_json( $result, ! empty( $result['ok'] ) ? 200 : 400 );
	}
}
