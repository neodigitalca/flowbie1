<?php
/**
 * REST routes for Image SEO.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Image_Seo_Rest {

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		$ns = 'neo-pulse/v1';

		register_rest_route(
			$ns,
			'/image-seo/status',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'status' ),
				'permission_callback' => array( __CLASS__, 'upload_permission' ),
			)
		);

		register_rest_route(
			$ns,
			'/image-seo/list',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'list_items' ),
				'permission_callback' => array( __CLASS__, 'upload_permission' ),
				'args'                => array(
					'page'        => array( 'type' => 'integer', 'default' => 1 ),
					'per_page'    => array( 'type' => 'integer', 'default' => 20 ),
					'search'      => array( 'type' => 'string', 'default' => '' ),
					'missing_alt' => array( 'type' => 'boolean', 'default' => false ),
				),
			)
		);

		register_rest_route(
			$ns,
			'/image-seo/preview',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'preview' ),
				'permission_callback' => array( __CLASS__, 'attachment_permission' ),
				'args'                => self::attachment_args(),
			)
		);

		register_rest_route(
			$ns,
			'/image-seo/apply',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'apply' ),
				'permission_callback' => array( __CLASS__, 'attachment_permission' ),
				'args'                => self::attachment_args(),
			)
		);

		register_rest_route(
			$ns,
			'/image-seo/bulk',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'bulk' ),
				'permission_callback' => array( __CLASS__, 'upload_permission' ),
			)
		);

		register_rest_route(
			$ns,
			'/image-seo/save',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'save' ),
				'permission_callback' => array( __CLASS__, 'attachment_permission' ),
				'args'                => self::attachment_args(),
			)
		);

		register_rest_route(
			$ns,
			'/image-seo/attachment/(?P<id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_attachment' ),
				'permission_callback' => array( __CLASS__, 'upload_permission' ),
				'args'                => array(
					'id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}

	/**
	 * @return array<string,array<string,mixed>>
	 */
	private static function attachment_args(): array {
		return array(
			'attachment_id' => array(
				'type'              => 'integer',
				'required'          => true,
				'sanitize_callback' => 'absint',
			),
			'post_id'       => array(
				'type'              => 'integer',
				'default'           => 0,
				'sanitize_callback' => 'absint',
			),
		);
	}

	/**
	 * @return bool|\WP_Error
	 */
	public static function upload_permission() {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_not_logged_in', __( 'Authentication required.', 'neo-pulse-wp' ), array( 'status' => 401 ) );
		}
		if ( ! Neo_Pulse_Wp_Image_Seo_Gate::can_list() ) {
			return new WP_Error( 'rest_forbidden', __( 'You do not have permission to manage media.', 'neo-pulse-wp' ), array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * @param WP_REST_Request $request
	 * @return bool|\WP_Error
	 */
	public static function attachment_permission( $request ) {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_not_logged_in', __( 'Authentication required.', 'neo-pulse-wp' ), array( 'status' => 401 ) );
		}
		$attachment_id = (int) $request->get_param( 'attachment_id' );
		if ( $attachment_id < 1 ) {
			$body = $request->get_json_params();
			if ( is_array( $body ) && ! empty( $body['attachment_id'] ) ) {
				$attachment_id = (int) $body['attachment_id'];
			}
		}
		$post_id = (int) $request->get_param( 'post_id' );
		if ( $post_id < 1 ) {
			$body = $request->get_json_params();
			if ( is_array( $body ) && ! empty( $body['post_id'] ) ) {
				$post_id = (int) $body['post_id'];
			}
		}
		return Neo_Pulse_Wp_Image_Seo_Gate::can_edit_attachment( $attachment_id, $post_id );
	}

	/**
	 * @return WP_REST_Response
	 */
	public static function status() {
		return new WP_REST_Response( Neo_Pulse_Wp_Image_Seo_Gate::get_status(), 200 );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function list_items( $request ) {
		$result = Neo_Pulse_Wp_Image_Seo::query_attachments(
			array(
				'page'        => (int) $request->get_param( 'page' ),
				'per_page'    => (int) $request->get_param( 'per_page' ),
				'search'      => (string) $request->get_param( 'search' ),
				'missing_alt' => (bool) $request->get_param( 'missing_alt' ),
			)
		);
		return new WP_REST_Response( array_merge( array( 'ok' => true ), $result ), 200 );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function get_attachment( $request ) {
		$id = (int) $request->get_param( 'id' );
		$check = Neo_Pulse_Wp_Image_Seo_Gate::can_edit_attachment( $id );
		if ( is_wp_error( $check ) ) {
			return self::error_response( $check );
		}
		return new WP_REST_Response(
			array(
				'ok'  => true,
				'row' => Neo_Pulse_Wp_Image_Seo::attachment_row( $id ),
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function preview( $request ) {
		$params = self::parse_body( $request );
		$use_ai = ! isset( $params['use_ai'] ) || ! empty( $params['use_ai'] );
		$result = Neo_Pulse_Wp_Image_Seo_Ai::preview(
			(int) $params['attachment_id'],
			(int) ( $params['post_id'] ?? 0 ),
			$use_ai,
			isset( $params['fields'] ) && is_array( $params['fields'] ) ? $params['fields'] : null,
			isset( $params['overwrite_mode'] ) ? sanitize_key( (string) $params['overwrite_mode'] ) : null
		);
		if ( is_wp_error( $result ) ) {
			return self::error_response( $result );
		}
		return new WP_REST_Response( array_merge( array( 'ok' => true ), $result ), 200 );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function apply( $request ) {
		$params = self::parse_body( $request );
		$values = isset( $params['values'] ) && is_array( $params['values'] ) ? $params['values'] : array();
		$sanitized = array();
		foreach ( Neo_Pulse_Wp_Image_Seo::FIELD_KEYS as $key ) {
			if ( array_key_exists( $key, $values ) ) {
				$sanitized[ $key ] = (string) $values[ $key ];
			}
		}
		$result = Neo_Pulse_Wp_Image_Seo_Ai::apply(
			(int) $params['attachment_id'],
			$sanitized,
			isset( $params['overwrite_mode'] ) ? sanitize_key( (string) $params['overwrite_mode'] ) : null,
			isset( $params['fields'] ) && is_array( $params['fields'] ) ? $params['fields'] : null
		);
		if ( is_wp_error( $result ) ) {
			return self::error_response( $result );
		}
		return new WP_REST_Response( $result, 200 );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function bulk( $request ) {
		$params = self::parse_body( $request );
		$ids    = isset( $params['attachment_ids'] ) && is_array( $params['attachment_ids'] ) ? array_map( 'absint', $params['attachment_ids'] ) : array();
		$ids    = array_values( array_filter( $ids ) );
		if ( empty( $ids ) ) {
			return new WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'No attachments selected.', 'neo-pulse-wp' ),
				),
				400
			);
		}

		$use_ai         = ! isset( $params['use_ai'] ) || ! empty( $params['use_ai'] );
		$overwrite_mode = isset( $params['overwrite_mode'] ) ? sanitize_key( (string) $params['overwrite_mode'] ) : null;
		$fields         = isset( $params['fields'] ) && is_array( $params['fields'] ) ? $params['fields'] : null;
		$config         = Neo_Pulse_Wp_Image_Seo::get_config();
		$field_targets  = $fields ?? ( is_array( $config['fields'] ?? null ) ? $config['fields'] : Neo_Pulse_Wp_Image_Seo::default_config()['fields'] );
		$overwrite_mode = $overwrite_mode ?? (string) ( $config['overwrite_mode'] ?? 'missing_only' );

		$results = array();
		foreach ( $ids as $id ) {
			$check = Neo_Pulse_Wp_Image_Seo_Gate::can_edit_attachment( $id );
			if ( is_wp_error( $check ) ) {
				$results[] = array(
					'id'    => $id,
					'ok'    => false,
					'error' => $check->get_error_message(),
				);
				continue;
			}
			$preview = Neo_Pulse_Wp_Image_Seo_Ai::preview( $id, 0, $use_ai, $field_targets, $overwrite_mode, $config );
			if ( is_wp_error( $preview ) ) {
				$results[] = array(
					'id'    => $id,
					'ok'    => false,
					'error' => $preview->get_error_message(),
				);
				continue;
			}
			$apply = Neo_Pulse_Wp_Image_Seo_Ai::apply( $id, $preview['proposed'], $overwrite_mode, $field_targets );
			if ( is_wp_error( $apply ) ) {
				$results[] = array(
					'id'    => $id,
					'ok'    => false,
					'error' => $apply->get_error_message(),
				);
				continue;
			}
			$results[] = array(
				'id'      => $id,
				'ok'      => true,
				'values'  => $apply['values'] ?? array(),
				'skipped' => ! empty( $apply['skipped'] ),
			);
		}

		$ok_count = count( array_filter( $results, static function ( $r ) {
			return ! empty( $r['ok'] );
		} ) );

		return new WP_REST_Response(
			array(
				'ok'      => true,
				'results' => $results,
				'summary' => array(
					'total'   => count( $results ),
					'success' => $ok_count,
					'failed'  => count( $results ) - $ok_count,
				),
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function save( $request ) {
		$params = self::parse_body( $request );
		$values = array();
		foreach ( Neo_Pulse_Wp_Image_Seo::FIELD_KEYS as $key ) {
			if ( array_key_exists( $key, $params ) ) {
				$values[ $key ] = (string) $params[ $key ];
			}
		}
		$result = Neo_Pulse_Wp_Image_Seo::save_meta( (int) $params['attachment_id'], $values );
		if ( is_wp_error( $result ) ) {
			return self::error_response( $result );
		}
		return new WP_REST_Response(
			array(
				'ok'  => true,
				'row' => Neo_Pulse_Wp_Image_Seo::attachment_row( (int) $params['attachment_id'] ),
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request
	 * @return array<string,mixed>
	 */
	private static function parse_body( $request ): array {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			$body = array();
		}
		if ( empty( $body['attachment_id'] ) ) {
			$body['attachment_id'] = (int) $request->get_param( 'attachment_id' );
		}
		if ( empty( $body['post_id'] ) ) {
			$body['post_id'] = (int) $request->get_param( 'post_id' );
		}
		return $body;
	}

	/**
	 * @param WP_Error $error
	 * @return WP_REST_Response
	 */
	private static function error_response( WP_Error $error ): WP_REST_Response {
		$data   = $error->get_error_data();
		$status = is_array( $data ) && isset( $data['status'] ) ? (int) $data['status'] : 400;
		return new WP_REST_Response(
			array(
				'ok'    => false,
				'error' => $error->get_error_message(),
				'code'  => $error->get_error_code(),
			),
			$status
		);
	}
}
