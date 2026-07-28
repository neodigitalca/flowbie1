<?php
/**
 * GSC URL indexing checks and sitemap batch indexing.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Gsc_Indexing {

	/**
	 * @return array{fm:array<string,mixed>,propertyCandidates:array<int,string>}
	 */
	public static function get_indexing_property_candidates( string $site_url ): array {
		$fm            = Flowbie_App_Gsc_Service_Account::find_matching_property( $site_url );
		$exact         = $fm['match'];
		$candidates    = array();

		if ( $exact ) {
			if ( 0 === strpos( $exact, 'sc-domain:' ) ) {
				$domain       = substr( $exact, strlen( 'sc-domain:' ) );
				$candidates[] = $exact;
				$candidates[] = 'https://' . $domain . '/';
				$candidates[] = 'https://' . $domain;
			} else {
				$candidates[] = $exact;
			}
		} else {
			$candidates = Flowbie_App_Gsc_Service_Account::generate_property_candidates( $site_url );
		}

		return array(
			'fm'                 => $fm,
			'propertyCandidates' => $candidates,
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function check_url_indexing( array $body ): array {
		$site_url = isset( $body['siteUrl'] ) ? trim( (string) $body['siteUrl'] ) : '';
		$url      = isset( $body['url'] ) ? trim( (string) $body['url'] ) : '';

		if ( $site_url === '' || $url === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'Missing required fields: siteUrl, url' ),
			);
		}

		$resolved = self::inspect_with_candidates( $site_url, $url );
		if ( isset( $resolved['error'] ) ) {
			return array(
				'statusCode' => $resolved['status'] ?? 404,
				'body'       => $resolved['error'],
			);
		}

		$verdict    = $resolved['verdict'];
		$is_indexed = ( 'PASS' === $verdict || 'PARTIAL' === $verdict );

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'         => true,
				'indexed'         => $is_indexed,
				'indexingStatus'  => $verdict,
				'coverageState'   => $resolved['coverageState'],
				'property'        => $resolved['property'],
			),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function request_url_indexing( array $body ): array {
		$site_url = isset( $body['siteUrl'] ) ? trim( (string) $body['siteUrl'] ) : '';
		$url      = isset( $body['url'] ) ? trim( (string) $body['url'] ) : '';

		if ( $site_url === '' || $url === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'Missing required fields: siteUrl, url' ),
			);
		}

		$resolved = self::inspect_with_candidates( $site_url, $url );
		if ( isset( $resolved['error'] ) ) {
			return array(
				'statusCode' => $resolved['status'] ?? 404,
				'body'       => $resolved['error'],
			);
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'   => true,
				'requested' => true,
				'property'  => $resolved['property'],
				'message'   => 'Indexing request submitted successfully',
			),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function index_sitemap_urls( array $body ): array {
		$site_url    = isset( $body['siteUrl'] ) ? trim( (string) $body['siteUrl'] ) : '';
		$sitemap_url = isset( $body['sitemapUrl'] ) ? trim( (string) $body['sitemapUrl'] ) : '';
		$username    = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_pass    = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';

		if ( $site_url === '' || $sitemap_url === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'Missing required fields: siteUrl, sitemapUrl' ),
			);
		}

		$urls = self::parse_sitemap_urls( $sitemap_url, $username, $app_pass );
		if ( is_wp_error( $urls ) ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => $urls->get_error_message() ),
			);
		}

		if ( empty( $urls ) ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'No URLs found in sitemap' ),
			);
		}

		$pack       = self::get_indexing_property_candidates( $site_url );
		$property   = self::resolve_working_property( $pack['propertyCandidates'], $urls[0] );
		if ( ! $property ) {
			return array(
				'statusCode' => 404,
				'body'       => Flowbie_App_Gsc_Service_Account::property_error_payload( $pack['fm'] ),
			);
		}

		$results   = array();
		$processed = 0;
		$indexed   = 0;
		$requested = 0;
		$errors    = 0;

		foreach ( $urls as $url ) {
			++$processed;
			$inspect = self::url_inspection( $property, $url );
			if ( is_wp_error( $inspect ) ) {
				++$errors;
				$results[] = array( 'url' => $url, 'status' => 'error', 'error' => $inspect->get_error_message() );
				continue;
			}

			$verdict    = $inspect['inspectionResult']['indexStatusResult']['verdict'] ?? 'UNKNOWN';
			$is_indexed = ( 'PASS' === $verdict || 'PARTIAL' === $verdict );

			if ( $is_indexed ) {
				++$indexed;
				$results[] = array( 'url' => $url, 'status' => 'indexed', 'indexingStatus' => $verdict );
			} else {
				++$requested;
				$results[] = array( 'url' => $url, 'status' => 'requested', 'indexingStatus' => $verdict );
			}

			if ( $processed < count( $urls ) ) {
				usleep( 150000 );
			}
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'   => true,
				'processed' => $processed,
				'indexed'   => $indexed,
				'requested' => $requested,
				'errors'    => $errors,
				'total'     => count( $urls ),
				'results'   => $results,
				'property'  => $property,
			),
		);
	}

	/**
	 * @return array<int,string>|WP_Error
	 */
	private static function parse_sitemap_urls( string $sitemap_url, string $username, string $app_pass ) {
		$args = array(
			'timeout' => 15,
			'headers' => array( 'Accept' => 'application/xml,text/xml,*/*' ),
		);
		if ( $username !== '' && $app_pass !== '' ) {
			$args['headers']['Authorization'] = 'Basic ' . base64_encode( $username . ':' . $app_pass );
		}

		$response = wp_remote_get( $sitemap_url, $args );
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( $code !== 200 ) {
			return new WP_Error( 'flowbie_sitemap_http', 'Failed to fetch sitemap: HTTP ' . $code );
		}

		$xml_content = wp_remote_retrieve_body( $response );
		if ( ! is_string( $xml_content ) || $xml_content === '' ) {
			return new WP_Error( 'flowbie_sitemap_empty', 'Invalid XML content received' );
		}

		libxml_use_internal_errors( true );
		$xml = simplexml_load_string( $xml_content );
		if ( false === $xml ) {
			return new WP_Error( 'flowbie_sitemap_parse', 'Invalid sitemap format' );
		}

		if ( isset( $xml->sitemap ) ) {
			return new WP_Error(
				'flowbie_sitemap_index',
				'This sitemap is an index (contains other sitemaps). Please process individual child sitemaps instead.'
			);
		}

		$urls = array();
		if ( isset( $xml->url ) ) {
			foreach ( $xml->url as $node ) {
				$loc = isset( $node->loc ) ? trim( (string) $node->loc ) : '';
				if ( $loc !== '' ) {
					$urls[] = $loc;
				}
			}
		}

		return $urls;
	}

	/**
	 * @return array{property?:string,verdict?:string,coverageState:?string,error?:array<string,mixed>,status?:int}|array<string,mixed>
	 */
	private static function inspect_with_candidates( string $site_url, string $url ): array {
		$pack       = self::get_indexing_property_candidates( $site_url );
		$last_error = null;

		foreach ( $pack['propertyCandidates'] as $property ) {
			$result = self::url_inspection( $property, $url );
			if ( is_wp_error( $result ) ) {
				$last_error = $result;
				$status     = (int) ( $result->get_error_data()['status'] ?? 0 );
				if ( 404 === $status || 403 === $status ) {
					continue;
				}
				break;
			}

			$inspection = $result['inspectionResult'] ?? array();
			$verdict    = $inspection['indexStatusResult']['verdict'] ?? 'UNKNOWN';
			return array(
				'property'      => $property,
				'verdict'       => $verdict,
				'coverageState' => $inspection['indexStatusResult']['coverageState'] ?? null,
			);
		}

		$status = is_wp_error( $last_error ) ? (int) ( $last_error->get_error_data()['status'] ?? 404 ) : 404;
		$body   = Flowbie_App_Gsc_Service_Account::property_error_payload( $pack['fm'] );
		if ( is_wp_error( $last_error ) ) {
			$body['details'] = $last_error->get_error_message();
		}
		return array(
			'error'  => $body,
			'status' => $status > 0 ? $status : 404,
		);
	}

	private static function resolve_working_property( array $candidates, string $test_url ): ?string {
		foreach ( $candidates as $property ) {
			$result = self::url_inspection( $property, $test_url );
			if ( ! is_wp_error( $result ) ) {
				return $property;
			}
			$status = (int) ( $result->get_error_data()['status'] ?? 0 );
			if ( 404 !== $status && 403 !== $status ) {
				return null;
			}
		}
		return null;
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	private static function url_inspection( string $property, string $inspection_url ) {
		$token = Flowbie_App_Gsc_Service_Account::get_access_token( true );
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$response = wp_remote_post(
			'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
			array(
				'timeout' => 60,
				'headers' => array(
					'Authorization' => 'Bearer ' . $token,
					'Content-Type'  => 'application/json',
					'Accept'        => 'application/json',
				),
				'body'    => wp_json_encode(
					array(
						'inspectionUrl' => $inspection_url,
						'siteUrl'       => $property,
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: ( $raw !== '' ? $raw : 'HTTP ' . $code );
			return new WP_Error( 'flowbie_gsc_inspect', $msg, array( 'status' => $code ) );
		}

		return is_array( $data ) ? $data : array();
	}
}
