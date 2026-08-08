<?php
/**
 * REST API for Chekkit contact submissions from the chat sidebar.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Chekkit_Rest {

	const REST_NAMESPACE = 'flowbie/v1';

	const RATE_LIMIT_MAX = 10;

	const RATE_LIMIT_TTL = 60;

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/chekkit/contact',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle_contact' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function handle_contact( WP_REST_Request $request ): WP_REST_Response {
		if ( ! Flowbie_Wp_Chekkit::is_configured() ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => __( 'Contact requests are not available right now.', 'flowbie-wp' ),
				),
				503
			);
		}

		$nonce = $request->get_header( 'X-WP-Nonce' );
		if ( ! is_string( $nonce ) || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => __( 'Invalid security token. Please refresh the page.', 'flowbie-wp' ),
				),
				403
			);
		}

		$input = self::collect_input( $request );

		$honeypot = isset( $input['flowbie_hp'] ) ? trim( (string) $input['flowbie_hp'] ) : '';
		if ( $honeypot !== '' ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => __( 'Submission rejected.', 'flowbie-wp' ),
				),
				400
			);
		}

		$ip = self::client_ip();
		if ( ! self::check_rate_limit( $ip ) ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => __( 'Too many submissions. Please wait a moment and try again.', 'flowbie-wp' ),
				),
				429
			);
		}

		$errors = Flowbie_Wp_Chekkit::validate_contact_input( $input );
		if ( null !== $errors ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => __( 'Please correct the errors below.', 'flowbie-wp' ),
					'errors'  => $errors,
				),
				400
			);
		}

		$settings   = Flowbie_Wp_Chat::get_settings();
		$event_type = isset( $settings['chekkit_event_type'] ) ? (string) $settings['chekkit_event_type'] : 'contact_request';
		$payload    = Flowbie_Wp_Chekkit::build_payload( $input, $event_type );

		$result = Flowbie_Wp_Chekkit::send_contact( $payload );
		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => __( 'Unable to send your request. Please try again later.', 'flowbie-wp' ),
				),
				502
			);
		}

		return new WP_REST_Response(
			array(
				'success' => true,
				'message' => __( "Thanks! We'll be in touch soon.", 'flowbie-wp' ),
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return array<string,mixed>
	 */
	private static function collect_input( WP_REST_Request $request ): array {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = array();
		}
		return $params;
	}

	private static function client_ip(): string {
		$ip = '';
		if ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
			$parts = explode( ',', (string) wp_unslash( $_SERVER['HTTP_X_FORWARDED_FOR'] ) );
			$ip    = trim( $parts[0] );
		} elseif ( ! empty( $_SERVER['REMOTE_ADDR'] ) ) {
			$ip = (string) wp_unslash( $_SERVER['REMOTE_ADDR'] );
		}
		return sanitize_text_field( $ip );
	}

	private static function check_rate_limit( string $ip ): bool {
		if ( $ip === '' ) {
			return true;
		}
		$key   = 'flowbie_chekkit_rl_' . md5( $ip );
		$count = (int) get_transient( $key );
		if ( $count >= self::RATE_LIMIT_MAX ) {
			return false;
		}
		set_transient( $key, $count + 1, self::RATE_LIMIT_TTL );
		return true;
	}
}
