<?php
/**
 * GMB OAuth token storage (uploads/flowbie-data/gmb-tokens.json).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Gmb_Tokens {

	/**
	 * @return array{access_token:string,refresh_token?:string,expiry_date?:int}|null
	 */
	public static function get_tokens(): ?array {
		$data = Flowbie_App_Json_File_Store::read( Flowbie_App_Data_Paths::gmb_tokens_path() );
		if ( is_array( $data ) && ! empty( $data['access_token'] ) ) {
			return $data;
		}
		$legacy = self::legacy_wp_gmb_tokens();
		if ( is_array( $legacy ) && ! empty( $legacy['access_token'] ) ) {
			self::save_tokens( $legacy );
			return $legacy;
		}
		return null;
	}

	/**
	 * @return array{access_token:string,refresh_token?:string,expiry_date?:int}|null
	 */
	private static function legacy_wp_gmb_tokens(): ?array {
		if ( ! function_exists( 'get_option' ) ) {
			return null;
		}
		$raw = get_option( 'flowbie_wp_gmb_tokens' );
		if ( ! is_array( $raw ) || empty( $raw['access_token'] ) ) {
			return null;
		}
		$expiry = 0;
		if ( ! empty( $raw['expiry_date'] ) ) {
			$expiry = (int) $raw['expiry_date'];
		} elseif ( ! empty( $raw['expires_at'] ) ) {
			$expiry = (int) $raw['expires_at'] * 1000;
		}
		return array(
			'access_token'  => (string) $raw['access_token'],
			'refresh_token' => isset( $raw['refresh_token'] ) ? (string) $raw['refresh_token'] : '',
			'expiry_date'   => $expiry,
		);
	}

	/**
	 * @param array<string,mixed> $tokens
	 */
	public static function save_tokens( array $tokens ): void {
		$existing = self::get_tokens();
		$expiry   = 0;
		if ( ! empty( $tokens['expiry_date'] ) ) {
			$expiry = (int) $tokens['expiry_date'];
		} elseif ( ! empty( $tokens['expires_in'] ) ) {
			$expiry = (int) round( ( microtime( true ) * 1000 ) + ( (int) $tokens['expires_in'] * 1000 ) );
		}
		$store = array(
			'access_token'  => isset( $tokens['access_token'] ) ? (string) $tokens['access_token'] : '',
			'refresh_token' => isset( $tokens['refresh_token'] ) ? (string) $tokens['refresh_token'] : '',
			'expiry_date'   => $expiry,
		);
		if ( $store['refresh_token'] === '' && is_array( $existing ) && ! empty( $existing['refresh_token'] ) ) {
			$store['refresh_token'] = (string) $existing['refresh_token'];
		}
		Flowbie_App_Json_File_Store::write( Flowbie_App_Data_Paths::gmb_tokens_path(), $store );
	}

	/**
	 * @return string|WP_Error
	 */
	public static function get_valid_access_token() {
		$tokens = self::get_tokens();
		if ( ! is_array( $tokens ) || empty( $tokens['access_token'] ) ) {
			return new WP_Error( 'flowbie_gmb_not_connected', 'Not connected. Use Connect Google Business first.' );
		}
		$expiry        = isset( $tokens['expiry_date'] ) ? (int) $tokens['expiry_date'] : 0;
		$now_ms        = (int) round( microtime( true ) * 1000 );
		$needs_refresh = $expiry > 0 && $now_ms >= ( $expiry - 60000 ) && ! empty( $tokens['refresh_token'] );
		if ( ! $needs_refresh ) {
			return (string) $tokens['access_token'];
		}
		$config = Flowbie_App_Gmb_Oauth::load_config_for_tokens();
		$response = wp_remote_post(
			Flowbie_App_Gmb_Oauth::GOOGLE_TOKEN_URL,
			array(
				'timeout' => 20,
				'body'    => array(
					'client_id'     => $config['clientId'],
					'client_secret' => $config['clientSecret'],
					'refresh_token' => (string) $tokens['refresh_token'],
					'grant_type'    => 'refresh_token',
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 || ! is_array( $data ) || empty( $data['access_token'] ) ) {
			$msg = is_array( $data ) && ! empty( $data['error_description'] )
				? (string) $data['error_description']
				: 'Token refresh failed.';
			return new WP_Error( 'flowbie_gmb_refresh', $msg );
		}
		self::save_tokens(
			array(
				'access_token'  => (string) $data['access_token'],
				'refresh_token' => isset( $data['refresh_token'] ) ? (string) $data['refresh_token'] : (string) $tokens['refresh_token'],
				'expires_in'    => isset( $data['expires_in'] ) ? (int) $data['expires_in'] : 3600,
			)
		);
		return (string) $data['access_token'];
	}
}
