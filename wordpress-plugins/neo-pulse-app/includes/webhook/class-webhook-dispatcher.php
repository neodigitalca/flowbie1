<?php
/**
 * Early /webhook dispatcher (Chekkit messaging + contact hub).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Webhook_Dispatcher {

	public static function init(): void {
		add_action( 'parse_request', array( __CLASS__, 'maybe_dispatch' ), 0 );
	}

	/**
	 * @param WP $wp WordPress environment.
	 */
	public static function maybe_dispatch( $wp ): void {
		unset( $wp );
		if ( self::request_path() === null ) {
			return;
		}
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}

		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : 'GET';
		$body   = self::read_json_body();
		Neo_Pulse_App_Chekkit_Webhook::handle( $method, $body );
		exit;
	}

	private static function request_path(): ?string {
		$uri  = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$path = (string) parse_url( $uri, PHP_URL_PATH );
		if ( $path === '/webhook' || $path === '/webhook/' ) {
			return $path;
		}
		return null;
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function read_json_body(): array {
		$raw = file_get_contents( 'php://input' );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return array();
		}
		$data = json_decode( $raw, true );
		return is_array( $data ) ? $data : array();
	}
}
