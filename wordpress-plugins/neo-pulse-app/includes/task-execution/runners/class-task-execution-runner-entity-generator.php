<?php
/**
 * Entity generator execution runner (preflight + client harness contract).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Runner_Entity_Generator {

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

		$payload     = is_array( $context['payload'] ?? null ) ? $context['payload'] : array();
		$sanitized   = Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $payload );
		$grid_input  = sanitize_key( (string) ( $sanitized['gridInputSource'] ?? '' ) );
		$focus       = trim( (string) ( $sanitized['focusKeyword'] ?? '' ) );
		if ( $focus === '' && $grid_input !== 'workflow' ) {
			return array( 'ok' => false, 'error' => 'executionPayload.focusKeyword is required.' );
		}

		$groups = max( 1, (int) ( $sanitized['entityAdGroupCount'] ?? 1 ) );
		$ads    = max( 1, (int) ( $sanitized['entityAdsPerGroup'] ?? 1 ) );
		$total  = max( 1, (int) ( $sanitized['entityPageCount'] ?? ( $groups * $ads ) ) );
		if ( $total !== ( $groups * $ads ) ) {
			return array( 'ok' => false, 'error' => 'entityPageCount must equal entityAdGroupCount × entityAdsPerGroup.' );
		}

		if ( $grid_input !== 'workflow' ) {
			return array( 'ok' => false, 'error' => 'Grid CSV must come from an upstream workflow agent (gridInputSource workflow).' );
		}

		$sanitized['locationSource'] = 'grid';
		$sanitized['gridInputSource'] = 'workflow';

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
