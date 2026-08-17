<?php
/**
 * GSC reporting execution runner (preflight + client harness contract).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Runner_Gsc_Reporting {

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

		$public_url = self::public_site_url( $site );
		if ( $public_url === '' ) {
			return array( 'ok' => false, 'error' => 'Set a public site URL for this property.' );
		}

		if ( ! class_exists( 'Neo_Pulse_App_Gsc_Service_Account' ) ) {
			return array( 'ok' => false, 'error' => 'GSC service account is not available.' );
		}

		$match = Neo_Pulse_App_Gsc_Service_Account::find_matching_property( $public_url );
		if ( empty( $match['match'] ) ) {
			return array( 'ok' => false, 'error' => 'GSC is not connected for ' . $public_url . '.' );
		}

		$payload         = is_array( $context['payload'] ?? null ) ? $context['payload'] : array();
		$sanitized       = Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $payload );
		$compare_preset  = self::sanitize_compare_preset( $payload['comparePreset'] ?? 'mom' );
		$save_to_disk    = ! array_key_exists( 'saveToDisk', $payload ) || ! empty( $payload['saveToDisk'] );
		$save_local      = ! empty( $sanitized['saveLocalArchive'] )
			|| ! array_key_exists( 'saveLocalArchive', $payload )
			|| ! empty( $payload['saveLocalArchive'] );
		$execution_id    = (int) ( $execution['id'] ?? 0 );

		$contract = array_merge(
			array(
				'executionId'      => $execution_id,
				'siteId'           => $site_id,
				'comparePreset'    => $compare_preset,
				'saveToDisk'       => $save_to_disk,
				'saveLocalArchive' => $save_local,
			),
			Neo_Pulse_App_Tasks_Store::automation_email_contract_fields( $payload )
		);

		return array(
			'ok'      => true,
			'status'  => 'awaiting_client',
			'payload' => array(
				'clientRunContract' => $contract,
			),
		);
	}

	/**
	 * @param array<string,mixed> $site
	 */
	private static function public_site_url( array $site ): string {
		$production = trim( (string) ( $site['productionSiteUrl'] ?? '' ) );
		if ( $production !== '' ) {
			return rtrim( $production, '/' );
		}
		return rtrim( (string) ( $site['siteUrl'] ?? '' ), '/' );
	}

	/**
	 * @param mixed $raw
	 */
	private static function sanitize_compare_preset( $raw ): string {
		$preset = sanitize_key( (string) $raw );
		return $preset === 'yoy' ? 'yoy' : 'mom';
	}
}
