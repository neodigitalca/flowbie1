<?php
/**
 * REST routes for body harness.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Ai_Body_Rest {

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		$edit = array(
			'permission_callback' => array( 'Neo_Pulse_Wp_Ai_Rest', 'edit_post_permission' ),
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/body/plan',
			array_merge(
				$edit,
				array(
					'methods'  => 'POST',
					'callback' => array( __CLASS__, 'plan' ),
					'args'     => array(
						'post_id' => array(
							'type'              => 'integer',
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
					),
				)
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/body/session',
			array(
				array_merge(
					$edit,
					array(
						'methods'  => 'GET',
						'callback' => array( __CLASS__, 'session' ),
						'args'     => array(
							'post_id' => array(
								'type'              => 'integer',
								'required'          => true,
								'sanitize_callback' => 'absint',
							),
						),
					)
				),
				array_merge(
					$edit,
					array(
						'methods'  => 'DELETE',
						'callback' => array( __CLASS__, 'delete_session' ),
						'args'     => array(
							'post_id' => array(
								'type'              => 'integer',
								'required'          => true,
								'sanitize_callback' => 'absint',
							),
						),
					)
				),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/body/sections',
			array_merge(
				$edit,
				array(
					'methods'  => 'GET',
					'callback' => array( __CLASS__, 'sections_from_post' ),
					'args'     => array(
						'post_id' => array(
							'type'              => 'integer',
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
					),
				)
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/body/posts-inventory',
			array_merge(
				$edit,
				array(
					'methods'  => 'GET',
					'callback' => array( __CLASS__, 'posts_inventory' ),
					'args'     => array(
						'post_id' => array(
							'type'              => 'integer',
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
					),
				)
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/body/suggest-link',
			array_merge(
				$edit,
				array(
					'methods'  => 'POST',
					'callback' => array( __CLASS__, 'suggest_link' ),
				)
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/body/insert-element',
			array_merge(
				$edit,
				array(
					'methods'  => 'POST',
					'callback' => array( __CLASS__, 'insert_element' ),
				)
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/body/save-structure',
			array_merge(
				$edit,
				array(
					'methods'  => 'POST',
					'callback' => array( __CLASS__, 'save_structure' ),
				)
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/body/section/preview',
			array_merge(
				$edit,
				array(
					'methods'  => 'POST',
					'callback' => array( __CLASS__, 'section_preview' ),
				)
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/body/section/apply',
			array_merge(
				$edit,
				array(
					'methods'  => 'POST',
					'callback' => array( __CLASS__, 'section_apply' ),
				)
			)
		);
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function sections_from_post( $request ) {
		$post_id = (int) $request->get_param( 'post_id' );
		$post    = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return self::respond( new WP_Error( 'neo-pulse_post', 'Post not found.' ) );
		}
		$split    = Neo_Pulse_Wp_Content_Sections::split_html_by_h2( $post->post_content );
		$sections = array();
		foreach ( $split as $i => $chunk ) {
			if ( empty( $chunk['title'] ) && $i === 0 ) {
				continue;
			}
			$sections[] = array(
				'index'       => count( $sections ),
				'title'       => $chunk['title'],
				'status'      => 'waiting',
				'currentHtml' => $chunk['html'],
			);
		}
		return new WP_REST_Response( array( 'ok' => true, 'sections' => $sections ), 200 );
	}

	public static function plan( $request ) {
		$post_id = (int) $request->get_param( 'post_id' );
		$result  = Neo_Pulse_Wp_Ai_Body::plan( $post_id );
		return self::respond( $result );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function session( $request ) {
		$post_id = (int) $request->get_param( 'post_id' );
		return self::respond( Neo_Pulse_Wp_Ai_Body::get_session( $post_id ) );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function delete_session( $request ) {
		$post_id = (int) $request->get_param( 'post_id' );
		return self::respond( Neo_Pulse_Wp_Ai_Body::clear_session( $post_id ) );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function section_preview( $request ) {
		$body    = $request->get_json_params();
		$post_id = is_array( $body ) && isset( $body['post_id'] ) ? absint( $body['post_id'] ) : 0;
		$index   = is_array( $body ) && isset( $body['sectionIndex'] ) ? (int) $body['sectionIndex'] : 0;
		$sid     = is_array( $body ) && isset( $body['sessionId'] ) ? sanitize_text_field( (string) $body['sessionId'] ) : '';
		return self::respond( Neo_Pulse_Wp_Ai_Body::preview_section( $post_id, $index, $sid ) );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function section_apply( $request ) {
		$body          = $request->get_json_params();
		$post_id       = is_array( $body ) && isset( $body['post_id'] ) ? absint( $body['post_id'] ) : 0;
		$index         = is_array( $body ) && isset( $body['sectionIndex'] ) ? (int) $body['sectionIndex'] : 0;
		$sid           = is_array( $body ) && isset( $body['sessionId'] ) ? sanitize_text_field( (string) $body['sessionId'] ) : '';
		$html          = is_array( $body ) && isset( $body['html'] ) ? (string) $body['html'] : '';
		$section_title = is_array( $body ) && isset( $body['sectionTitle'] ) ? sanitize_text_field( (string) $body['sectionTitle'] ) : '';
		return self::respond( Neo_Pulse_Wp_Ai_Body::apply_section( $post_id, $index, $sid, $html, false, $section_title ) );
	}

	/**
	 * Save structural changes (reorder, rename, delete, add sections).
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function save_structure( $request ) {
		$body     = $request->get_json_params();
		$post_id  = is_array( $body ) && isset( $body['post_id'] ) ? absint( $body['post_id'] ) : 0;
		$sections = is_array( $body ) && isset( $body['sections'] ) && is_array( $body['sections'] ) ? $body['sections'] : array();

		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return self::respond( new WP_Error( 'neo-pulse_post', 'Post not found.' ) );
		}

		$current = Neo_Pulse_Wp_Content_Sections::split_html_by_h2( $post->post_content );

		$intro = '';
		if ( ! empty( $current ) && $current[0]['title'] === '' ) {
			$intro = $current[0]['html'];
		}

		$pieces = array();
		if ( $intro !== '' ) {
			$pieces[] = trim( $intro );
		}

		foreach ( $sections as $sec ) {
			$title = isset( $sec['title'] ) ? sanitize_text_field( (string) $sec['title'] ) : '';
			$html  = isset( $sec['html'] ) ? (string) $sec['html'] : '';

			if ( $title === '' && $html === '' ) {
				continue;
			}

			if ( $html !== '' ) {
				$html = preg_replace( '#<h2[^>]*>.*?</h2>#is', '', $html, 1 );
				$html = trim( $html );
			}

			$pieces[] = '<h2>' . esc_html( $title ) . '</h2>' . ( $html !== '' ? "\n\n" . $html : '' );
		}

		$new_content = implode( "\n\n", $pieces );
		$update = wp_update_post(
			array(
				'ID'           => $post_id,
				'post_content' => $new_content,
			),
			true
		);
		if ( is_wp_error( $update ) ) {
			return self::respond( $update );
		}

		Neo_Pulse_Wp_Ai_Body::clear_session( $post_id );

		$new_sections = Neo_Pulse_Wp_Content_Sections::split_html_by_h2( $new_content );
		$out          = array();
		foreach ( $new_sections as $i => $chunk ) {
			if ( empty( $chunk['title'] ) && $i === 0 ) {
				continue;
			}
			$out[] = array(
				'index'       => count( $out ),
				'title'       => $chunk['title'],
				'status'      => 'waiting',
				'currentHtml' => $chunk['html'],
			);
		}

		return new WP_REST_Response( array( 'ok' => true, 'sections' => $out ), 200 );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function insert_element( $request ) {
		$body           = $request->get_json_params();
		$post_id        = is_array( $body ) && isset( $body['post_id'] ) ? absint( $body['post_id'] ) : 0;
		$section_title  = is_array( $body ) && isset( $body['section_title'] ) ? sanitize_text_field( (string) $body['section_title'] ) : '';
		$section_html   = is_array( $body ) && isset( $body['section_html'] ) ? (string) $body['section_html'] : '';
		$element_type   = is_array( $body ) && isset( $body['element_type'] ) ? sanitize_text_field( (string) $body['element_type'] ) : '';
		$custom_prompt  = is_array( $body ) && isset( $body['custom_prompt'] ) ? sanitize_text_field( (string) $body['custom_prompt'] ) : '';
		return self::respond( Neo_Pulse_Wp_Ai_Body::generate_element( $post_id, $section_title, $section_html, $element_type, $custom_prompt ) );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function posts_inventory( $request ) {
		$post_id = (int) $request->get_param( 'post_id' );
		return self::respond( Neo_Pulse_Wp_Ai_Body::get_posts_inventory( $post_id ) );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function suggest_link( $request ) {
		$body    = $request->get_json_params();
		$post_id = is_array( $body ) && isset( $body['post_id'] ) ? absint( $body['post_id'] ) : 0;
		$text    = is_array( $body ) && isset( $body['selected_text'] ) ? sanitize_text_field( (string) $body['selected_text'] ) : '';
		$context = is_array( $body ) && isset( $body['context'] ) ? sanitize_text_field( (string) $body['context'] ) : '';
		return self::respond( Neo_Pulse_Wp_Ai_Body::suggest_link( $post_id, $text, $context ) );
	}

	/**
	 * @param array<string,mixed>|WP_Error $result
	 * @return WP_REST_Response
	 */
	private static function respond( $result ): WP_REST_Response {
		if ( is_wp_error( $result ) ) {
			$data   = $result->get_error_data();
			$status = is_array( $data ) && isset( $data['status'] ) ? (int) $data['status'] : 400;
			return new WP_REST_Response(
				array(
					'ok'    => false,
					'error' => $result->get_error_message(),
					'code'  => $result->get_error_code(),
				),
				$status
			);
		}
		return new WP_REST_Response( $result, 200 );
	}
}
