<?php
/**
 * Google Analytics 4 Admin/Data API calls.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Ga_Api {

	const SCOPE_READONLY = 'https://www.googleapis.com/auth/analytics.readonly';
	const TOKEN_URL      = 'https://oauth2.googleapis.com/token';
	const ADMIN_BASE     = 'https://analyticsadmin.googleapis.com/v1beta';
	const DATA_BASE      = 'https://analyticsdata.googleapis.com/v1beta';

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function report_data( array $body ): array {
		$property_id = isset( $body['propertyId'] ) ? trim( (string) $body['propertyId'] ) : '';
		if ( $property_id === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'Missing or invalid propertyId' ),
			);
		}
		foreach ( array( 'startDate', 'endDate', 'compareStartDate', 'compareEndDate' ) as $field ) {
			if ( empty( $body[ $field ] ) ) {
				return array(
					'statusCode' => 400,
					'body'       => array(
						'success' => false,
						'error'   => 'Missing date fields: startDate, endDate, compareStartDate, compareEndDate',
					),
				);
			}
		}

		$resolved = Flowbie_App_Ga_Credentials::resolve_from_body( $body );
		if ( ! empty( $resolved['error'] ) ) {
			return array(
				'statusCode' => (int) ( $resolved['status'] ?? 503 ),
				'body'       => array( 'success' => false, 'error' => $resolved['error'] ),
			);
		}

		$credentials = $resolved['credentials'];
		$prop_id     = preg_replace( '/^properties\/?/i', '', $property_id );
		$result      = array( 'success' => true, 'propertyId' => $prop_id );
		$filter      = array(
			'filter' => array(
				'fieldName'    => 'sessionDefaultChannelGroup',
				'stringFilter' => array( 'matchType' => 'EXACT', 'value' => 'Organic Search' ),
			),
		);
		$current     = array( 'startDate' => (string) $body['startDate'], 'endDate' => (string) $body['endDate'] );
		$compare     = array(
			'startDate' => (string) $body['compareStartDate'],
			'endDate'   => (string) $body['compareEndDate'],
		);
		$base        = array(
			'dimensions'      => array( array( 'name' => 'sessionDefaultChannelGroup' ) ),
			'dimensionFilter' => $filter,
		);

		self::merge_period_metric( $result, 'conversions', $credentials, $prop_id, $base, $current, $compare, 'conversions' );
		self::merge_period_metric( $result, 'organicTraffic', $credentials, $prop_id, $base, $current, $compare, 'sessions', true );

		return array( 'statusCode' => 200, 'body' => $result );
	}

	/**
	 * @param array<string,string> $credentials
	 * @return array<string,mixed>|WP_Error
	 */
	public static function list_account_summaries( array $credentials ) {
		$token = self::get_access_token( $credentials );
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		$response = wp_remote_get(
			self::ADMIN_BASE . '/accountSummaries',
			array(
				'timeout' => 45,
				'headers' => array(
					'Authorization' => 'Bearer ' . $token,
					'Accept'        => 'application/json',
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: ( $raw !== '' ? $raw : 'HTTP ' . $code );
			return new WP_Error( 'flowbie_ga_admin', $msg, array( 'status' => $code ) );
		}
		return is_array( $data ) ? $data : array();
	}

	/**
	 * @param array<string,string> $credentials
	 * @param array<string,mixed>  $payload
	 * @return array<string,mixed>|WP_Error
	 */
	public static function run_report( array $credentials, string $property_id, array $payload ) {
		$token = self::get_access_token( $credentials );
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		$url      = self::DATA_BASE . '/properties/' . rawurlencode( $property_id ) . ':runReport';
		$response = wp_remote_post(
			$url,
			array(
				'timeout' => 60,
				'headers' => array(
					'Authorization' => 'Bearer ' . $token,
					'Content-Type'  => 'application/json',
					'Accept'        => 'application/json',
				),
				'body'    => wp_json_encode( $payload ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: ( $raw !== '' ? $raw : 'HTTP ' . $code );
			return new WP_Error( 'flowbie_ga_report', $msg, array( 'status' => $code ) );
		}
		return is_array( $data ) ? $data : array();
	}

	public static function map_error_status( WP_Error $error ): int {
		$msg    = $error->get_error_message();
		$status = (int) ( $error->get_error_data()['status'] ?? 0 );
		if ( $status === 403 || stripos( $msg, 'PERMISSION_DENIED' ) !== false ) {
			return 403;
		}
		if ( $status === 404 || stripos( $msg, 'NOT_FOUND' ) !== false ) {
			return 404;
		}
		return 502;
	}

	/**
	 * @param array<string,mixed>  $result
	 * @param array<string,string> $credentials
	 * @param array<string,mixed>  $base
	 * @param array<string,string> $current
	 * @param array<string,string> $compare
	 */
	private static function merge_period_metric(
		array &$result,
		string $key,
		array $credentials,
		string $prop_id,
		array $base,
		array $current,
		array $compare,
		string $metric,
		bool $sessions_shape = false
	): void {
		$cur = self::run_report(
			$credentials,
			$prop_id,
			array_merge( $base, array( 'dateRanges' => array( $current ), 'metrics' => array( array( 'name' => $metric ) ) ) )
		);
		$prev = self::run_report(
			$credentials,
			$prop_id,
			array_merge( $base, array( 'dateRanges' => array( $compare ), 'metrics' => array( array( 'name' => $metric ) ) ) )
		);
		if ( is_wp_error( $cur ) || is_wp_error( $prev ) ) {
			return;
		}
		$current_total  = self::sum_metric_rows( $cur );
		$previous_total = self::sum_metric_rows( $prev );
		$change         = $current_total - $previous_total;
		if ( $sessions_shape ) {
			$result[ $key ] = array(
				'sessionsCurrent'  => $current_total,
				'sessionsPrevious' => $previous_total,
				'change'           => $change,
				'changePercent'    => $previous_total > 0 ? (int) round( ( $change / $previous_total ) * 100 ) : null,
			);
			return;
		}
		$result[ $key ] = array(
			'current'       => $current_total,
			'previous'      => $previous_total,
			'change'        => $change,
			'changePercent' => $previous_total > 0 ? (int) round( ( $change / $previous_total ) * 100 ) : null,
		);
	}

	/**
	 * @param array<string,mixed> $response
	 */
	private static function sum_metric_rows( array $response ): float {
		$total = 0.0;
		$rows  = isset( $response['rows'] ) && is_array( $response['rows'] ) ? $response['rows'] : array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$values = isset( $row['metricValues'] ) && is_array( $row['metricValues'] ) ? $row['metricValues'] : array();
			if ( ! empty( $values[0]['value'] ) ) {
				$total += (float) $values[0]['value'];
			}
		}
		return $total;
	}

	/**
	 * @param array<string,string> $credentials
	 * @return string|WP_Error
	 */
	private static function get_access_token( array $credentials ) {
		$scope     = self::SCOPE_READONLY;
		$cache_key = 'flowbie_app_ga_token_' . md5( $credentials['client_email'] . '|' . $scope );
		$cached    = get_transient( $cache_key );
		if ( is_string( $cached ) && $cached !== '' ) {
			return $cached;
		}
		$jwt = self::build_jwt( $credentials['client_email'], $credentials['private_key'], $scope );
		if ( is_wp_error( $jwt ) ) {
			return $jwt;
		}
		$response = wp_remote_post(
			self::TOKEN_URL,
			array(
				'timeout' => 30,
				'headers' => array( 'Content-Type' => 'application/x-www-form-urlencoded' ),
				'body'    => array(
					'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
					'assertion'  => $jwt,
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
				: 'Could not obtain GA access token.';
			return new WP_Error( 'flowbie_ga_token', $msg );
		}
		$token = (string) $data['access_token'];
		set_transient( $cache_key, $token, 3000 );
		return $token;
	}

	/**
	 * @return string|WP_Error
	 */
	private static function build_jwt( string $client_email, string $private_key, string $scope ) {
		$now    = time();
		$header = self::b64( wp_json_encode( array( 'alg' => 'RS256', 'typ' => 'JWT' ) ) );
		$claim  = self::b64(
			wp_json_encode(
				array(
					'iss'   => $client_email,
					'scope' => $scope,
					'aud'   => self::TOKEN_URL,
					'exp'   => $now + 3600,
					'iat'   => $now,
				)
			)
		);
		$input = $header . '.' . $claim;
		$key   = openssl_pkey_get_private( $private_key );
		if ( false === $key ) {
			return new WP_Error( 'flowbie_ga_key', 'Could not read GA service account private key.' );
		}
		$signature = '';
		$signed    = openssl_sign( $input, $signature, $key, OPENSSL_ALGO_SHA256 );
		if ( function_exists( 'openssl_free_key' ) ) {
			openssl_free_key( $key );
		}
		if ( ! $signed ) {
			return new WP_Error( 'flowbie_ga_sign', 'Could not sign GA JWT.' );
		}
		return $input . '.' . self::b64( $signature );
	}

	private static function b64( string $data ): string {
		return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
	}
}
