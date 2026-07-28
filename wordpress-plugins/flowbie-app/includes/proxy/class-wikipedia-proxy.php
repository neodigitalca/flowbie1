<?php
/**
 * GET /api/wikipedia/api proxy (action=query only).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Wikipedia_Proxy {

	public static function proxy_query(): void {
		$action = isset( $_GET['action'] ) ? (string) wp_unslash( $_GET['action'] ) : '';
		if ( $action !== 'query' ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Only action=query is allowed' ), 400 );
			return;
		}

		$uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$q   = strpos( $uri, '?' ) !== false ? substr( $uri, strpos( $uri, '?' ) + 1 ) : '';
		$target = 'https://en.wikipedia.org/w/api.php?' . $q;

		$response = wp_remote_get(
			$target,
			array(
				'timeout' => 25,
				'headers' => array(
					'User-Agent' => 'Flowbie/1.0 (entity Wikipedia lookup; +https://flowbie.ca/flowbie/)',
					'Accept'     => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Wikipedia proxy request failed' ), 502 );
			return;
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$body   = wp_remote_retrieve_body( $response );
		$ct     = wp_remote_retrieve_header( $response, 'content-type' );
		status_header( $status );
		if ( is_string( $ct ) && $ct !== '' ) {
			header( 'Content-Type: ' . $ct );
		} else {
			header( 'Content-Type: application/json; charset=utf-8' );
		}
		echo $body;
	}
}
