<?php
/**
 * SAP generator execution runner (preflight + client harness contract).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Runner_Sap_Generator {

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

		$payload   = is_array( $context['payload'] ?? null ) ? $context['payload'] : array();
		$sanitized = Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $payload );

		$groups = max( 1, (int) ( $sanitized['entityAdGroupCount'] ?? 1 ) );
		$ads    = max( 1, (int) ( $sanitized['entityAdsPerGroup'] ?? 1 ) );
		$total  = max( 1, (int) ( $sanitized['entityPageCount'] ?? ( $groups * $ads ) ) );
		if ( $total !== ( $groups * $ads ) ) {
			return array( 'ok' => false, 'error' => 'entityPageCount must equal entityAdGroupCount × entityAdsPerGroup.' );
		}

		$csv_input = sanitize_key( (string) ( $sanitized['entityCsvInputSource'] ?? '' ) );
		$has_upload = ! empty( $sanitized['entityCsvUrl'] ) || ! empty( $sanitized['entityCsvBase64'] );
		if ( $csv_input !== 'workflow' && ! $has_upload ) {
			return array( 'ok' => false, 'error' => 'SAP generator requires entityCsvUrl, entityCsvBase64, or entityCsvInputSource workflow.' );
		}

		$execution_id = (int) ( $execution['id'] ?? 0 );
		$contract     = array_merge(
			array(
				'executionId' => $execution_id,
				'siteId'      => $site_id,
			),
			$sanitized
		);

		return array(
			'ok'      => true,
			'status'  => 'awaiting_client',
			'payload' => array(
				'clientRunContract' => $contract,
			),
		);
	}
}
