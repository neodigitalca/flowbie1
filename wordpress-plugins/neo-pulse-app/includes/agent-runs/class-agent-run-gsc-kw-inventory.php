<?php
/**
 * GSC + Semrush site-kw JSON inventory (parity with prompt-bulk-site-kw-scrape.ts).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Gsc_Kw_Inventory {

	/**
	 * @param array<string,mixed> $site
	 * @return array{json:string,payload:array<string,mixed>,name:string,rowCount:int}
	 */
	public static function build_site_kw_json( array $site ): array {
		$site_url = trim( (string) ( $site['siteUrl'] ?? '' ) );
		$company  = trim( (string) ( $site['name'] ?? '' ) );

		$gsc_rows    = self::fetch_gsc_queries( $site_url );
		$semrush_rows = self::fetch_semrush_phrases( $site_url );

		$payload = array(
			'siteUrl'     => $site_url,
			'generatedAt' => gmdate( 'c' ),
			'sortMethod'  => 'Metrics were used locally, then removed. Semrush is listed first and sorted by volume/traffic with ranking position boost. GSC is second, sorted by low-hanging opportunity using impressions, CTR gap, and position 4-20 boost.',
			'semrush'     => self::unique_keywords( $semrush_rows, 100, $company ),
			'gsc'         => self::unique_keywords( $gsc_rows, 500, $company ),
		);

		$name = self::artifact_name( $site_url );
		$json = wp_json_encode( $payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ?: '{}';

		return array(
			'json'     => $json,
			'payload'  => $payload,
			'name'     => $name,
			'rowCount' => count( $payload['gsc'] ) + count( $payload['semrush'] ),
		);
	}

	public static function artifact_name( string $site_url ): string {
		$host = preg_replace( '/^https?:\\/\\//', '', $site_url );
		$host = preg_replace( '/[^\\w.-]+/', '-', (string) $host );
		$host = substr( (string) $host, 0, 80 );
		if ( $host === '' ) {
			$host = 'site';
		}
		return 'site-kw-' . $host . '-' . gmdate( 'YmdHis' ) . '.json';
	}

	/**
	 * @return array<int,string>
	 */
	private static function fetch_gsc_queries( string $site_url ): array {
		if ( $site_url === '' ) {
			return array();
		}
		$end   = gmdate( 'Y-m-d', strtotime( '-1 day' ) );
		$start = gmdate( 'Y-m-d', strtotime( '-90 days' ) );
		$res   = Neo_Pulse_App_Gsc_Queries::fetch_queries(
			array(
				'siteUrl'   => $site_url,
				'startDate' => $start,
				'endDate'   => $end,
				'rowLimit'  => 500,
			)
		);
		$body = is_array( $res['body'] ?? null ) ? $res['body'] : array();
		if ( empty( $body['success'] ) || empty( $body['queries'] ) || ! is_array( $body['queries'] ) ) {
			return array();
		}

		$scored = array();
		foreach ( $body['queries'] as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$query = trim( (string) ( $row['query'] ?? '' ) );
			if ( $query === '' ) {
				continue;
			}
			$clicks      = (int) ( $row['clicks'] ?? 0 );
			$impressions = (int) ( $row['impressions'] ?? 0 );
			$ctr         = (float) ( $row['ctr'] ?? 0 );
			$position    = (float) ( $row['position'] ?? 0 );
			$scored[]    = array(
				'query' => $query,
				'score' => self::gsc_opportunity_score(
					array(
						'clicks'      => $clicks,
						'impressions' => $impressions,
						'ctr'         => $ctr,
						'position'    => $position,
					)
				),
			);
		}

		usort(
			$scored,
			static function ( $a, $b ) {
				return ( $b['score'] ?? 0 ) <=> ( $a['score'] ?? 0 );
			}
		);

		$out = array();
		foreach ( array_slice( $scored, 0, 500 ) as $row ) {
			$out[] = (string) $row['query'];
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $row
	 */
	private static function gsc_opportunity_score( array $row ): float {
		$impressions = max( 0, (int) ( $row['impressions'] ?? 0 ) );
		$position    = (float) ( $row['position'] ?? 0 );
		$position    = $position > 0 ? $position : 100;
		$ctr         = max( 0, (float) ( $row['ctr'] ?? 0 ) );
		$boost       = ( $position >= 4 && $position <= 20 ) ? 2 : 1;
		$ctr_gap     = max( 0.1, 1 - $ctr );
		return ( $impressions * $ctr_gap * $boost ) / $position;
	}

	/**
	 * @return array<int,string>
	 */
	private static function fetch_semrush_phrases( string $site_url ): array {
		if ( $site_url === '' || ! Neo_Pulse_App_Semrush_Client::has_api_key() ) {
			return array();
		}
		$url = Neo_Pulse_App_Semrush_Client::normalize_url( $site_url );
		if ( $url === '' ) {
			return array();
		}
		$csv = Neo_Pulse_App_Semrush_Client::request_report(
			array(
				'type'           => 'url_organic',
				'database'       => 'us',
				'url'            => $url,
				'display_limit'  => 100,
				'export_columns' => 'Ph',
			)
		);
		if ( is_wp_error( $csv ) || ! is_string( $csv ) ) {
			return array();
		}
		return array_slice( Neo_Pulse_App_Semrush_Client::keywords_from_csv( $csv ), 0, 100 );
	}

	/**
	 * @param array<int,string> $values
	 * @return array<int,string>
	 */
	private static function unique_keywords( array $values, int $limit, string $company_name ): array {
		$seen = array();
		$out  = array();
		foreach ( $values as $raw ) {
			$keyword = trim( preg_replace( '/\s+/', ' ', (string) $raw ) );
			if ( $keyword === '' ) {
				continue;
			}
			if ( $company_name !== '' && self::is_brand_keyword( $keyword, $company_name ) ) {
				continue;
			}
			$key = strtolower( $keyword );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$out[]        = $keyword;
			if ( count( $out ) >= $limit ) {
				break;
			}
		}
		return $out;
	}

	private static function is_brand_keyword( string $keyword, string $company_name ): bool {
		$kw  = strtolower( preg_replace( '/[^a-z0-9\s]+/i', '', $keyword ) );
		$co  = strtolower( preg_replace( '/[^a-z0-9\s]+/i', '', $company_name ) );
		$kw  = trim( preg_replace( '/\s+/', ' ', $kw ) );
		$co  = trim( preg_replace( '/\s+/', ' ', $co ) );
		if ( $kw === '' || $co === '' ) {
			return false;
		}
		return $kw === $co || strpos( $kw, $co ) !== false || strpos( $co, $kw ) !== false;
	}
}
