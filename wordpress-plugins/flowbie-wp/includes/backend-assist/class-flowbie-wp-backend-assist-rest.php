<?php
/**
 * Backend Assist — REST route registration and entrypoints
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Rest {

	public static function register_routes(): void {
		$admin_perm = function () {
			return current_user_can( 'edit_posts' );
		};

		register_rest_route( Flowbie_Wp_Backend_Assist_Context::REST_NAMESPACE, '/backend-assist', array(
			'methods'             => 'POST',
			'callback'            => array( 'Flowbie_Wp_Backend_Assist', 'rest_handle' ),
			'permission_callback' => $admin_perm,
		) );

		register_rest_route( Flowbie_Wp_Backend_Assist_Context::REST_NAMESPACE, '/backend-assist/step', array(
			'methods'             => 'POST',
			'callback'            => array( 'Flowbie_Wp_Backend_Assist', 'rest_step_handle' ),
			'permission_callback' => $admin_perm,
		) );

		register_rest_route( Flowbie_Wp_Backend_Assist_Context::REST_NAMESPACE, '/backend-assist/workflow/(?P<workflow_id>[a-zA-Z0-9_]+)/status', array(
			'methods'             => 'GET',
			'callback'            => array( 'Flowbie_Wp_Backend_Assist', 'rest_workflow_status' ),
			'permission_callback' => $admin_perm,
		) );

		register_rest_route( Flowbie_Wp_Backend_Assist_Context::REST_NAMESPACE, '/backend-assist/sessions', array(
			array(
				'methods'             => 'GET',
				'callback'            => array( 'Flowbie_Wp_Backend_Assist', 'rest_sessions_list' ),
				'permission_callback' => $admin_perm,
			),
			array(
				'methods'             => 'POST',
				'callback'            => array( 'Flowbie_Wp_Backend_Assist', 'rest_sessions_save' ),
				'permission_callback' => $admin_perm,
			),
			array(
				'methods'             => 'DELETE',
				'callback'            => array( 'Flowbie_Wp_Backend_Assist', 'rest_sessions_clear' ),
				'permission_callback' => $admin_perm,
			),
		) );

		register_rest_route( Flowbie_Wp_Backend_Assist_Context::REST_NAMESPACE, '/backend-assist/sessions/(?P<id>[a-zA-Z0-9_-]+)', array(
			array(
				'methods'             => 'GET',
				'callback'            => array( 'Flowbie_Wp_Backend_Assist', 'rest_session_get' ),
				'permission_callback' => $admin_perm,
			),
			array(
				'methods'             => 'DELETE',
				'callback'            => array( 'Flowbie_Wp_Backend_Assist', 'rest_session_delete' ),
				'permission_callback' => $admin_perm,
			),
		) );
	}
	public static function rest_handle( WP_REST_Request $request ): WP_REST_Response {
		$api_key = Flowbie_Wp_OpenRouter::get_api_key();
		if ( $api_key === '' ) {
			return new WP_REST_Response(
				array( 'error' => __( 'OpenRouter API key is not configured.', 'flowbie-wp' ) ),
				503
			);
		}

		$body    = $request->get_json_params();
		$message = isset( $body['message'] ) ? sanitize_textarea_field( wp_unslash( $body['message'] ) ) : '';
		$history = Flowbie_Wp_Backend_Assist_Cards::normalize_history( isset( $body['history'] ) && is_array( $body['history'] ) ? $body['history'] : array() );
		$mode    = isset( $body['mode'] ) ? sanitize_text_field( $body['mode'] ) : '';

		if ( trim( $message ) === '' ) {
			return new WP_REST_Response(
				array( 'error' => __( 'Message cannot be empty.', 'flowbie-wp' ) ),
				400
			);
		}

		$builder_ctx = isset( $body['builder_context'] ) && is_array( $body['builder_context'] ) ? $body['builder_context'] : null;
		Flowbie_Wp_Backend_Assist_Context::$builder_context = $builder_ctx;

		if ( $mode === 'plan' ) {
			$card = Flowbie_Wp_Backend_Assist_Pipeline::run_plan( $message, $history );
		} else {
			$card = Flowbie_Wp_Backend_Assist_Pipeline::run_pipeline( $message, $history );
		}

		Flowbie_Wp_Backend_Assist_Context::$builder_context = null;

		return new WP_REST_Response( $card, 200 );
	}
	public static function rest_step_handle( WP_REST_Request $request ): WP_REST_Response {
		$api_key = Flowbie_Wp_OpenRouter::get_api_key();
		if ( $api_key === '' ) {
			return new WP_REST_Response(
				array( 'error' => __( 'OpenRouter API key is not configured.', 'flowbie-wp' ) ),
				503
			);
		}

		$body         = $request->get_json_params();
		$workflow_id  = isset( $body['workflow_id'] ) ? sanitize_text_field( $body['workflow_id'] ) : '';
		$step_index   = isset( $body['step_index'] ) ? absint( $body['step_index'] ) : 0;
		$message      = isset( $body['message'] ) ? sanitize_textarea_field( wp_unslash( $body['message'] ) ) : '';
		$history      = Flowbie_Wp_Backend_Assist_Cards::normalize_history( isset( $body['history'] ) && is_array( $body['history'] ) ? $body['history'] : array() );

		if ( $workflow_id === '' ) {
			return new WP_REST_Response( array( 'error' => __( 'workflow_id is required.', 'flowbie-wp' ) ), 400 );
		}

		$builder_ctx = isset( $body['builder_context'] ) && is_array( $body['builder_context'] ) ? $body['builder_context'] : null;
		Flowbie_Wp_Backend_Assist_Context::$builder_context = $builder_ctx;

		$result = Flowbie_Wp_Backend_Assist_Workflow::execute_workflow_step( $workflow_id, $step_index, $message, $history );

		Flowbie_Wp_Backend_Assist_Context::$builder_context = null;

		if ( isset( $result['error'] ) ) {
			$code = isset( $result['http_status'] ) ? (int) $result['http_status'] : 400;
			unset( $result['http_status'] );
			return new WP_REST_Response( $result, $code );
		}

		return new WP_REST_Response( $result, 200 );
	}
	public static function rest_workflow_status( WP_REST_Request $request ): WP_REST_Response {
		$workflow_id = sanitize_text_field( (string) $request->get_param( 'workflow_id' ) );
		$workflow    = Flowbie_Wp_Backend_Assist_Workflow::load_workflow( $workflow_id );

		if ( null === $workflow ) {
			return new WP_REST_Response(
				array( 'error' => __( 'Workflow not found.', 'flowbie-wp' ) ),
				404
			);
		}

		$outline_titles = array();
		if ( ! empty( $workflow['outline'] ) && is_array( $workflow['outline'] ) ) {
			foreach ( $workflow['outline'] as $sec ) {
				if ( is_array( $sec ) && ! empty( $sec['title'] ) ) {
					$outline_titles[] = (string) $sec['title'];
				}
			}
		}

		return new WP_REST_Response(
			array(
				'steps'          => Flowbie_Wp_Backend_Assist_Workflow::workflow_steps_for_card( $workflow['steps'] ),
				'outline_titles' => $outline_titles,
			),
			200
		);
	}
}
