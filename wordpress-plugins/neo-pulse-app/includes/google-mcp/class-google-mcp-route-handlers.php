<?php
/**
 * REST route handlers for /api/google-mcp/*.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Mcp_Route_Handlers {

	/**
	 * @param string              $subpath Route after google-mcp/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'config-status' && $method === 'GET' ) {
			if ( ! headers_sent() ) {
				header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0' );
				header( 'Pragma: no-cache' );
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Google_Mcp_Oauth::config_status() );
			return;
		}

		if ( $subpath === 'authorize' && $method === 'GET' ) {
			Neo_Pulse_App_Google_Mcp_Oauth::authorize_redirect();
			return;
		}

		if ( $subpath === 'callback' && $method === 'GET' ) {
			$query = array();
			foreach ( array( 'code', 'error', 'state' ) as $key ) {
				if ( isset( $_GET[ $key ] ) ) {
					$query[ $key ] = sanitize_text_field( wp_unslash( (string) $_GET[ $key ] ) );
				}
			}
			Neo_Pulse_App_Google_Mcp_Oauth::handle_callback( $query );
			return;
		}

		if ( $subpath === 'status' && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Google_Mcp_Oauth::connection_status() );
			return;
		}

		if ( $subpath === 'test' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Mcp_Oauth::test_connection( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'test-and-save' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Mcp_Oauth::test_and_save( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'upload-deliverable' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Drive_Upload::upload_deliverable( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'test-step-upload' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Drive_Upload::test_step_upload( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'team-settings' && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'success'  => true,
					'settings' => Neo_Pulse_App_Google_Drive_Settings::get(),
				)
			);
			return;
		}

		if ( $subpath === 'team-settings' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Drive_Settings::save( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'find-folder' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Drive_Upload::find_folder( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'list-folder-children' && $method === 'GET' ) {
			$query = array();
			foreach ( array( 'folderId' ) as $key ) {
				if ( isset( $_GET[ $key ] ) ) {
					$query[ $key ] = sanitize_text_field( wp_unslash( (string) $_GET[ $key ] ) );
				}
			}
			$result = Neo_Pulse_App_Google_Drive_Upload::list_folder_children( $query );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'resolve-folder-path' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Drive_Upload::resolve_folder_path( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'resolve-delivery-folder' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Drive_Upload::resolve_delivery_folder( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'move-file' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Drive_Upload::move_file( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'rename-file' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Drive_Upload::rename_file( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		if ( $subpath === 'trash-file' && $method === 'POST' ) {
			$result = Neo_Pulse_App_Google_Drive_Upload::trash_file( $body );
			Neo_Pulse_App_Api_Dispatcher::send_json( $result['body'], $result['statusCode'] );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'error' => 'Not found',
				'path'  => 'google-mcp/' . $subpath,
			),
			404
		);
	}
}
