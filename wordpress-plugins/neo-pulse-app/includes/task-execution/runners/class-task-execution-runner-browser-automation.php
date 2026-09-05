<?php
/**
 * Browser automation execution runner (preflight + client harness contract).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Runner_Browser_Automation {

	/**
	 * @param array<string,mixed> $task
	 * @param array<string,mixed> $execution
	 * @param array<string,mixed> $context
	 * @return array<string,mixed>
	 */
	public static function run( string $kind, array $task, array $execution, array $context ): array {
		unset( $kind, $task );

		$site_id = trim( (string) ( $context['siteId'] ?? '' ) );

		$payload      = is_array( $context['payload'] ?? null ) ? $context['payload'] : array();
		$sanitized    = Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $payload );
		$target_url   = trim( (string) ( $sanitized['targetUrl'] ?? '' ) );
		$instructions = trim( (string) ( $sanitized['browserInstructionsHtml'] ?? '' ) );
		if ( $target_url === '' ) {
			return array( 'ok' => false, 'error' => 'targetUrl is required.' );
		}
		if ( $instructions === '' ) {
			return array( 'ok' => false, 'error' => 'Browser instructions are required.' );
		}

		$save_to_disk = ! array_key_exists( 'saveToDisk', $payload ) || ! empty( $payload['saveToDisk'] );
		$save_local   = ! empty( $sanitized['saveLocalArchive'] )
			|| ! array_key_exists( 'saveLocalArchive', $payload )
			|| ! empty( $payload['saveLocalArchive'] )
			|| ! empty( $sanitized['saveToGoogleDrive'] );
		$execution_id = (int) ( $execution['id'] ?? 0 );

		$contract = array(
			'executionId'             => $execution_id,
			'targetUrl'               => $target_url,
			'browserInstructionsHtml' => $instructions,
			'saveToDisk'              => $save_to_disk,
			'saveLocalArchive'        => $save_local,
		);
		if ( $site_id !== '' ) {
			$contract['siteId'] = $site_id;
		}
		$contract = array_merge(
			$contract,
			Neo_Pulse_App_Tasks_Store::automation_email_contract_fields( $payload )
		);
		$contract = array_merge( $contract, Neo_Pulse_App_Tasks_Store::google_drive_contract_fields( $payload ) );

		return array(
			'ok'      => true,
			'status'  => 'awaiting_client',
			'payload' => array(
				'clientRunContract' => $contract,
			),
		);
	}
}
