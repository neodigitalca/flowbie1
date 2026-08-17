<?php
/**
 * Signed callback from GitHub Actions research jobs.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Research_Job_Callback {

	public static function verify_signature( string $raw_body, string $header ): bool {
		$secret = Neo_Pulse_App_Research_Github::callback_secret();
		if ( $secret === '' || $raw_body === '' ) {
			return false;
		}
		$expected = 'sha256=' . hash_hmac( 'sha256', $raw_body, $secret );
		return hash_equals( $expected, trim( $header ) );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function handle( array $body ): array {
		$team_id      = (int) ( $body['teamId'] ?? 0 );
		$execution_id = (int) ( $body['executionId'] ?? 0 );
		$agent_run_id = (int) ( $body['agentRunId'] ?? 0 );
		$ok           = ! empty( $body['ok'] );

		if ( $team_id <= 0 || $execution_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'teamId and executionId are required.' );
		}

		$execution = Neo_Pulse_App_Task_Execution_Store::get( $team_id, $execution_id );
		if ( ! $execution ) {
			return array( 'ok' => false, 'error' => 'Execution not found.' );
		}

		if ( $ok ) {
			$complete_body = array(
				'ok'     => true,
				'result' => is_array( $body['result'] ?? null ) ? $body['result'] : array(),
			);
			if ( $agent_run_id > 0 ) {
				$complete_body['agentRunId'] = $agent_run_id;
			}
			if ( ! empty( $body['archiveFiles'] ) && is_array( $body['archiveFiles'] ) ) {
				$complete_body['archiveFiles'] = $body['archiveFiles'];
			}

			$result = Neo_Pulse_App_Task_Execution_Coordinator::complete( $team_id, $execution_id, $complete_body );
			if ( empty( $result['ok'] ) ) {
				return array(
					'ok'    => false,
					'error' => (string) ( $result['error'] ?? 'Could not complete execution.' ),
				);
			}

			if ( $agent_run_id > 0 ) {
				self::mark_agent_run_done( $team_id, $agent_run_id, $body );
			}

			return array( 'ok' => true );
		}

		$error = sanitize_text_field( (string) ( $body['error'] ?? 'Research job failed.' ) );
		Neo_Pulse_App_Task_Execution_Coordinator::complete(
			$team_id,
			$execution_id,
			array(
				'ok'    => false,
				'error' => $error,
			)
		);

		if ( $agent_run_id > 0 ) {
			Neo_Pulse_App_Agent_Runs_Store::patch_run(
				$team_id,
				$agent_run_id,
				array(
					'status'       => 'failed',
					'errorMessage' => $error,
					'step'         => array(
						'label'  => $error,
						'status' => 'error',
					),
				)
			);
		}

		return array( 'ok' => true );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function mark_agent_run_done( int $team_id, int $agent_run_id, array $body ): void {
		$result = is_array( $body['result'] ?? null ) ? $body['result'] : array();
		$message = 'Research export completed';
		if ( ! empty( $result['fileName'] ) ) {
			$message = 'Exported ' . (string) $result['fileName'];
		}

		Neo_Pulse_App_Agent_Runs_Store::patch_run(
			$team_id,
			$agent_run_id,
			array(
				'status' => 'done',
				'result' => array(
					'updated' => 1,
					'message' => $message,
				),
				'step'   => array(
					'label'  => 'Complete',
					'status' => 'done',
				),
			)
		);
	}
}
