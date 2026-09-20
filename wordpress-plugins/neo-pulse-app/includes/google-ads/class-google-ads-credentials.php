<?php
/**
 * Google Ads developer token and customer ID helpers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Ads_Credentials {

	public static function developer_token(): string {
		return Neo_Pulse_App_Secrets::google_ads_developer_token();
	}

	public static function mcc_id(): string {
		return Neo_Pulse_App_Secrets::google_ads_mcc_id();
	}

	/**
	 * @return array{ok:bool,error?:string}
	 */
	public static function save_api_credentials( string $developer_token, string $mcc_id ): array {
		$token = trim( $developer_token );
		$mcc   = self::normalize_customer_id( $mcc_id );
		if ( $mcc === '' || strlen( $mcc ) !== 10 ) {
			return array( 'ok' => false, 'error' => 'MCC ID must be the 10-digit manager customer ID.' );
		}
		$existing = Neo_Pulse_App_Json_File_Store::read( Neo_Pulse_App_Data_Paths::google_ads_api_path() );
		if ( ! is_array( $existing ) ) {
			$existing = array();
		}
		$existing['developerToken'] = $token;
		$existing['mccId']          = $mcc;
		$written                    = Neo_Pulse_App_Json_File_Store::write( Neo_Pulse_App_Data_Paths::google_ads_api_path(), $existing );
		if ( ! $written ) {
			return array( 'ok' => false, 'error' => 'Could not write Google Ads API credentials.' );
		}
		return array( 'ok' => true );
	}

	public static function save_developer_token( string $token ): bool {
		$saved = self::save_api_credentials( $token, self::mcc_id() );
		return ! empty( $saved['ok'] );
	}

	public static function normalize_customer_id( string $raw ): string {
		return preg_replace( '/\D+/', '', trim( $raw ) ) ?? '';
	}

	public static function validate_ymd( string $raw ): string {
		$raw = trim( $raw );
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $raw ) ) {
			return '';
		}
		$parts = explode( '-', $raw );
		if ( ! checkdate( (int) $parts[1], (int) $parts[2], (int) $parts[0] ) ) {
			return '';
		}
		return $raw;
	}
}
