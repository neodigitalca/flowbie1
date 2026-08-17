<?php
/**
 * Local Dominator grid export execution runner (preflight + client harness contract).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Runner_Local_Dominator_Export {

	/**
	 * @param array<string,mixed> $task
	 * @param array<string,mixed> $execution
	 * @param array<string,mixed> $context
	 * @return array<string,mixed>
	 */
	public static function run( string $kind, array $task, array $execution, array $context ): array {
		unset( $kind, $task );

		$site_id = trim( (string) ( $context['siteId'] ?? '' ) );
		if ( $site_id === '' ) {
			return array( 'ok' => false, 'error' => 'wordpressSiteId is required.' );
		}

		$site = Neo_Pulse_App_Task_Execution_Site_Resolver::resolve_by_id( $site_id );
		if ( ! $site ) {
			return array( 'ok' => false, 'error' => 'Could not resolve WordPress site from sites.json.' );
		}

		$payload       = is_array( $context['payload'] ?? null ) ? $context['payload'] : array();
		$sanitized     = Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $payload );
		$business_name = trim( (string) ( $sanitized['businessName'] ?? '' ) );
		$keyword       = trim( (string) ( $sanitized['keyword'] ?? '' ) );
		if ( $business_name === '' || $keyword === '' ) {
			return array( 'ok' => false, 'error' => 'businessName and keyword are required.' );
		}

		$save_to_disk = ! array_key_exists( 'saveToDisk', $payload ) || ! empty( $payload['saveToDisk'] );
		$save_local   = ! empty( $sanitized['saveLocalArchive'] )
			|| ! array_key_exists( 'saveLocalArchive', $payload )
			|| ! empty( $payload['saveLocalArchive'] );
		$execution_id = (int) ( $execution['id'] ?? 0 );

		$contract = array_merge(
			array(
				'executionId'      => $execution_id,
				'siteId'           => $site_id,
				'businessName'     => $business_name,
				'keyword'          => $keyword,
				'saveToDisk'       => $save_to_disk,
				'saveLocalArchive' => $save_local,
			),
			Neo_Pulse_App_Tasks_Store::automation_email_contract_fields( $payload )
		);

		if ( class_exists( 'Neo_Pulse_App_Research_Github' ) && Neo_Pulse_App_Research_Github::is_configured() ) {
			$contract['executionMode'] = 'github';
		}

		return array(
			'ok'      => true,
			'status'  => 'awaiting_client',
			'payload' => array(
				'clientRunContract' => $contract,
				'executionMode'     => isset( $contract['executionMode'] ) ? (string) $contract['executionMode'] : null,
			),
		);
	}
}
