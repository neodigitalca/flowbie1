<?php
/**
 * REST CRUD for Flowbie redirects (MCP + agents).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Redirects_Rest {

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		$perm = function () {
			return current_user_can( 'manage_options' );
		};

		register_rest_route(
			'flowbie/v1',
			'/redirects',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'list_redirects' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( __CLASS__, 'create_redirect' ),
					'permission_callback' => $perm,
				),
			)
		);

		register_rest_route(
			'flowbie/v1',
			'/redirects/(?P<id>\d+)',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'get_redirect' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( __CLASS__, 'update_redirect' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( __CLASS__, 'delete_redirect' ),
					'permission_callback' => $perm,
				),
			)
		);
	}

	/**
	 * @param object $row DB row.
	 * @return array<string, mixed>
	 */
	private static function format_row( $row ): array {
		return array(
			'id'          => (int) $row->id,
			'source'      => (string) $row->source,
			'destination' => (string) $row->destination,
			'type'        => (int) $row->type,
			'matching'    => (string) $row->matching,
			'category'    => (string) $row->category,
			'status'      => (string) $row->status,
			'hits'        => (int) $row->hits,
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function list_redirects( WP_REST_Request $request ): WP_REST_Response {
		$result = Flowbie_Wp_Redirects::query(
			array(
				'page'     => (int) $request->get_param( 'page' ) ?: 1,
				'per_page' => (int) $request->get_param( 'per_page' ) ?: 50,
				'search'   => (string) $request->get_param( 'search' ),
				'status'   => (string) $request->get_param( 'status' ),
			)
		);

		$items = array();
		foreach ( $result['items'] as $row ) {
			$items[] = self::format_row( $row );
		}

		return new WP_REST_Response(
			array(
				'ok'    => true,
				'items' => $items,
				'total' => (int) $result['total'],
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_redirect( WP_REST_Request $request ) {
		$id  = (int) $request['id'];
		$row = Flowbie_Wp_Redirects::get( $id );
		if ( ! $row ) {
			return new WP_Error( 'flowbie_redirect', __( 'Redirect not found.', 'flowbie-wp' ), array( 'status' => 404 ) );
		}
		return new WP_REST_Response( array( 'ok' => true, 'redirect' => self::format_row( $row ) ), 200 );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function create_redirect( WP_REST_Request $request ): WP_REST_Response {
		$body   = $request->get_json_params();
		$params = is_array( $body ) ? $body : array();
		$result = Flowbie_Wp_Redirects::save( $params );
		if ( empty( $result['ok'] ) ) {
			return new WP_REST_Response(
				array( 'ok' => false, 'error' => $result['error'] ?? __( 'Save failed.', 'flowbie-wp' ) ),
				400
			);
		}
		$row = Flowbie_Wp_Redirects::get( (int) $result['id'] );
		return new WP_REST_Response(
			array(
				'ok'       => true,
				'redirect' => $row ? self::format_row( $row ) : array( 'id' => (int) $result['id'] ),
			),
			201
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function update_redirect( WP_REST_Request $request ): WP_REST_Response {
		$body   = $request->get_json_params();
		$params = is_array( $body ) ? $body : array();
		$params['id'] = (int) $request['id'];
		$result       = Flowbie_Wp_Redirects::save( $params );
		if ( empty( $result['ok'] ) ) {
			return new WP_REST_Response(
				array( 'ok' => false, 'error' => $result['error'] ?? __( 'Save failed.', 'flowbie-wp' ) ),
				400
			);
		}
		$row = Flowbie_Wp_Redirects::get( (int) $result['id'] );
		return new WP_REST_Response(
			array( 'ok' => true, 'redirect' => $row ? self::format_row( $row ) : null ),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function delete_redirect( WP_REST_Request $request ): WP_REST_Response {
		$id     = (int) $request['id'];
		$force  = (bool) $request->get_param( 'force' );
		$deleted = $force ? Flowbie_Wp_Redirects::delete( $id ) : Flowbie_Wp_Redirects::save( array( 'id' => $id, 'status' => 'trash' ) );
		if ( $force ) {
			return new WP_REST_Response( array( 'ok' => (bool) $deleted ), $deleted ? 200 : 404 );
		}
		return new WP_REST_Response( array( 'ok' => ! empty( $deleted['ok'] ) ), ! empty( $deleted['ok'] ) ? 200 : 400 );
	}
}
