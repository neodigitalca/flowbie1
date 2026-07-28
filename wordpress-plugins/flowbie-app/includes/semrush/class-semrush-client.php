<?php
/**
 * Semrush Analytics API client.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Semrush_Client {

	const API_BASE = 'https://api.semrush.com/';

	const DISPLAY_LIMIT = 50;

	public static function has_api_key(): bool {
		return Flowbie_App_Secrets::semrush_api_key() !== '';
	}

	public static function api_key(): string {
		return Flowbie_App_Secrets::semrush_api_key();
	}

	/**
	 * @param array<string,string|int> $params
	 * @return string|WP_Error
	 */
	public static function request_report( array $params ) {
		$key = self::api_key();
		if ( $key === '' ) {
			return new WP_Error( 'flowbie_semrush_missing', 'SEMRUSH_API_KEY is not set' );
		}

		$params['key'] = $key;
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

	public static function normalize_url( string $page_url ): string {
		$s = trim( $page_url );
		if ( $s === '' ) {
			return '';
		}
		if ( ! preg_match( '#^https?://#i', $s ) ) {
			$s = 'https://' . ltrim( $s, '/' );
		}
		return $s;
	}

	/**
	 * @return array<int,string>
	 */
	public static function keywords_from_csv( string $csv ): array {
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
	public static function urls_from_csv( string $csv ): array {
		$lines = preg_split( '/\r\n|\r|\n/', trim( $csv ) );
		if ( ! is_array( $lines ) || count( $lines ) < 1 ) {
			return array();
		}

		$header  = self::split_csv_line( $lines[0] );
		$url_col = -1;
		foreach ( $header as $i => $col ) {
			$c = trim( $col );
			if ( strcasecmp( $c, 'Ur' ) === 0 || strcasecmp( $c, 'Url' ) === 0 || strcasecmp( $c, 'URL' ) === 0 ) {
				$url_col = (int) $i;
				break;
			}
		}

		$out  = array();
		$seen = array();
		$start = $url_col >= 0 ? 1 : 0;
		for ( $i = $start; $i < count( $lines ); $i++ ) {
			$row = self::split_csv_line( $lines[ $i ] );
			if ( $url_col >= 0 ) {
				$cell = $row[ $url_col ] ?? '';
			} else {
				$cell = $lines[ $i ];
			}
			$url = self::normalize_http_url( (string) $cell );
			if ( $url === null ) {
				continue;
			}
			$k = strtolower( $url );
			if ( isset( $seen[ $k ] ) ) {
				continue;
			}
			$seen[ $k ] = true;
			$out[]      = $url;
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

	private static function normalize_http_url( string $cell ): ?string {
		$t = trim( preg_replace( '/[),.;]+$/', '', $cell ) );
		if ( $t === '' ) {
			return null;
		}
		if ( preg_match( '#^https?://[^\s;"\'\]]+#i', $t, $m ) ) {
			return $m[0];
		}
		return null;
	}

	/**
	 * @param string $site_url
	 */
	public static function database_from_site_url( string $site_url ): string {
		$s = trim( $site_url );
		if ( $s === '' ) {
			return 'us';
		}
		if ( ! preg_match( '#^https?://#i', $s ) ) {
			$s = 'https://' . $s;
		}
		$host = wp_parse_url( $s, PHP_URL_HOST );
		if ( ! is_string( $host ) ) {
			return 'us';
		}
		$host = strtolower( preg_replace( '/^www\./', '', $host ) );
		if ( substr( $host, -3 ) === '.ca' ) {
			return 'ca';
		}
		if ( substr( $host, -6 ) === '.co.uk' ) {
			return 'uk';
		}
		if ( substr( $host, -6 ) === '.com.au' ) {
			return 'au';
		}
		if ( substr( $host, -3 ) === '.de' ) {
			return 'de';
		}
		if ( substr( $host, -3 ) === '.fr' ) {
			return 'fr';
		}
		return 'us';
	}
}
