<?php
/**
 * POST /api/bulk/validate-internal-links (NDJSON stream).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Bulk_Validate_Links {

	const PING_TIMEOUT = 10;

	/**
	 * @param array<string,mixed> $body Request JSON.
	 */
	public static function stream( array $body ): void {
		try {
			$body_urls     = isset( $body['urls'] ) && is_array( $body['urls'] ) ? $body['urls'] : array();
			$content       = isset( $body['content'] ) ? $body['content'] : null;
			$site_base_url = isset( $body['siteBaseUrl'] ) ? (string) $body['siteBaseUrl'] : '';

			$urls = $body_urls;
			if ( empty( $urls ) && is_string( $content ) && $content !== '' && $site_base_url !== '' ) {
				$urls = self::extract_internal_links( $content, $site_base_url );
			}

			if ( empty( $urls ) ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'results' => array(), 'allOk' => true ) );
				return;
			}

			$seen     = array();
			$to_check = array();
			foreach ( $urls as $u ) {
				if ( ! is_string( $u ) || trim( $u ) === '' ) {
					continue;
				}
				$normalized = strtolower( rtrim( trim( $u ), '/' ) );
				if ( isset( $seen[ $normalized ] ) ) {
					continue;
				}
				$seen[ $normalized ] = true;
				$to_check[]          = trim( $u );
			}

			$total       = count( $to_check );
			$sync_map    = array();
			$urls_to_ping = array();
			foreach ( $to_check as $url ) {
				if ( self::is_possible_duplicate_url( $url ) ) {
					$sync_map[ $url ] = array(
						'url'      => $url,
						'status'   => 200,
						'ok'       => false,
						'rejected' => 'duplicate-url-pattern',
					);
				} else {
					$urls_to_ping[] = $url;
				}
			}

			status_header( 200 );
			header( 'Content-Type: application/x-ndjson' );

			$checked = count( $sync_map );
			if ( $checked > 0 ) {
				echo wp_json_encode( array( 'type' => 'progress', 'checked' => $checked, 'total' => $total ) ) . "\n";
			}

			$async_by_url = array();
			foreach ( $urls_to_ping as $url ) {
				$ping = self::ping_url( $url );
				$async_by_url[ $url ] = array_merge( array( 'url' => $url ), $ping );
			}
			$checked = $total;
			echo wp_json_encode( array( 'type' => 'progress', 'checked' => $checked, 'total' => $total ) ) . "\n";

			$results = array();
			foreach ( $to_check as $url ) {
				if ( isset( $sync_map[ $url ] ) ) {
					$results[] = $sync_map[ $url ];
				} else {
					$results[] = $async_by_url[ $url ] ?? array( 'url' => $url, 'status' => 0, 'ok' => false );
				}
			}

			$all_ok = true;
			foreach ( $results as $row ) {
				if ( empty( $row['ok'] ) ) {
					$all_ok = false;
					break;
				}
			}

			echo wp_json_encode( array( 'type' => 'done', 'results' => $results, 'allOk' => $all_ok ) ) . "\n";
		} catch ( Exception $e ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'error'   => $e->getMessage(),
					'results' => array(),
					'allOk'   => false,
				),
				500
			);
		}
	}

	/**
	 * @return array{status:int,ok:bool}
	 */
	private static function ping_url( string $url ): array {
		$args = array(
			'timeout'     => self::PING_TIMEOUT,
			'redirection' => 5,
			'headers'     => array( 'User-Agent' => 'NeoPulseLinkValidator/1.0' ),
		);

		$response = wp_remote_head( $url, $args );
		if ( is_wp_error( $response ) ) {
			return array( 'status' => 0, 'ok' => false );
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		if ( $status === 405 || $status === 501 ) {
			$get = wp_remote_get( $url, array_merge( $args, array( 'limit_response_size' => 0 ) ) );
			if ( ! is_wp_error( $get ) ) {
				$status = (int) wp_remote_retrieve_response_code( $get );
			}
		} elseif ( $status === 404 ) {
			$get = wp_remote_get( $url, array_merge( $args, array( 'limit_response_size' => 0 ) ) );
			if ( ! is_wp_error( $get ) && (int) wp_remote_retrieve_response_code( $get ) === 200 ) {
				$status = 200;
			}
		}

		return array( 'status' => $status, 'ok' => $status === 200 );
	}

	private static function is_possible_duplicate_url( string $url ): bool {
		$path = (string) parse_url( $url, PHP_URL_PATH );
		return (bool) preg_match( '/(-\d+)+\/?$/', $path );
	}

	/**
	 * @return string[]
	 */
	private static function extract_internal_links( string $content, string $site_base_url ): array {
		$base = strpos( $site_base_url, 'http' ) === 0 ? $site_base_url : 'https://' . $site_base_url;
		$parts = wp_parse_url( $base );
		if ( empty( $parts['host'] ) ) {
			return array();
		}
		$site_host  = preg_replace( '/^www\./', '', strtolower( (string) $parts['host'] ) );
		$scheme     = ! empty( $parts['scheme'] ) ? $parts['scheme'] : 'https';
		$base_origin = $scheme . '://' . $parts['host'];

		$pattern = '/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|<a[^>]*href=["\'](https?:\/\/[^"\']+)["\'][^>]*>|<a[^>]*href=["\'](\/[^"\']*)["\'][^>]*>/i';
		$seen    = array();
		$urls    = array();

		if ( preg_match_all( $pattern, $content, $matches, PREG_SET_ORDER ) ) {
			foreach ( $matches as $m ) {
				$absolute = ! empty( $m[2] ) ? $m[2] : ( ! empty( $m[3] ) ? $m[3] : '' );
				$relative = ! empty( $m[4] ) ? $m[4] : '';
				if ( $absolute !== '' ) {
					$href = $absolute;
				} elseif ( $relative !== '' ) {
					$href = ( strpos( $relative, '/' ) === 0 ) ? $base_origin . $relative : $base_origin . '/' . ltrim( $relative, '/' );
				} else {
					continue;
				}

				$u = wp_parse_url( $href );
				if ( empty( $u['host'] ) ) {
					continue;
				}
				$host = preg_replace( '/^www\./', '', strtolower( (string) $u['host'] ) );
				if ( $host !== $site_host ) {
					continue;
				}
				$normalized = strtolower( rtrim( $href, '/' ) );
				if ( isset( $seen[ $normalized ] ) ) {
					continue;
				}
				$seen[ $normalized ] = true;
				$urls[]              = $href;
			}
		}

		return $urls;
	}
}
