<?php
/**
 * REST handlers for /api/google-ads/*.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Ads_Route_Handlers {

	/**
	 * @param array<string,mixed> $body
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'config-status' && $method === 'GET' ) {
			if ( ! headers_sent() ) {
				header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0' );
				header( 'Pragma: no-cache' );
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Google_Ads_Oauth::config_status() );
			return;
		}

		if ( $subpath === 'test-and-save' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Ads_Oauth::test_and_save( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'authorize' && $method === 'GET' ) {
			Neo_Pulse_App_Google_Ads_Oauth::authorize_redirect();
			return;
		}

		if ( $subpath === 'callback' && $method === 'GET' ) {
			$query = array();
			foreach ( array( 'code', 'error', 'state' ) as $key ) {
				if ( isset( $_GET[ $key ] ) ) {
					$query[ $key ] = sanitize_text_field( wp_unslash( (string) $_GET[ $key ] ) );
				}
			}
			Neo_Pulse_App_Google_Ads_Oauth::handle_callback( $query );
			return;
		}

		if ( $subpath === 'status' && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Google_Ads_Oauth::connection_status() );
			return;
		}

		if ( $subpath === 'test' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Ads_Oauth::test_connection();
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'fetch-reporting-bundle' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Ads_Reporting_Bundle::fetch_reporting_bundle( $body );
			$status = ! empty( $result['success'] ) ? 200 : (int) ( $result['statusCode'] ?? 502 );
			unset( $result['statusCode'] );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result, $status );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'error' => 'Not found',
				'path'  => 'google-ads/' . $subpath,
			),
			404
		);
	}
}
