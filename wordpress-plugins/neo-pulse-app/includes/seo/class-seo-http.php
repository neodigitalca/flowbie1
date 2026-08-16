<?php
/**
 * Outbound HTML fetch helpers for SEO routes.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Seo_Http {

	const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 NEO Pulse/1.0';

	/**
	 * @return array{ok:bool,html?:string,error?:string,status?:int}
	 */
	public static function fetch_html( string $url, int $timeout = 20 ): array {
		$parsed = self::safe_parse_url( $url );
		if ( ! $parsed ) {
			return array( 'ok' => false, 'error' => 'Invalid url' );
		}

		$response = wp_remote_get(
			$parsed,
			array(
				'timeout'     => $timeout,
				'redirection' => 5,
				'headers'     => array(
					'User-Agent'      => self::USER_AGENT,
					'Accept'          => 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
					'Accept-Language' => 'en-US,en;q=0.9',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return array( 'ok' => false, 'error' => $response->get_error_message() );
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		if ( $status < 200 || $status >= 400 ) {
			return array( 'ok' => false, 'error' => 'HTTP ' . $status, 'status' => $status );
		}

		$html = wp_remote_retrieve_body( $response );
		return array( 'ok' => true, 'html' => is_string( $html ) ? $html : '' );
	}

	public static function safe_parse_url( string $input ): ?string {
		$input = trim( $input );
		if ( $input === '' ) {
			return null;
		}
		$parts = wp_parse_url( $input );
		if ( empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return null;
		}
		if ( ! in_array( strtolower( $parts['scheme'] ), array( 'http', 'https' ), true ) ) {
			return null;
		}
		return $input;
	}

	/**
	 * @return string[]
	 */
	public static function extract_locs_from_sitemap_xml( string $xml ): array {
		$urls = array();
		if ( preg_match_all( '/<loc>\s*([^<\s]+)\s*<\/loc>/i', $xml, $matches ) ) {
			foreach ( $matches[1] as $u ) {
				$u = trim( $u );
				if ( $u !== '' ) {
					$urls[] = $u;
				}
			}
		}
		return $urls;
	}

	/**
	 * @param string[] $labels
	 */
	public static function pick_primary_area_label( array $labels ): ?string {
		if ( empty( $labels ) ) {
			return null;
		}
		usort(
			$labels,
			static function ( $a, $b ) {
				$score = static function ( $s ) {
					$n = 0;
					if ( preg_match( '/area|region|metro|greater|surrounding|&/i', $s ) ) {
						$n += 4;
					}
					return $n + min( strlen( $s ), 120 ) / 200;
				};
				return $score( $b ) <=> $score( $a );
			}
		);
		return $labels[0];
	}
}
