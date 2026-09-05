<?php
/**
 * POST /api/proxy/fetch-text (https URL body, server-side).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Url_Text_Proxy {

	const MAX_BYTES = 8388608;

	/**
	 * @param string              $subpath Path after proxy/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		if ( $subpath === 'fetch-text' && $method === 'POST' ) {
			self::fetch_text( $body );
			return;
		}
		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'    => false,
				'error' => 'Not found',
				'path'  => 'proxy/' . $subpath,
			),
			404
		);
	}

	/**
	 * @param array<string,mixed> $body Request JSON.
	 */
	public static function fetch_text( array $body ): void {
		$url = isset( $body['url'] ) ? trim( (string) $body['url'] ) : '';
		$check = self::validate_http_url( $url );
		if ( $check !== null ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => $check ), 400 );
			return;
		}

		$response = wp_remote_get(
			$url,
			array(
				'timeout'     => 30,
				'redirection' => 3,
				'headers'     => array(
					'User-Agent' => 'NEO Pulse/1.0 (url text proxy; +https://neodigital.ca/neo-pulse/)',
					'Accept'     => 'text/*,application/json,application/csv,*/*;q=0.8',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array( 'ok' => false, 'error' => $response->get_error_message() ),
				502
			);
			return;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$text = (string) wp_remote_retrieve_body( $response );
		if ( $code < 200 || $code >= 300 ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array( 'ok' => false, 'error' => 'Failed to fetch URL (' . $code . ')' ),
				502
			);
			return;
		}
		if ( strlen( $text ) > self::MAX_BYTES ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array( 'ok' => false, 'error' => 'URL response too large' ),
				413
			);
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'      => true,
				'content' => $text,
			)
		);
	}

	private static function validate_http_url( string $url ): ?string {
		if ( $url === '' || ! preg_match( '#^https://#i', $url ) ) {
			return 'url must be an https URL';
		}
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) || empty( $parts['host'] ) ) {
			return 'url host is invalid';
		}
		$host = strtolower( (string) $parts['host'] );
		if ( $host === 'localhost' || $host === '127.0.0.1' || $host === '0.0.0.0' || $host === '::1' || $host === '[::1]' ) {
			return 'url host is not allowed';
		}
		if ( preg_match( '/^(10\.|192\.168\.|169\.254\.)/', $host ) ) {
			return 'url host is not allowed';
		}
		if ( preg_match( '/^172\.(1[6-9]|2[0-9]|3[0-1])\./', $host ) ) {
			return 'url host is not allowed';
		}
		return null;
	}
}
