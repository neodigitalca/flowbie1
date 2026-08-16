<?php
/**
 * Semrush bulk enrichment (Analytics API; mirrors server/semrush/semrush-enrichment.js shape).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Semrush_Bulk_Enrichment {

	/**
	 * @param array<string,mixed> $opts
	 * @return array<string,mixed>
	 */
	public static function run( array $opts ): array {
		$page_url   = isset( $opts['pageUrl'] ) ? (string) $opts['pageUrl'] : '';
		$seed       = isset( $opts['seedKeyword'] ) ? (string) $opts['seedKeyword'] : '';
		$database   = ! empty( $opts['database'] ) ? (string) $opts['database'] : 'us';
		$blocked    = self::sanitize_blocked_hosts( $opts['portfolioBlockedHosts'] ?? null );

		$empty = array(
			'skipped'                 => false,
			'urlOrganicKeywords'      => array(),
			'phraseRelatedKeywords'   => array(),
			'urlOrganicUrls'          => array(),
			'phraseRelatedUrls'       => array(),
			'phraseOrganicUrls'       => array(),
			'externalSemrushUrls'     => array(),
			'keywordOverview'         => null,
			'errors'                  => array(),
		);

		if ( ! Neo_Pulse_App_Semrush_Client::has_api_key() ) {
			$empty['skipped'] = true;
			$empty['reason']  = 'no_api_key';
			return $empty;
		}

		$url = Neo_Pulse_App_Semrush_Client::normalize_url( $page_url );
		if ( $url === '' ) {
			$empty['errors'][] = array( 'step' => 'validate', 'message' => 'Invalid pageUrl' );
			return $empty;
		}

		$errors = array();

		$url_organic = Neo_Pulse_App_Semrush_Client::request_report(
			array(
				'type'           => 'url_organic',
				'database'       => $database,
				'url'            => $url,
				'display_limit'  => Neo_Pulse_App_Semrush_Client::DISPLAY_LIMIT,
				'export_columns' => 'Ph',
			)
		);
		if ( is_wp_error( $url_organic ) ) {
			$errors[] = array( 'step' => 'url_organic', 'message' => $url_organic->get_error_message() );
		}

		$url_organic_keywords = is_string( $url_organic ) ? Neo_Pulse_App_Semrush_Client::keywords_from_csv( $url_organic ) : array();
		$url_organic_urls   = is_string( $url_organic ) ? Neo_Pulse_App_Semrush_Client::urls_from_csv( $url_organic ) : array();

		$phrase_related_keywords = array();
		$phrase_related_urls     = array();
		$phrase_organic_urls     = array();
		$keyword_overview        = null;

		$phrase = trim( $seed );
		if ( $phrase !== '' ) {
			$phrase_params = array(
				'database'       => $database,
				'phrase'         => $phrase,
				'display_limit'  => Neo_Pulse_App_Semrush_Client::DISPLAY_LIMIT,
				'export_columns' => 'Ph',
			);

			$phrase_related = Neo_Pulse_App_Semrush_Client::request_report(
				array_merge( $phrase_params, array( 'type' => 'phrase_related' ) )
			);
			if ( is_wp_error( $phrase_related ) ) {
				$errors[] = array( 'step' => 'phrase_related', 'message' => $phrase_related->get_error_message() );
			} else {
				$phrase_related_keywords = Neo_Pulse_App_Semrush_Client::keywords_from_csv( $phrase_related );
				$phrase_related_urls     = Neo_Pulse_App_Semrush_Client::urls_from_csv( $phrase_related );
			}

			$phrase_organic = Neo_Pulse_App_Semrush_Client::request_report(
				array_merge( $phrase_params, array( 'type' => 'phrase_organic' ) )
			);
			if ( is_wp_error( $phrase_organic ) ) {
				$errors[] = array( 'step' => 'phrase_organic', 'message' => $phrase_organic->get_error_message() );
			} else {
				$phrase_organic_urls = Neo_Pulse_App_Semrush_Client::urls_from_csv( $phrase_organic );
			}

			$phrase_this_params = array(
				'type'     => 'phrase_this',
				'database' => $database,
				'phrase'   => $phrase,
			);
			$phrase_this        = Neo_Pulse_App_Semrush_Client::request_report( $phrase_this_params );
			if ( is_wp_error( $phrase_this ) ) {
				$errors[] = array( 'step' => 'phrase_this', 'message' => $phrase_this->get_error_message() );
			}

			$phrase_kdi = Neo_Pulse_App_Semrush_Client::request_report(
				array_merge( $phrase_this_params, array( 'type' => 'phrase_kdi' ) )
			);
			if ( is_wp_error( $phrase_kdi ) ) {
				$errors[] = array( 'step' => 'phrase_kdi', 'message' => $phrase_kdi->get_error_message() );
			}

			if ( ! is_wp_error( $phrase_this ) || ! is_wp_error( $phrase_kdi ) ) {
				$keyword_overview = array(
					'phraseThis' => is_wp_error( $phrase_this ) ? null : $phrase_this,
					'phraseKdi'  => is_wp_error( $phrase_kdi ) ? null : $phrase_kdi,
				);
			}
		}

		$filtered = self::filter_reference_urls(
			$url_organic_urls,
			$phrase_related_urls,
			$phrase_organic_urls,
			$page_url,
			$blocked
		);

		return array(
			'skipped'               => false,
			'urlOrganicKeywords'    => $url_organic_keywords,
			'phraseRelatedKeywords' => $phrase_related_keywords,
			'urlOrganicUrls'        => $filtered['urlOrganicUrls'],
			'phraseRelatedUrls'     => $filtered['phraseRelatedUrls'],
			'phraseOrganicUrls'     => $filtered['phraseOrganicUrls'],
			'externalSemrushUrls'   => $filtered['externalSemrushUrls'],
			'keywordOverview'       => $keyword_overview,
			'errors'                => $errors,
		);
	}

	/**
	 * @param mixed $raw
	 * @return string[]|null
	 */
	private static function sanitize_blocked_hosts( $raw ): ?array {
		if ( ! is_array( $raw ) || $raw === array() ) {
			return null;
		}
		$out = array();
		foreach ( array_slice( $raw, 0, 200 ) as $item ) {
			if ( ! is_string( $item ) ) {
				continue;
			}
			$t = trim( $item );
			if ( $t === '' || strlen( $t ) > 253 ) {
				continue;
			}
			$out[] = $t;
		}
		return $out !== array() ? $out : null;
	}

	/**
	 * @param string[]      $url_organic_urls
	 * @param string[]      $phrase_related_urls
	 * @param string[]      $phrase_organic_urls
	 * @param string        $page_url
	 * @param string[]|null $blocked_hosts
	 * @return array{urlOrganicUrls:string[],phraseRelatedUrls:string[],phraseOrganicUrls:string[],externalSemrushUrls:string[]}
	 */
	private static function filter_reference_urls(
		array $url_organic_urls,
		array $phrase_related_urls,
		array $phrase_organic_urls,
		string $page_url,
		?array $blocked_hosts
	): array {
		$page_host = '';
		$norm      = Neo_Pulse_App_Semrush_Client::normalize_url( $page_url );
		if ( $norm !== '' ) {
			$h = wp_parse_url( $norm, PHP_URL_HOST );
			if ( is_string( $h ) ) {
				$page_host = strtolower( preg_replace( '/^www\./', '', $h ) );
			}
		}

		$blocked = array();
		if ( is_array( $blocked_hosts ) ) {
			foreach ( $blocked_hosts as $h ) {
				$blocked[ strtolower( $h ) ] = true;
			}
		}

		$filter = static function ( array $urls ) use ( $page_host, $blocked ): array {
			$out = array();
			foreach ( $urls as $u ) {
				$host = wp_parse_url( $u, PHP_URL_HOST );
				if ( ! is_string( $host ) ) {
					continue;
				}
				$host = strtolower( preg_replace( '/^www\./', '', $host ) );
				if ( $page_host !== '' && $host === $page_host ) {
					continue;
				}
				if ( isset( $blocked[ $host ] ) ) {
					continue;
				}
				$out[] = $u;
			}
			return $out;
		};

		$uo = $filter( $url_organic_urls );
		$pr = $filter( $phrase_related_urls );
		$po = $filter( $phrase_organic_urls );

		$external = array_values(
			array_unique(
				array_merge( $pr, $po )
			)
		);

		return array(
			'urlOrganicUrls'      => $uo,
			'phraseRelatedUrls'   => $pr,
			'phraseOrganicUrls'   => $po,
			'externalSemrushUrls' => $external,
		);
	}
}
