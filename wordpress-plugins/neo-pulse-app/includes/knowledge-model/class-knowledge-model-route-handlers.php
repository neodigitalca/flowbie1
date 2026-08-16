<?php
/**
 * /api/knowledge-model/* route handlers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Knowledge_Model_Route_Handlers {

	/**
	 * @param string              $subpath Route after knowledge-model/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'generate-graph' && $method === 'POST' ) {
			self::generate_graph( $body );
			return;
		}
		if ( $subpath === 'auto-graph' && $method === 'POST' ) {
			self::auto_graph( $body );
			return;
		}
		if ( preg_match( '#^progress/([a-zA-Z0-9-]+)$#', $subpath, $m ) && $method === 'GET' ) {
			self::progress( $m[1] );
			return;
		}
		if ( preg_match( '#^graph/([a-zA-Z0-9-]+)$#', $subpath, $m ) && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'success' => false, 'error' => 'Graph storage not yet implemented' ), 501 );
			return;
		}
		if ( $subpath === 'expand-node' && $method === 'POST' ) {
			self::expand_node( $body );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'success' => false, 'error' => 'Not found' ), 404 );
	}

	/** @param array<string,mixed> $body */
	private static function generate_graph( array $body ): void {
		try {
			$graph = Neo_Pulse_App_Knowledge_Model_Service::generate_graph( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'success' => true, 'graph' => $graph ) );
		} catch ( Exception $e ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'success' => false, 'error' => $e->getMessage() ?: 'Failed to generate graph' ), 500 );
		}
	}

	/** @param array<string,mixed> $body */
	private static function auto_graph( array $body ): void {
		try {
			if ( empty( $body['siteId'] ) || empty( $body['siteUrl'] ) || empty( $body['username'] ) || empty( $body['appPassword'] ) ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'success' => false, 'error' => 'Missing required fields: siteId, siteUrl, username, appPassword' ), 400 );
				return;
			}

			$job_id = ! empty( $body['jobId'] ) ? (string) $body['jobId'] : wp_generate_uuid4();
			$params = array_merge( $body, array( 'jobId' => $job_id ) );

			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'success' => true,
					'jobId'   => $job_id,
					'message' => 'Auto-graph started. Use /progress endpoint to track progress.',
				)
			);

			if ( function_exists( 'fastcgi_finish_request' ) ) {
				fastcgi_finish_request();
			}

			Neo_Pulse_App_Knowledge_Model_Service::run_auto_graph( $params );
		} catch ( Exception $e ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'success' => false, 'error' => $e->getMessage() ?: 'Failed to start auto-graph' ), 500 );
		}
	}

	private static function progress( string $job_id ): void {
		$progress = Neo_Pulse_App_Knowledge_Model_Progress::get( $job_id );
		if ( ! $progress ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'success' => false, 'error' => 'Job not found' ), 404 );
			return;
		}
		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'success' => true, 'progress' => $progress ) );
	}

	/** @param array<string,mixed> $body */
	private static function expand_node( array $body ): void {
		try {
			$keyword = trim( (string) ( $body['keyword'] ?? '' ) );
			if ( $keyword === '' ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'success' => false, 'error' => 'Missing required field: keyword' ), 400 );
				return;
			}
			$gsc = isset( $body['gscData'] ) && is_array( $body['gscData'] ) ? $body['gscData'] : array();
			$node = Neo_Pulse_App_Knowledge_Model_Service::expand_node( $keyword, $gsc );
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'success' => true, 'node' => $node ) );
		} catch ( Exception $e ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'success' => false, 'error' => $e->getMessage() ?: 'Failed to expand node' ), 500 );
		}
	}
}
