<?php
/**
 * WordPress Requests defaults connect_timeout to 10s and never raises it.
 * That aborts GSC, OpenRouter, and Google calls before they connect.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Http_Timeouts {

	const SECONDS = 300;
	const CONNECT_SECONDS = 45;

	public static function init(): void {
		@ini_set( 'default_socket_timeout', (string) self::SECONDS );
		add_filter( 'http_request_timeout', array( self::class, 'floor_timeout' ), 999, 1 );
		add_filter( 'http_request_args', array( self::class, 'floor_request_args' ), 999, 1 );
		add_action( 'http_api_curl', array( self::class, 'apply_curl_timeouts' ), 999, 2 );
		add_action( 'requests-requests.before_request', array( self::class, 'floor_requests_options' ), 999, 5 );
	}

	/**
	 * @param float|int $timeout
	 * @return float
	 */
	public static function floor_timeout( $timeout ) {
		return max( (float) $timeout, (float) self::SECONDS );
	}

	/**
	 * @param float|int $timeout
	 * @return float
	 */
	public static function floor_connect_timeout( $timeout ) {
		return max( (float) $timeout, (float) self::CONNECT_SECONDS );
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>
	 */
	public static function floor_request_args( $args ) {
		if ( ! is_array( $args ) ) {
			return $args;
		}
		$args['timeout']         = self::floor_timeout( $args['timeout'] ?? 0 );
		$args['connect_timeout'] = self::floor_connect_timeout( $args['connect_timeout'] ?? 0 );
		return $args;
	}

	/**
	 * @param mixed               $handle
	 * @param array<string,mixed> $request
	 */
	public static function apply_curl_timeouts( $handle, $request = array() ): void {
		if ( ! is_resource( $handle ) && ! ( is_object( $handle ) && get_class( $handle ) === 'CurlHandle' ) ) {
			return;
		}
		$total   = self::floor_timeout( is_array( $request ) ? ( $request['timeout'] ?? 0 ) : 0 );
		$connect = self::floor_connect_timeout( is_array( $request ) ? ( $request['connect_timeout'] ?? 0 ) : 0 );
		curl_setopt( $handle, CURLOPT_CONNECTTIMEOUT, (int) $connect );
		curl_setopt( $handle, CURLOPT_TIMEOUT, (int) $total );
	}

	/**
	 * @param string               $url
	 * @param array<string,mixed>  $headers
	 * @param mixed                $data
	 * @param string               $type
	 * @param array<string,mixed>  $options
	 */
	public static function floor_requests_options( &$url, &$headers, &$data, &$type, &$options ): void {
		unset( $url, $headers, $data, $type );
		if ( ! is_array( $options ) ) {
			return;
		}
		$options['timeout']         = self::floor_timeout( $options['timeout'] ?? 0 );
		$options['connect_timeout'] = self::floor_connect_timeout( $options['connect_timeout'] ?? 0 );
	}
}
