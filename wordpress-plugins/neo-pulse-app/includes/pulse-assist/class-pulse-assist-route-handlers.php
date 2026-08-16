<?php
/**
 * /api/pulse-assist/* route handlers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Route_Handlers {

	/**
	 * @param string              $subpath Route after pulse-assist/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		self::send_no_cache_headers();
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		$user = Neo_Pulse_App_Auth_Session::require_user();
		if ( ! $user ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Unauthorized' ), 401 );
			return;
		}

		if ( $subpath === 'ack' && $method === 'POST' ) {
			$history = isset( $body['history'] ) && is_array( $body['history'] ) ? $body['history'] : array();
			list( $status, $data ) = Neo_Pulse_App_Pulse_Assist_Secretary::ack( $body, $history );
			Neo_Pulse_App_Api_Dispatcher::send_json( $data, $status );
			return;
		}

		if ( $subpath === 'stream' && $method === 'POST' ) {
			self::stream_live( $body );
			return;
		}

		if ( $subpath === '' && $method === 'POST' ) {
			list( $status, $data ) = Neo_Pulse_App_Pulse_Assist_Ask::assist( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $data, $status );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 */
	private static function stream_live( array $body ): void {
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}

		status_header( 200 );
		header( 'Content-Type: application/x-ndjson' );

		$emit = static function ( array $payload ): void {
			echo wp_json_encode( $payload ) . "\n";
			if ( function_exists( 'ob_flush' ) ) {
				@ob_flush();
			}
			flush();
		};

		try {
			Neo_Pulse_App_Pulse_Assist_Ask::stream_live( $body, $emit );
		} catch ( Exception $e ) {
			$emit(
				array(
					'status' => 'done',
					'card'   => array(
						'type'       => 'error',
						'title'      => 'NEO Pulse Assist error',
						'body'       => $e->getMessage(),
						'confidence' => 'low',
					),
				)
			);
		}
	}

	private static function send_no_cache_headers(): void {
		if ( headers_sent() ) {
			return;
		}
		header( 'Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0' );
		header( 'Pragma: no-cache' );
		header( 'Expires: 0' );
		header( 'Vary: Authorization, Cookie', false );
		header( 'X-WPE-No-Cache: 1' );
	}
}
