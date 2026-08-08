<?php
/**
 * REST routes: public ping + authenticated post content for Flowbie server.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers REST routes.
 */
class Flowbie_Wp_Rest {

	/**
	 * Hook registrations.
	 */
	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * Register REST API routes.
	 */
	public static function register_routes(): void {
		register_rest_route(
			'flowbie/v1',
			'/ping',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'ping' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'flowbie/v1',
			'/post-content/(?P<id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_post_content' ),
				'permission_callback' => array( __CLASS__, 'post_content_permission_check' ),
				'args'                => array(
					'id' => array(
						'description' => __( 'Post ID.', 'flowbie-wp' ),
						'type'        => 'integer',
					),
				),
			)
		);

		register_rest_route(
			'flowbie/v1',
			'/theme-functions-php',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'get_theme_functions_php' ),
					'permission_callback' => array( __CLASS__, 'theme_functions_permission_check' ),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( __CLASS__, 'put_theme_functions_php' ),
					'permission_callback' => array( __CLASS__, 'theme_functions_permission_check' ),
				),
			)
		);
	}

	/**
	 * Require edit_themes for active theme functions.php read/write.
	 *
	 * @return bool|\WP_Error
	 */
	public static function theme_functions_permission_check() {
		if ( ! is_user_logged_in() ) {
			return new \WP_Error(
				'rest_not_logged_in',
				__( 'Authentication required.', 'flowbie-wp' ),
				array( 'status' => 401 )
			);
		}

		if ( ! current_user_can( 'edit_themes' ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'edit_themes capability is required to read or write functions.php.', 'flowbie-wp' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}

	/**
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function get_theme_functions_php() {
		$result = Flowbie_Wp_Tools_Handlers::wp_theme_functions_get( array() );
		if ( is_wp_error( $result ) ) {
			$data   = $result->get_error_data();
			$status = is_array( $data ) && isset( $data['status'] ) ? (int) $data['status'] : 400;
			return new \WP_Error( $result->get_error_code(), $result->get_error_message(), array( 'status' => $status ) );
		}
		return new \WP_REST_Response( $result, 200 );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function put_theme_functions_php( $request ) {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			$body = array();
		}

		$params = array(
			'content' => isset( $body['content'] ) ? (string) $body['content'] : '',
			'confirm' => ! empty( $body['confirm'] ),
		);

		if ( $params['confirm'] !== true ) {
			return new \WP_Error(
				'flowbie_confirm_required',
				__( 'confirm: true is required to write functions.php.', 'flowbie-wp' ),
				array( 'status' => 400 )
			);
		}

		$result = Flowbie_Wp_Tools_Handlers::wp_theme_functions_put( $params );
		if ( is_wp_error( $result ) ) {
			$data   = $result->get_error_data();
			$status = is_array( $data ) && isset( $data['status'] ) ? (int) $data['status'] : 400;
			return new \WP_Error( $result->get_error_code(), $result->get_error_message(), array( 'status' => $status ) );
		}
		return new \WP_REST_Response( $result, 200 );
	}

	/**
	 * Require Application Password (or cookie) auth and ability to edit the post.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return bool|\WP_Error
	 */
	public static function post_content_permission_check( $request ) {
		$id = isset( $request['id'] ) ? (int) $request['id'] : 0;
		if ( $id < 1 ) {
			return new \WP_Error(
				'rest_invalid_param',
				__( 'Invalid post ID.', 'flowbie-wp' ),
				array( 'status' => 400 )
			);
		}

		if ( ! is_user_logged_in() ) {
			return new \WP_Error(
				'rest_not_logged_in',
				__( 'Authentication required.', 'flowbie-wp' ),
				array( 'status' => 401 )
			);
		}

		if ( ! current_user_can( 'edit_post', $id ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to access this post.', 'flowbie-wp' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}

	/**
	 * Rendered post body as HTML (same path as flowbie/v1/post-content).
	 */
	public static function get_rendered_content_html( int $post_id ): string {
		$post_obj = get_post( $post_id );
		if ( ! $post_obj instanceof \WP_Post ) {
			return '';
		}

		global $post;
		$prev_post = $post;
		$post      = $post_obj;
		setup_postdata( $post );
		$content_html = apply_filters( 'the_content', $post->post_content );
		wp_reset_postdata();
		$post = $prev_post;

		if ( ! is_string( $content_html ) || trim( $content_html ) === '' ) {
			return '';
		}

		return trim( $content_html );
	}

	/**
	 * Rendered post body as plain text (same path as flowbie/v1/post-content).
	 */
	public static function get_rendered_content_plain( int $post_id ): string {
		$content_html = self::get_rendered_content_html( $post_id );
		if ( $content_html === '' ) {
			return '';
		}

		return trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( $content_html ) ) );
	}

	/**
	 * Return post fields for Flowbie Node (same shape consumers expect after wp/v2 mapping).
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function get_post_content( $request ) {
		$id       = (int) $request['id'];
		$post_obj = get_post( $id );

		if ( ! $post_obj instanceof \WP_Post ) {
			return new \WP_Error(
				'rest_post_invalid_id',
				__( 'Post not found.', 'flowbie-wp' ),
				array( 'status' => 404 )
			);
		}

		$excerpt_raw  = $post_obj->post_excerpt;
		$excerpt_html = $excerpt_raw !== '' ? apply_filters( 'the_excerpt', $excerpt_raw ) : '';

		global $post;
		$prev_post = $post;
		$post      = $post_obj;
		setup_postdata( $post );
		$content_html = apply_filters( 'the_content', $post->post_content );
		wp_reset_postdata();
		$post = $prev_post;

		$title = get_the_title( $post_obj );
		if ( $title === '' ) {
			$title = __( '(No title)', 'flowbie-wp' );
		}

		$ptype     = $post_obj->post_type;
		$rest_base = $ptype;
		$pto       = get_post_type_object( $ptype );
		if ( $pto && ! empty( $pto->rest_base ) ) {
			$rest_base = (string) $pto->rest_base;
		}

		$data = array(
			'id'               => (int) $post_obj->ID,
			'slug'             => (string) $post_obj->post_name,
			'title'            => $title,
			'content'          => is_string( $content_html ) ? $content_html : '',
			'excerpt'          => is_string( $excerpt_html ) ? $excerpt_html : '',
			'date_gmt'         => $post_obj->post_date_gmt ?: get_gmt_from_date( $post_obj->post_date ),
			'date'             => $post_obj->post_date,
			'status'           => $post_obj->post_status,
			'link'             => get_permalink( $post_obj ) ?: '',
			'categories'       => wp_get_post_categories( $id ),
			'tags'             => wp_get_post_tags( $id, array( 'fields' => 'ids' ) ),
			'postTypeEndpoint' => $rest_base,
			'postTypeSubtype'  => $ptype,
			'fullData'         => array(
				'source' => 'flowbie_wp_plugin',
			),
		);

		return new \WP_REST_Response( $data, 200 );
	}

	/**
	 * Ping response.
	 *
	 * @return \WP_REST_Response
	 */
	public static function ping(): \WP_REST_Response {
		return new \WP_REST_Response(
			array(
				'ok'      => true,
				'name'    => 'Flowbie WP',
				'version' => FLOWBIE_WP_VERSION,
			),
			200
		);
	}
}
