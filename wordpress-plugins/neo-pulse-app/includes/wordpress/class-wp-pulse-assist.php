<?php
/**
 * NEO Pulse God Mode assist proxy (Pulse SPA → connected neo-pulse-wp site).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Wp_Pulse_Assist {

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>,2?:string}
	 */
	public static function stream( $body ) {
		list( $site_url, $username, $app_password, $err ) = self::auth_from_body( $body );
		if ( $err !== null ) {
			return array( 400, array( 'ok' => false, 'error' => $err ) );
		}

		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );
		$url        = $normalized . '/wp-json/neo-pulse/v1/backend-assist/stream';
		$payload    = self::assist_payload( $body );
		$payload['admin_mode'] = 'backend';

		$resp = Neo_Pulse_App_Wp_Rest_Client::request(
			'POST',
			$url,
			$username,
			$app_password,
			array(
				'timeout'      => 300,
				'body'         => $payload,
				'accept'       => 'text/plain, application/x-ndjson, application/json',
				'max_attempts' => 2,
			)
		);

		if ( $resp['is_wp_error'] ) {
			return array( 502, array( 'ok' => false, 'error' => $resp['error'], 'siteUrl' => $normalized ) );
		}

		$status = (int) $resp['status'];
		$raw    = is_string( $resp['raw'] ) ? $resp['raw'] : '';
		if ( $status < 200 || $status >= 300 ) {
			return array(
				$status >= 400 ? $status : 502,
				array(
					'ok'      => false,
					'error'   => self::format_error( $status, $resp['body'] ),
					'siteUrl' => $normalized,
				),
			);
		}

		$lines = self::parse_ndjson_lines( $raw );
		return array(
			200,
			array(
				'ok'     => true,
				'ndjson' => $lines,
			),
			'application/x-ndjson',
		);
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function assist( $body ) {
		list( $site_url, $username, $app_password, $err ) = self::auth_from_body( $body );
		if ( $err !== null ) {
			return array( 400, array( 'ok' => false, 'error' => $err ) );
		}

		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );
		$url        = $normalized . '/wp-json/neo-pulse/v1/backend-assist';
		$payload    = self::assist_payload( $body );
		$payload['admin_mode'] = 'backend';

		$submode = isset( $body['admin_submode'] ) ? sanitize_key( (string) $body['admin_submode'] ) : 'build';
		if ( $submode === 'plan' ) {
			$payload['mode'] = 'plan';
		} elseif ( $submode === 'build' ) {
			$payload['mode'] = 'build';
		}

		$resp = Neo_Pulse_App_Wp_Rest_Client::request(
			'POST',
			$url,
			$username,
			$app_password,
			array(
				'timeout'      => 300,
				'body'         => $payload,
				'max_attempts' => 2,
			)
		);

		return self::json_proxy_result( $resp, $normalized );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function undo( $body ) {
		return self::post_proxy( $body, '/wp-json/neo-pulse/v1/backend-assist/undo' );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function step( $body ) {
		return self::post_proxy( $body, '/wp-json/neo-pulse/v1/backend-assist/step' );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function workflow_status( $body ) {
		list( $site_url, $username, $app_password, $err ) = self::auth_from_body( $body );
		if ( $err !== null ) {
			return array( 400, array( 'ok' => false, 'error' => $err ) );
		}

		$workflow_id = isset( $body['workflow_id'] ) ? sanitize_text_field( (string) $body['workflow_id'] ) : '';
		if ( $workflow_id === '' ) {
			return array( 400, array( 'ok' => false, 'error' => 'workflow_id is required' ) );
		}

		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );
		$url        = $normalized . '/wp-json/neo-pulse/v1/backend-assist/workflow/' . rawurlencode( $workflow_id ) . '/status';

		$resp = Neo_Pulse_App_Wp_Rest_Client::request(
			'GET',
			$url,
			$username,
			$app_password,
			array(
				'timeout'      => 60,
				'max_attempts' => 2,
			)
		);

		return self::json_proxy_result( $resp, $normalized );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function site_inventory( $body ) {
		list( $site_url, $username, $app_password, $err ) = self::auth_from_body( $body );
		if ( $err !== null ) {
			return array( 400, array( 'ok' => false, 'error' => $err ) );
		}

		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );
		$params = array();
		if ( ! empty( $body['format'] ) ) {
			$params['format'] = sanitize_key( (string) $body['format'] );
		}
		if ( ! empty( $body['include_drafts'] ) ) {
			$params['include_drafts'] = '1';
		}
		if ( isset( $body['query'] ) && trim( (string) $body['query'] ) !== '' ) {
			$params['query'] = sanitize_text_field( (string) $body['query'] );
		}
		if ( ! empty( $body['post_type'] ) ) {
			$params['post_type'] = sanitize_key( (string) $body['post_type'] );
		}
		if ( isset( $body['limit'] ) && (int) $body['limit'] > 0 ) {
			$params['limit'] = (string) max( 1, min( 50, (int) $body['limit'] ) );
		}
		if ( ! empty( $body['sort'] ) ) {
			$params['sort'] = sanitize_key( (string) $body['sort'] );
		}

		$url  = $normalized . '/wp-json/neo-pulse/v1/chat/site-inventory';
		$resp = Neo_Pulse_App_Wp_Rest_Client::request(
			'GET',
			$url,
			$username,
			$app_password,
			array(
				'timeout'      => 120,
				'params'       => $params,
				'accept'       => ! empty( $params['format'] ) && $params['format'] === 'csv' ? 'text/csv' : 'application/json',
				'max_attempts' => 2,
			)
		);

		if ( ! empty( $params['format'] ) && $params['format'] === 'csv' ) {
			if ( $resp['is_wp_error'] ) {
				return array( 502, array( 'ok' => false, 'error' => $resp['error'], 'siteUrl' => $normalized ) );
			}
			$status = (int) $resp['status'];
			if ( $status < 200 || $status >= 300 ) {
				return array(
					$status >= 400 ? $status : 502,
					array( 'ok' => false, 'error' => self::format_error( $status, $resp['body'] ), 'siteUrl' => $normalized ),
				);
			}
			return array(
				200,
				array(
					'ok'  => true,
					'csv' => is_string( $resp['raw'] ) ? $resp['raw'] : '',
				),
			);
		}

		return self::json_proxy_result( $resp, $normalized );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @param string              $path Path after site origin.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	private static function post_proxy( $body, $path ) {
		list( $site_url, $username, $app_password, $err ) = self::auth_from_body( $body );
		if ( $err !== null ) {
			return array( 400, array( 'ok' => false, 'error' => $err ) );
		}

		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );
		$url        = $normalized . $path;
		$payload    = self::assist_payload( $body );

		$resp = Neo_Pulse_App_Wp_Rest_Client::request(
			'POST',
			$url,
			$username,
			$app_password,
			array(
				'timeout'      => 300,
				'body'         => $payload,
				'max_attempts' => 2,
			)
		);

		return self::json_proxy_result( $resp, $normalized );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array<string,mixed>
	 */
	private static function assist_payload( $body ) {
		$keys = array(
			'message',
			'history',
			'admin_submode',
			'target_scope',
			'post_id',
			'page_url',
			'page_title',
			'page_context_key',
			'pulse_context',
			'workflow_id',
			'step_index',
		);
		$out = array();
		foreach ( $keys as $key ) {
			if ( array_key_exists( $key, $body ) ) {
				$out[ $key ] = $body[ $key ];
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:string,1:string,2:string,3:?string}
	 */
	private static function auth_from_body( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		if ( $site_url === '' || $username === '' || $app_password === '' ) {
			return array( '', '', '', 'Missing required fields: siteUrl, username, appPassword' );
		}
		return array( $site_url, $username, $app_password, null );
	}

	/**
	 * @param array<string,mixed> $resp     REST client response.
	 * @param string              $normalized Site URL.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	private static function json_proxy_result( $resp, $normalized ) {
		if ( $resp['is_wp_error'] ) {
			return array( 502, array( 'ok' => false, 'error' => $resp['error'], 'siteUrl' => $normalized ) );
		}

		$status = (int) $resp['status'];
		$data   = is_array( $resp['body'] ) ? $resp['body'] : array( 'data' => $resp['body'] );
		if ( $status >= 200 && $status < 300 ) {
			return array( 200, array_merge( $data, array( 'ok' => true, 'siteUrl' => $normalized ) ) );
		}

		$http = $status >= 400 ? $status : 502;
		return array(
			$http,
			array(
				'ok'      => false,
				'status'  => $status,
				'error'   => self::format_error( $status, $data ),
				'siteUrl' => $normalized,
				'raw'     => is_array( $resp['body'] ) ? $resp['body'] : null,
			),
		);
	}

	/**
	 * @param int                 $status HTTP status.
	 * @param mixed               $data   Response body.
	 * @return string
	 */
	private static function format_error( $status, $data ) {
		if ( is_array( $data ) ) {
			if ( ! empty( $data['error'] ) && is_string( $data['error'] ) ) {
				return $data['error'];
			}
			if ( ! empty( $data['message'] ) && is_string( $data['message'] ) ) {
				return $data['message'];
			}
		}
		return 'Pulse assist request failed (HTTP ' . (int) $status . ')';
	}

	/**
	 * @param string $raw NDJSON body.
	 * @return array<int,array<string,mixed>>
	 */
	private static function parse_ndjson_lines( $raw ) {
		$lines = array();
		foreach ( preg_split( "/\r\n|\n|\r/", (string) $raw ) as $line ) {
			$line = trim( $line );
			if ( $line === '' ) {
				continue;
			}
			$decoded = json_decode( $line, true );
			if ( is_array( $decoded ) ) {
				$lines[] = $decoded;
			}
		}
		return $lines;
	}
}
