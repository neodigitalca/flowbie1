<?php
/**
 * Google Ads REST (GAQL search + accessible customers).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Ads_Api {

	const API_VERSION = 'v25';

	/**
	 * @return array{ok:bool,statusCode?:int,error?:string,customerIds?:string[]}
	 */
	public static function list_accessible_customers(): array {
		$auth = self::authorized_headers();
		if ( isset( $auth['error'] ) ) {
			return $auth;
		}
		$url      = 'https://googleads.googleapis.com/' . self::API_VERSION . '/customers:listAccessibleCustomers';
		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 30,
				'headers' => $auth['headers'],
			)
		);
		$parsed = self::parse_response( $response );
		if ( empty( $parsed['ok'] ) ) {
			return $parsed;
		}
		$data = is_array( $parsed['data'] ) ? $parsed['data'] : array();
		$ids  = array();
		$names = isset( $data['resourceNames'] ) && is_array( $data['resourceNames'] ) ? $data['resourceNames'] : array();
		foreach ( $names as $name ) {
			$id = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( (string) $name );
			if ( $id !== '' ) {
				$ids[] = $id;
			}
		}
		return array(
			'ok'          => true,
			'customerIds' => $ids,
		);
	}

	/**
	 * @return array{ok:bool,statusCode?:int,error?:string,results?:array<int,array<string,mixed>>}
	 */
	public static function search( string $customer_id, string $query ): array {
		$customer_id = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( $customer_id );
		if ( $customer_id === '' ) {
			return array( 'ok' => false, 'statusCode' => 400, 'error' => 'Google Ads customer ID is required.' );
		}
		$auth = self::authorized_headers();
		if ( isset( $auth['error'] ) ) {
			return $auth;
		}
		$url     = 'https://googleads.googleapis.com/' . self::API_VERSION . '/customers/' . $customer_id . '/googleAds:search';
		$results = array();
		$token   = '';
		do {
			$payload = array( 'query' => $query );
			if ( $token !== '' ) {
				$payload['pageToken'] = $token;
			}
			$response = wp_remote_post(
				$url,
				array(
					'timeout' => 60,
					'headers' => $auth['headers'],
					'body'    => wp_json_encode( $payload ),
				)
			);
			$parsed = self::parse_response( $response );
			if ( empty( $parsed['ok'] ) ) {
				return $parsed;
			}
			$data = is_array( $parsed['data'] ) ? $parsed['data'] : array();
			$page = isset( $data['results'] ) && is_array( $data['results'] ) ? $data['results'] : array();
			foreach ( $page as $row ) {
				if ( is_array( $row ) ) {
					$results[] = $row;
				}
			}
			$token = isset( $data['nextPageToken'] ) ? trim( (string) $data['nextPageToken'] ) : '';
		} while ( $token !== '' );
		return array(
			'ok'      => true,
			'results' => $results,
		);
	}

	/**
	 * @return array{ok:bool,headers?:array<string,string>,statusCode?:int,error?:string}
	 */
	private static function authorized_headers(): array {
		$token = Neo_Pulse_App_Google_Ads_Tokens::get_valid_access_token();
		if ( is_wp_error( $token ) ) {
			return array( 'ok' => false, 'statusCode' => 401, 'error' => $token->get_error_message() );
		}
		$mcc = Neo_Pulse_App_Google_Ads_Credentials::mcc_id();
		if ( $mcc === '' || strlen( $mcc ) !== 10 ) {
			return array( 'ok' => false, 'statusCode' => 503, 'error' => 'MCC ID is missing. Paste the 10-digit manager customer ID in Google Ads settings.' );
		}
		$headers = array(
			'Authorization'     => 'Bearer ' . $token,
			'login-customer-id' => $mcc,
			'Content-Type'      => 'application/json',
		);
		$developer = Neo_Pulse_App_Google_Ads_Credentials::developer_token();
		if ( $developer !== '' ) {
			$headers['developer-token'] = $developer;
		}
		return array(
			'ok'      => true,
			'headers' => $headers,
		);
	}

	/**
	 * @param array<string,mixed>|WP_Error $response
	 * @return array{ok:bool,statusCode?:int,error?:string,data?:mixed}
	 */
	private static function parse_response( $response ): array {
		if ( is_wp_error( $response ) ) {
			return array( 'ok' => false, 'statusCode' => 502, 'error' => $response->get_error_message() );
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = 'Google Ads API error ' . $code;
			if ( is_array( $data ) ) {
				$error = $data['error'] ?? null;
				if ( is_array( $error ) ) {
					$detail = self::first_ads_failure_message( $error );
					if ( $detail !== '' ) {
						$msg = $detail;
					} elseif ( ! empty( $error['message'] ) ) {
						$msg = (string) $error['message'];
					} elseif ( ! empty( $error['status'] ) ) {
						$msg = (string) $error['status'];
					}
				}
			}
			return array( 'ok' => false, 'statusCode' => $code > 0 ? $code : 502, 'error' => $msg );
		}
		return array( 'ok' => true, 'data' => is_array( $data ) ? $data : array() );
	}

	/**
	 * @param array<string,mixed> $error
	 */
	private static function first_ads_failure_message( array $error ): string {
		$details = isset( $error['details'] ) && is_array( $error['details'] ) ? $error['details'] : array();
		foreach ( $details as $detail ) {
			if ( ! is_array( $detail ) || empty( $detail['errors'] ) || ! is_array( $detail['errors'] ) ) {
				continue;
			}
			foreach ( $detail['errors'] as $item ) {
				if ( is_array( $item ) && ! empty( $item['message'] ) ) {
					return trim( (string) $item['message'] );
				}
			}
		}
		return '';
	}
}
