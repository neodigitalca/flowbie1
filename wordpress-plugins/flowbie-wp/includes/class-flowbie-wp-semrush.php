<?php
/**
 * Semrush Analytics API for SEO research briefs.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Semrush {

	const API_BASE = 'https://api.semrush.com/';

	const DISPLAY_LIMIT = 50;

	/**
	 * @return array<string,mixed>
	 */
	public static function fetch_overview_enrichment( string $page_url, string $seed_keyword, string $database = 'us' ): array {
		$empty = array(
			'urlOrganicKeywords'    => array(),
			'phraseRelatedKeywords' => array(),
			'urlOrganicUrls'        => array(),
			'phraseRelatedUrls'     => array(),
			'phraseOrganicUrls'     => array(),
			'externalSemrushUrls'   => array(),
			'errors'                => array(),
		);

		$key = Flowbie_Wp_Research_Keys::semrush_api_key();
		if ( $key === '' ) {
			$empty['errors'][] = 'semrush_not_configured';
			return $empty;
		}

		$url = self::normalize_url( $page_url );
		if ( $url === '' ) {
			$empty['errors'][] = 'invalid_page_url';
			return $empty;
		}

		$url_organic = self::request_report(
			$key,
			array(
				'type'           => 'url_organic',
				'database'       => $database,
				'url'            => $url,
				'display_limit'  => self::DISPLAY_LIMIT,
				'export_columns' => 'Ph',
			)
		);
		if ( is_wp_error( $url_organic ) ) {
			$empty['errors'][] = 'url_organic:' . $url_organic->get_error_message();
		} else {
			$empty['urlOrganicKeywords'] = self::keywords_from_csv( $url_organic );
		}

		$phrase = trim( $seed_keyword );
		if ( $phrase !== '' ) {
			$phrase_related = self::request_report(
				$key,
				array(
					'type'           => 'phrase_related',
					'database'       => $database,
					'phrase'         => $phrase,
					'display_limit'  => self::DISPLAY_LIMIT,
					'export_columns' => 'Ph',
				)
			);
			if ( is_wp_error( $phrase_related ) ) {
				$empty['errors'][] = 'phrase_related:' . $phrase_related->get_error_message();
			} else {
				$empty['phraseRelatedKeywords'] = self::keywords_from_csv( $phrase_related );
			}
		}

		return $empty;
	}

	/**
	 * @param array<string,string|int> $params
	 * @return string|WP_Error
	 */
	private static function request_report( string $api_key, array $params ) {
		$params['key'] = $api_key;
		$url           = add_query_arg( $params, self::API_BASE );

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 60,
				'headers' => array(
					'Accept' => 'text/plain, */*',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error( 'flowbie_semrush_http', $raw !== '' ? $raw : sprintf( 'HTTP %d', $code ) );
		}

		if ( stripos( $raw, 'ERROR' ) === 0 ) {
			return new WP_Error( 'flowbie_semrush_api', trim( $raw ) );
		}

		return (string) $raw;
	}

	/**
	 * @return array<int,string>
	 */
	private static function keywords_from_csv( string $csv ): array {
		$lines = preg_split( '/\r\n|\r|\n/', trim( $csv ) );
		if ( ! is_array( $lines ) || count( $lines ) < 2 ) {
			return array();
		}

		$header = self::split_csv_line( $lines[0] );
		$ph_col = -1;
		foreach ( $header as $i => $col ) {
			if ( strcasecmp( trim( $col ), 'Ph' ) === 0 || strcasecmp( trim( $col ), 'Keyword' ) === 0 ) {
				$ph_col = (int) $i;
				break;
			}
		}
		if ( $ph_col < 0 ) {
			$ph_col = 0;
		}

		$out  = array();
		$seen = array();
		for ( $i = 1; $i < count( $lines ); $i++ ) {
			$row = self::split_csv_line( $lines[ $i ] );
			if ( ! isset( $row[ $ph_col ] ) ) {
				continue;
			}
			$kw = trim( (string) $row[ $ph_col ] );
			if ( $kw === '' ) {
				continue;
			}
			$k = strtolower( $kw );
			if ( isset( $seen[ $k ] ) ) {
				continue;
			}
			$seen[ $k ] = true;
			$out[]      = $kw;
		}

		return $out;
	}

	/**
	 * @return array<int,string>
	 */
	private static function split_csv_line( string $line ): array {
		if ( strpos( $line, ';' ) !== false ) {
			return array_map( 'trim', explode( ';', $line ) );
		}
		return array_map( 'trim', explode( ',', $line ) );
	}

	private static function normalize_url( string $page_url ): string {
		$s = trim( $page_url );
		if ( $s === '' ) {
			return '';
		}
		if ( ! preg_match( '#^https?://#i', $s ) ) {
			$s = 'https://' . ltrim( $s, '/' );
		}
		return $s;
	}
}
