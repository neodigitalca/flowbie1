<?php
/**
 * REST API for form submissions.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Forms_Rest {

	const REST_NAMESPACE = 'neo-pulse/v1';

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/forms/(?P<id>\d+)/submit',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle_submit' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'id' => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function handle_submit( WP_REST_Request $request ) {
		$form_id = (int) $request->get_param( 'id' );
		$nonce   = $request->get_header( 'X-NEO Pulse-Form-Nonce' );
		if ( ! $nonce ) {
			$nonce = $request->get_param( '_wpnonce' );
		}
		if ( ! is_string( $nonce ) || ! wp_verify_nonce( $nonce, 'neo-pulse_form_submit_' . $form_id ) ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => __( 'Invalid security token. Please refresh the page.', 'neo-pulse-wp' ),
				),
				403
			);
		}

		$input = self::collect_input( $request );
		$files = Neo_Pulse_Wp_Forms_Submit::normalize_files();

		$result = Neo_Pulse_Wp_Forms_Submit::process(
			$form_id,
			$input,
			array(
				'source_url'           => isset( $input['source_url'] ) ? esc_url_raw( (string) $input['source_url'] ) : ( isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( (string) $_SERVER['HTTP_REFERER'] ) ) : '' ),
				'overseer_session_id'  => isset( $input['overseer_session_id'] ) ? sanitize_text_field( (string) $input['overseer_session_id'] ) : '',
				'overseer_visit_uid'   => isset( $input['overseer_visit_uid'] ) ? sanitize_text_field( (string) $input['overseer_visit_uid'] ) : '',
			),
			$files
		);

		$status = ! empty( $result['success'] ) ? 200 : 400;
		return new WP_REST_Response( $result, $status );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return array<string, mixed>
	 */
	private static function collect_input( WP_REST_Request $request ): array {
		$input = array();
		$sources = array( $request->get_body_params(), $_POST );
		foreach ( $sources as $body ) {
			if ( ! is_array( $body ) ) {
				continue;
			}
			foreach ( $body as $key => $value ) {
				$key = sanitize_key( (string) $key );
				if ( $key === '' ) {
					continue;
				}
				if ( is_array( $value ) ) {
					$input[ $key ] = array_map(
						static function ( $v ) {
							return sanitize_text_field( (string) $v );
						},
						$value
					);
				} else {
					$input[ $key ] = is_string( $value ) ? wp_unslash( $value ) : $value;
				}
			}
		}
		return $input;
	}
}
