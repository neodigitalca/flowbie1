<?php
/**
 * REST route handlers for /api/overview/* (Node-compatible JSON shapes).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Overview_Route_Handlers {

	public static function register(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			'overview',
			'/fetch-page-meta',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'fetch_page_meta' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'overview',
			'/optimize-meta-ai',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'optimize_meta_ai' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'overview',
			'/seo-brief',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'seo_brief_post' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'overview',
			'/seo-brief/(?P<filename>[a-zA-Z0-9._-]+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'seo_brief_get' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'overview',
			'/blog-links-log',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'blog_links_log' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public static function fetch_page_meta( WP_REST_Request $request ) {
		$result = Flowbie_App_Overview_Fetch_Meta::fetch_page_meta( (array) $request->get_json_params() );
		return new WP_REST_Response( $result['body'], $result['statusCode'] );
	}

	public static function optimize_meta_ai( WP_REST_Request $request ) {
		try {
			$body = (array) $request->get_json_params();
			$result = Flowbie_App_Overview_Meta_Ai::run_optimize_meta_ai(
				array(
					'url'              => $body['url'] ?? '',
					'primaryKeyword'   => $body['primaryKeyword'] ?? '',
					'openRouterApiKey' => $body['openRouterApiKey'] ?? '',
					'wordpress'        => $body['wordpress'] ?? null,
				)
			);
			return rest_ensure_response( $result );
		} catch ( Exception $e ) {
			return new WP_REST_Response( array( 'error' => $e->getMessage() ), 500 );
		}
	}

	public static function seo_brief_post( WP_REST_Request $request ) {
		$result = Flowbie_App_Overview_Seo_Brief::save( (array) $request->get_json_params() );
		return new WP_REST_Response( $result['body'], $result['statusCode'] );
	}

	public static function seo_brief_get( WP_REST_Request $request ) {
		$result = Flowbie_App_Overview_Seo_Brief::serve( (string) $request->get_param( 'filename' ) );
		if ( ! empty( $result['file'] ) ) {
			$response = new WP_REST_Response( file_get_contents( $result['file'] ), 200 );
			$response->header( 'Content-Type', $result['contentType'] );
			$response->header( 'Content-Disposition', 'attachment; filename="' . basename( (string) $request->get_param( 'filename' ) ) . '"' );
			return $response;
		}
		return new WP_REST_Response( $result['body'] ?? array( 'error' => 'Failed' ), $result['statusCode'] ?? 500 );
	}

	public static function blog_links_log( WP_REST_Request $request ) {
		unset( $request );
		return rest_ensure_response( array( 'ok' => true ) );
	}

	/**
	 * @param string              $subpath Route after overview/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'fetch-page-meta' && $method === 'POST' ) {
			$r = Flowbie_App_Overview_Fetch_Meta::fetch_page_meta( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'optimize-meta-ai' && $method === 'POST' ) {
			try {
				$result = Flowbie_App_Overview_Meta_Ai::run_optimize_meta_ai(
					array(
						'url'              => $body['url'] ?? '',
						'primaryKeyword'   => $body['primaryKeyword'] ?? '',
						'openRouterApiKey' => $body['openRouterApiKey'] ?? '',
						'wordpress'        => $body['wordpress'] ?? null,
					)
				);
				Flowbie_App_Api_Dispatcher::send_json( $result );
			} catch ( Exception $e ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => $e->getMessage() ), 500 );
			}
			return;
		}
		if ( $subpath === 'seo-brief' && $method === 'POST' ) {
			$r = Flowbie_App_Overview_Seo_Brief::save( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( preg_match( '#^seo-brief/([a-zA-Z0-9._-]+)$#', $subpath, $m ) && $method === 'GET' ) {
			$r = Flowbie_App_Overview_Seo_Brief::serve( $m[1] );
			if ( ! empty( $r['file'] ) && is_readable( $r['file'] ) ) {
				status_header( 200 );
				header( 'Content-Type: ' . ( $r['contentType'] ?? 'application/json' ) );
				header( 'Content-Disposition: attachment; filename="' . basename( $m[1] ) . '"' );
				readfile( $r['file'] );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( $r['body'] ?? array( 'error' => 'Failed' ), $r['statusCode'] ?? 500 );
			return;
		}
		if ( $subpath === 'blog-links-log' && $method === 'POST' ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Not found', 'path' => 'overview/' . $subpath ), 404 );
	}
}
