<?php
/**
 * REST route handlers for /api/gsc/* (Node-compatible JSON shapes).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Gsc_Route_Handlers {

	public static function register(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		$routes = array(
			array( 'GET', '/service-account-email', 'service_account_email' ),
			array( 'GET', '/test-connection', 'test_connection' ),
			array( 'POST', '/report-date-range', 'report_date_range' ),
			array( 'POST', '/fetch-queries', 'fetch_queries' ),
			array( 'POST', '/fetch-performance-stats', 'fetch_performance_stats' ),
			array( 'POST', '/fetch-page-performance', 'fetch_page_performance' ),
			array( 'POST', '/fetch-pages-performance', 'fetch_pages_performance' ),
			array( 'POST', '/fetch-site-pages-performance', 'fetch_site_pages_performance' ),
			array( 'POST', '/fetch-historical-stats', 'fetch_historical_stats' ),
			array( 'POST', '/fetch-entity-pages-performance', 'fetch_entity_pages_performance' ),
			array( 'POST', '/fetch-reporting-bundle', 'fetch_reporting_bundle' ),
			array( 'POST', '/top-pages', 'top_pages' ),
			array( 'POST', '/url-inventory', 'url_inventory' ),
			array( 'POST', '/export-overview-quick-wins', 'export_overview_quick_wins' ),
			array( 'POST', '/quick-wins-context', 'quick_wins_context' ),
			array( 'GET', '/quick-wins-csv/(?P<filename>[a-zA-Z0-9._-]+)', 'quick_wins_csv' ),
			array( 'POST', '/check-url-indexing', 'check_url_indexing' ),
			array( 'POST', '/request-url-indexing', 'request_url_indexing' ),
			array( 'POST', '/index-sitemap-urls', 'index_sitemap_urls' ),
		);

		foreach ( $routes as $route ) {
			register_rest_route(
				'gsc',
				$route[1],
				array(
					'methods'             => $route[0],
					'callback'            => array( __CLASS__, $route[2] ),
					'permission_callback' => '__return_true',
				)
			);
		}
	}

	public static function service_account_email( WP_REST_Request $request ) {
		return rest_ensure_response( array( 'email' => Flowbie_App_Gsc_Service_Account::service_account_email() ) );
	}

	public static function test_connection( WP_REST_Request $request ) {
		$result = Flowbie_App_Gsc_Service_Account::test_connection();
		$code   = ! empty( $result['success'] ) ? 200 : ( ! empty( $result['connected'] ) ? 200 : 500 );
		return new WP_REST_Response( $result, $code );
	}

	public static function report_date_range( WP_REST_Request $request ) {
		$body = $request->get_json_params();
		if ( empty( $body['startDate'] ) || empty( $body['endDate'] ) ) {
			return new WP_REST_Response( array( 'success' => false, 'error' => 'startDate and endDate required' ), 400 );
		}
		Flowbie_App_Gsc_Service_Account::write_report_date_range(
			array(
				'startDate'        => (string) $body['startDate'],
				'endDate'          => (string) $body['endDate'],
				'compareStartDate' => isset( $body['compareStartDate'] ) ? (string) $body['compareStartDate'] : null,
				'compareEndDate'   => isset( $body['compareEndDate'] ) ? (string) $body['compareEndDate'] : null,
			)
		);
		return rest_ensure_response( array( 'success' => true ) );
	}

	public static function fetch_queries( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Queries::fetch_queries( (array) $request->get_json_params() ) );
	}

	public static function fetch_performance_stats( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Performance::fetch_performance_stats( (array) $request->get_json_params() ) );
	}

	public static function fetch_page_performance( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Performance::fetch_page_performance( (array) $request->get_json_params() ) );
	}

	public static function fetch_pages_performance( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Performance_Batch::fetch_pages_performance( (array) $request->get_json_params() ) );
	}

	public static function fetch_site_pages_performance( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Performance_Batch::fetch_site_pages_performance( (array) $request->get_json_params() ) );
	}

	public static function fetch_historical_stats( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Performance_Batch::fetch_historical_stats( (array) $request->get_json_params() ) );
	}

	public static function fetch_entity_pages_performance( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Entity_Performance::fetch_entity_pages_performance( (array) $request->get_json_params() ) );
	}

	public static function fetch_reporting_bundle( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Reporting_Bundle::fetch_reporting_bundle( (array) $request->get_json_params() ) );
	}

	public static function top_pages( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Performance_Batch::top_pages( (array) $request->get_json_params() ) );
	}

	public static function url_inventory( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Performance_Batch::url_inventory( (array) $request->get_json_params() ) );
	}

	public static function export_overview_quick_wins( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Performance::export_overview_quick_wins( (array) $request->get_json_params() ) );
	}

	public static function quick_wins_context( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Performance::quick_wins_context( (array) $request->get_json_params() ) );
	}

	public static function quick_wins_csv( WP_REST_Request $request ) {
		$filename = (string) $request->get_param( 'filename' );
		$result   = Flowbie_App_Gsc_Performance::serve_quick_wins_csv( $filename );
		if ( ! empty( $result['file'] ) ) {
			$body = file_get_contents( $result['file'] );
			$response = new WP_REST_Response( $body, 200 );
			$response->header( 'Content-Type', $result['contentType'] );
			$response->header( 'Content-Disposition', 'attachment; filename="' . basename( $filename ) . '"' );
			return $response;
		}
		return new WP_REST_Response( $result['body'] ?? array( 'error' => 'Failed' ), $result['statusCode'] ?? 500 );
	}

	public static function check_url_indexing( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Indexing::check_url_indexing( (array) $request->get_json_params() ) );
	}

	public static function request_url_indexing( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Indexing::request_url_indexing( (array) $request->get_json_params() ) );
	}

	public static function index_sitemap_urls( WP_REST_Request $request ) {
		return self::from_result( Flowbie_App_Gsc_Indexing::index_sitemap_urls( (array) $request->get_json_params() ) );
	}

	/** @param array{statusCode:int,body:array<string,mixed>} $result */
	private static function from_result( array $result ): WP_REST_Response {
		return new WP_REST_Response( $result['body'], $result['statusCode'] );
	}

	/**
	 * HTTP dispatch from Flowbie_App_Api_Dispatcher.
	 *
	 * @param string              $subpath Route after gsc/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'service-account-email' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'email' => Flowbie_App_Gsc_Service_Account::service_account_email() ) );
			return;
		}
		if ( $subpath === 'test-connection' && $method === 'GET' ) {
			$result = Flowbie_App_Gsc_Service_Account::test_connection();
			$code   = ! empty( $result['success'] ) ? 200 : 500;
			Flowbie_App_Api_Dispatcher::send_json( $result, $code );
			return;
		}
		if ( $subpath === 'report-date-range' && $method === 'POST' ) {
			$response = self::report_date_range( new WP_REST_Request( 'POST', '/gsc/report-date-range', array( 'JSON' => wp_json_encode( $body ) ) ) );
			Flowbie_App_Api_Dispatcher::send_json( $response->get_data(), $response->get_status() );
			return;
		}
		if ( $subpath === 'fetch-queries' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Queries::fetch_queries( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'fetch-performance-stats' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Performance::fetch_performance_stats( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'fetch-page-performance' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Performance::fetch_page_performance( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'fetch-pages-performance' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Performance_Batch::fetch_pages_performance( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'fetch-site-pages-performance' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Performance_Batch::fetch_site_pages_performance( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'fetch-historical-stats' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Performance_Batch::fetch_historical_stats( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'fetch-entity-pages-performance' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Entity_Performance::fetch_entity_pages_performance( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'fetch-reporting-bundle' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Reporting_Bundle::fetch_reporting_bundle( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'top-pages' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Performance_Batch::top_pages( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'url-inventory' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Performance_Batch::url_inventory( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'export-overview-quick-wins' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Performance::export_overview_quick_wins( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'quick-wins-context' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Performance::quick_wins_context( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( preg_match( '#^quick-wins-csv/([a-zA-Z0-9._-]+)$#', $subpath, $m ) && $method === 'GET' ) {
			$result = Flowbie_App_Gsc_Performance::serve_quick_wins_csv( $m[1] );
			if ( ! empty( $result['file'] ) && is_readable( $result['file'] ) ) {
				status_header( 200 );
				header( 'Content-Type: ' . ( $result['contentType'] ?? 'text/csv' ) );
				header( 'Content-Disposition: attachment; filename="' . basename( $m[1] ) . '"' );
				readfile( $result['file'] );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( $result['body'] ?? array( 'error' => 'Failed' ), $result['statusCode'] ?? 500 );
			return;
		}
		if ( $subpath === 'check-url-indexing' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Indexing::check_url_indexing( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'request-url-indexing' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Indexing::request_url_indexing( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}
		if ( $subpath === 'index-sitemap-urls' && $method === 'POST' ) {
			$r = Flowbie_App_Gsc_Indexing::index_sitemap_urls( $body );
			Flowbie_App_Api_Dispatcher::send_json( $r['body'], $r['statusCode'] );
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Not found', 'path' => 'gsc/' . $subpath ), 404 );
	}
}
