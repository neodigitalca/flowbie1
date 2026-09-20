<?php
/**
 * Ads reporting execution runner (preflight + client harness contract).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Runner_Ads_Reporting {

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

		$customer_id = preg_replace( '/\D+/', '', (string) ( $site['googleAdsCustomerId'] ?? '' ) ) ?? '';
		if ( strlen( $customer_id ) !== 10 ) {
			return array( 'ok' => false, 'error' => 'Set a 10-digit Google Ads customer ID on this property.' );
		}

		if ( Neo_Pulse_App_Google_Ads_Credentials::mcc_id() === '' ) {
			return array( 'ok' => false, 'error' => 'Google Ads MCC ID is missing.' );
		}
		if ( ! Neo_Pulse_App_Google_Ads_Tokens::has_refresh_token() ) {
			return array( 'ok' => false, 'error' => 'Connect Google Ads in Dashboard → Google Services.' );
		}

		$payload        = is_array( $context['payload'] ?? null ) ? $context['payload'] : array();
		$sanitized      = Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $payload );
		$preset_id      = sanitize_key( (string) ( $sanitized['gscComparePresetId'] ?? $sanitized['comparePreset'] ?? 'mom' ) );
		$compare_preset = $preset_id === 'yoy' ? 'yoy' : 'mom';
		$save_to_disk   = ! array_key_exists( 'saveToDisk', $payload ) || ! empty( $payload['saveToDisk'] );
		$save_local     = ! empty( $sanitized['saveLocalArchive'] )
			|| ! array_key_exists( 'saveLocalArchive', $payload )
			|| ! empty( $payload['saveLocalArchive'] )
			|| ! empty( $sanitized['saveToGoogleDrive'] );
		$execution_id   = (int) ( $execution['id'] ?? 0 );

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
		$contract = array_merge( $contract, Neo_Pulse_App_Tasks_Store::google_drive_contract_fields( $payload ) );
		if ( in_array( $preset_id, Neo_Pulse_App_Tasks_Store::gsc_compare_preset_ids(), true ) ) {
			$contract['gscComparePresetId'] = $preset_id;
		}
		$trailing_count = Neo_Pulse_App_Tasks_Store::sanitize_gsc_trailing_month_count( $sanitized['gscTrailingMonthCount'] ?? $payload['gscTrailingMonthCount'] ?? null );
		if ( $trailing_count !== null ) {
			$contract['gscTrailingMonthCount'] = $trailing_count;
		}
		if ( ! empty( $sanitized['gscCompareRanges'] ) && is_array( $sanitized['gscCompareRanges'] ) ) {
			$contract['gscCompareRanges'] = $sanitized['gscCompareRanges'];
		}

		return array(
			'ok'      => true,
			'status'  => 'awaiting_client',
			'payload' => array(
				'clientRunContract' => $contract,
			),
		);
	}
}
