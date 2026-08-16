<?php
/**
 * DataForSEO Labs competitor research (mirrors server/dfs-organic-competitors.js).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Dataforseo_Organic_Competitors {

	const DEFAULT_DISPLAY_LIMIT           = 50;
	const DEFAULT_ENRICHMENT_CAP            = 15;
	const SEED_DOMAIN_ORGANIC_LIMIT       = 25;
	const ENRICHMENT_DOMAIN_ORGANIC_LIMIT = 25;
	const DOMAIN_ORGANIC_CSV_TOP_ROWS     = 25;
	const ENRICHMENT_DEADLINE_SEC         = 120;

	/**
	 * @param array<string,mixed> $opts
	 * @return array<string,mixed>
	 */
	public static function run( array $opts ): array {
		$site_url       = isset( $opts['siteUrl'] ) ? (string) $opts['siteUrl'] : '';
		$display_limit  = self::int_limit( $opts['displayLimit'] ?? null, self::DEFAULT_DISPLAY_LIMIT, 1000 );
		$enrichment_cap = self::int_limit( $opts['enrichmentCap'] ?? null, self::DEFAULT_ENRICHMENT_CAP, 50 );
		$blocked        = Neo_Pulse_App_Semrush_Competitor_Shared::sanitize_portfolio_blocked_hosts( $opts['portfolioBlockedHosts'] ?? null );
		$blocked_list   = is_array( $blocked ) ? $blocked : array();

		$empty  = self::empty_payload();
		$domain = Neo_Pulse_App_Semrush_Competitor_Shared::domain_from_site_url( $site_url );
		if ( $domain === '' ) {
			$empty['errors'][] = array( 'step' => 'validate', 'message' => 'Invalid or empty siteUrl' );
			return $empty;
		}

		$errors        = array();
		$language_code = 'en';
		$location_code = self::location_code_from_site_url( $site_url );
		$seed_key      = Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $domain );
		$target_norm   = $seed_key;

		$rows     = array();
		$comp_res = self::post(
			'/dataforseo_labs/google/competitors_domain/live',
			array(
				array(
					'target'              => $target_norm,
					'language_code'       => $language_code,
					'location_code'       => $location_code,
					'limit'               => min( max( 1, $display_limit ), 1000 ),
					'exclude_top_domains' => true,
					'item_types'          => array( 'organic' ),
				),
			),
			120
		);
		if ( is_wp_error( $comp_res ) ) {
			$errors[] = array( 'step' => 'competitors_domain', 'message' => $comp_res->get_error_message() );
		} elseif ( Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::assert_task_ok( $comp_res, 'competitors_domain', $errors ) ) {
			foreach ( Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::extract_competitors_items( $comp_res ) as $it ) {
				if ( ! is_array( $it ) ) {
					continue;
				}
				$row = Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::map_competitor_item_to_row( $it );
				if ( $row === null ) {
					continue;
				}
				if ( Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $row['domain'] ) === $seed_key ) {
					continue;
				}
				if ( Neo_Pulse_App_Semrush_Competitor_Shared::is_portfolio_blocked_domain( $row['domain'], $blocked_list ) ) {
					continue;
				}
				$rows[] = $row;
			}
			usort(
				$rows,
				static function ( $a, $b ) {
					return ( $b['commonKeywords'] ?? 0 ) <=> ( $a['commonKeywords'] ?? 0 );
				}
			);
		}

		$seed_metrics = null;
		$overview_res = self::post(
			'/dataforseo_labs/google/domain_rank_overview/live',
			array(
				array(
					'target'        => $target_norm,
					'language_code' => $language_code,
					'location_code' => $location_code,
				),
			),
			120
		);
		if ( is_wp_error( $overview_res ) ) {
			$errors[] = array( 'step' => 'domain_rank_overview:seed', 'message' => $overview_res->get_error_message() );
		} elseif ( Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::assert_task_ok( $overview_res, 'domain_rank_overview:seed', $errors ) ) {
			$seed_metrics = Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::seed_metrics_from_domain_rank_overview( $overview_res );
		}

		$seed_top_keywords = array();
		$seed_kw_res       = self::post(
			'/dataforseo_labs/google/ranked_keywords/live',
			array(
				array(
					'target'        => $target_norm,
					'language_code' => $language_code,
					'location_code' => $location_code,
					'limit'         => self::SEED_DOMAIN_ORGANIC_LIMIT,
					'item_types'    => array( 'organic' ),
					'order_by'      => array( 'keyword_data.keyword_info.search_volume,desc' ),
				),
			),
			120
		);
		if ( is_wp_error( $seed_kw_res ) ) {
			$errors[] = array( 'step' => 'ranked_keywords:seed', 'message' => $seed_kw_res->get_error_message() );
		} elseif ( Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::assert_task_ok( $seed_kw_res, 'ranked_keywords:seed', $errors ) ) {
			$seed_top_keywords = Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::top_keywords_from_ranked_response( $seed_kw_res, self::SEED_DOMAIN_ORGANIC_LIMIT );
		}

		$enrichment_by_domain = array();
		$domain_organic_csv   = array();
		$to_enrich            = Neo_Pulse_App_Semrush_Competitor_Shared::domains_for_enrichment( $rows, $enrichment_cap );
		$deadline             = time() + self::ENRICHMENT_DEADLINE_SEC;

		foreach ( $to_enrich as $d ) {
			if ( time() > $deadline ) {
				$errors[] = array(
					'step'    => 'enrichment',
					'message' => 'Enrichment stopped after overall timeout; some competitors may lack keyword lists.',
				);
				break;
			}
			$top_kw = self::fetch_ranked_keywords_for_domain( $d, $location_code, $language_code, $errors );
			$key = Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $d );
			$enrichment_by_domain[ $key ] = array( 'topKeywords' => $top_kw );
			$domain_organic_csv[ $key ]   = Neo_Pulse_App_Semrush_Competitor_Shared::build_domain_organic_csv( $top_kw, self::DOMAIN_ORGANIC_CSV_TOP_ROWS );
		}

		return array(
			'seedDomain'               => $domain,
			'database'                 => 'dfs',
			'dataSource'               => 'dfs',
			'rows'                     => $rows,
			'seedMetrics'              => $seed_metrics,
			'seedTopKeywords'          => $seed_top_keywords,
			'seedOverview'             => null,
			'seedDomainOrganicCsv'     => Neo_Pulse_App_Semrush_Competitor_Shared::build_domain_organic_csv( $seed_top_keywords, self::DOMAIN_ORGANIC_CSV_TOP_ROWS ),
			'domainOrganicCsvByDomain' => $domain_organic_csv,
			'enrichmentByDomain'       => $enrichment_by_domain,
			'errors'                   => $errors,
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function run_seed_ranked_keywords_only( string $site_url ): array {
		$errors        = array();
		$domain        = Neo_Pulse_App_Semrush_Competitor_Shared::domain_from_site_url( $site_url );
		$language_code = 'en';
		$location_code = self::location_code_from_site_url( $site_url );

		if ( $domain === '' ) {
			return array(
				'seedDomain'      => '',
				'database'        => 'dfs',
				'dataSource'      => 'dfs',
				'seedTopKeywords' => array(),
				'errors'          => array( array( 'step' => 'validate', 'message' => 'Invalid or empty siteUrl' ) ),
			);
		}

		$target_norm       = Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $domain );
		$seed_top_keywords = array();
		$seed_kw_res       = self::post(
			'/dataforseo_labs/google/ranked_keywords/live',
			array(
				array(
					'target'        => $target_norm,
					'language_code' => $language_code,
					'location_code' => $location_code,
					'limit'         => self::SEED_DOMAIN_ORGANIC_LIMIT,
					'item_types'    => array( 'organic' ),
					'order_by'      => array( 'keyword_data.keyword_info.search_volume,desc' ),
				),
			),
			120
		);
		if ( is_wp_error( $seed_kw_res ) ) {
			$errors[] = array( 'step' => 'ranked_keywords:seed', 'message' => $seed_kw_res->get_error_message() );
		} elseif ( Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::assert_task_ok( $seed_kw_res, 'ranked_keywords:seed', $errors ) ) {
			$seed_top_keywords = Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::top_keywords_from_ranked_response( $seed_kw_res, self::SEED_DOMAIN_ORGANIC_LIMIT );
		}

		return array(
			'seedDomain'      => $target_norm,
			'database'        => 'dfs',
			'dataSource'      => 'dfs',
			'seedTopKeywords' => $seed_top_keywords,
			'errors'          => $errors,
		);
	}

	/**
	 * @param array<string,mixed> $opts
	 * @return array<string,mixed>
	 */
	public static function run_manual_domain( array $opts ): array {
		$site_url = isset( $opts['siteUrl'] ) ? (string) $opts['siteUrl'] : '';
		$raw      = isset( $opts['domain'] ) ? trim( (string) $opts['domain'] ) : '';
		$errors   = array();

		$dk = strtolower(
			preg_replace(
				'/^www\./i',
				'',
				explode( '/', preg_replace( '#^https?://#i', '', $raw ) )[0]
			)
		);
		if ( $dk === '' ) {
			return array(
				'row'              => null,
				'enrichment'       => null,
				'domainOrganicCsv' => '',
				'errors'           => array( array( 'step' => 'validate', 'message' => 'Invalid domain' ) ),
			);
		}

		$location_code = self::location_code_from_site_url( $site_url !== '' ? $site_url : 'https://' . $dk );
		$language_code = 'en';

		$overview_res = self::post(
			'/dataforseo_labs/google/domain_rank_overview/live',
			array(
				array(
					'target'        => $dk,
					'language_code' => $language_code,
					'location_code' => $location_code,
				),
			),
			120
		);
		$seed_metrics = null;
		if ( is_wp_error( $overview_res ) ) {
			$errors[] = array( 'step' => 'domain_rank_overview:manual', 'message' => $overview_res->get_error_message() );
		} elseif ( Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::assert_task_ok( $overview_res, 'domain_rank_overview:manual', $errors ) ) {
			$seed_metrics = Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::seed_metrics_from_domain_rank_overview( $overview_res );
		}

		if ( $seed_metrics === null ) {
			return array(
				'row'              => null,
				'enrichment'       => null,
				'domainOrganicCsv' => '',
				'errors'           => $errors !== array() ? $errors : array(
					array( 'step' => 'manual:overview', 'message' => 'No DataForSEO domain metrics for this domain.' ),
				),
			);
		}

		$top_keywords = self::fetch_ranked_keywords_for_domain( $dk, $location_code, $language_code, $errors );

		return array(
			'row'              => array(
				'domain'           => $dk,
				'competitionLevel' => null,
				'commonKeywords'   => null,
				'organicTraffic'   => $seed_metrics['organicTraffic'],
				'trafficCost'      => $seed_metrics['trafficCost'],
				'organicKeywords'  => $seed_metrics['organicKeywords'],
				'adsKeywords'      => $seed_metrics['adsKeywords'],
			),
			'enrichment'       => array( 'topKeywords' => $top_keywords ),
			'domainOrganicCsv' => Neo_Pulse_App_Semrush_Competitor_Shared::build_domain_organic_csv( $top_keywords, self::DOMAIN_ORGANIC_CSV_TOP_ROWS ),
			'errors'           => $errors,
		);
	}

	/**
	 * @param array<int,mixed> $tasks
	 * @return array<string,mixed>|WP_Error
	 */
	private static function post( string $endpoint, array $tasks, int $timeout_sec ) {
		return Neo_Pulse_App_Dataforseo_Client::post( $endpoint, $tasks, array( 'timeout' => $timeout_sec * 1000 ) );
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function empty_payload(): array {
		return array(
			'seedDomain'               => '',
			'database'                 => 'dfs',
			'dataSource'               => 'dfs',
			'rows'                     => array(),
			'seedMetrics'              => null,
			'seedTopKeywords'          => array(),
			'seedOverview'             => null,
			'seedDomainOrganicCsv'     => '',
			'domainOrganicCsvByDomain' => array(),
			'enrichmentByDomain'       => array(),
			'errors'                   => array(),
		);
	}

	public static function location_code_from_site_url( string $site_url ): int {
		$s = trim( $site_url );
		if ( $s === '' ) {
			return 2840;
		}
		if ( ! preg_match( '#^https?://#i', $s ) ) {
			$s = 'https://' . $s;
		}
		$host = wp_parse_url( $s, PHP_URL_HOST );
		if ( ! is_string( $host ) ) {
			return 2840;
		}
		$host = strtolower( preg_replace( '/^www\./', '', $host ) );
		if ( substr( $host, -3 ) === '.ca' ) {
			return 2124;
		}
		if ( substr( $host, -6 ) === '.co.uk' || substr( $host, -3 ) === '.uk' ) {
			return 2826;
		}
		if ( substr( $host, -6 ) === '.com.au' ) {
			return 2036;
		}
		if ( substr( $host, -3 ) === '.de' ) {
			return 2276;
		}
		if ( substr( $host, -3 ) === '.fr' ) {
			return 2250;
		}
		return 2840;
	}

	/**
	 * @param array<int,array{step:string,message:string}> $errors
	 * @return array<int,array{phrase:string,volume:?float,traffic:?float,position:?float}>
	 */
	private static function fetch_ranked_keywords_for_domain( string $target_domain, int $location_code, string $language_code, array &$errors ): array {
		$norm = Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $target_domain );
		$res  = self::post(
			'/dataforseo_labs/google/ranked_keywords/live',
			array(
				array(
					'target'        => $norm,
					'language_code' => $language_code,
					'location_code' => $location_code,
					'limit'         => self::ENRICHMENT_DOMAIN_ORGANIC_LIMIT,
					'item_types'    => array( 'organic' ),
					'order_by'      => array( 'keyword_data.keyword_info.search_volume,desc' ),
				),
			),
			120
		);
		if ( is_wp_error( $res ) ) {
			$errors[] = array( 'step' => 'ranked_keywords:' . $norm, 'message' => $res->get_error_message() );
			return array();
		}
		if ( ! Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::assert_task_ok( $res, 'ranked_keywords:' . $norm, $errors ) ) {
			return array();
		}
		return Neo_Pulse_App_Dataforseo_Organic_Competitors_Parse::top_keywords_from_ranked_response( $res, self::ENRICHMENT_DOMAIN_ORGANIC_LIMIT );
	}

	/**
	 * @param mixed $raw
	 */
	private static function int_limit( $raw, int $default, int $max ): int {
		if ( is_numeric( $raw ) && (float) $raw > 0 ) {
			return (int) min( (int) floor( (float) $raw ), $max );
		}
		return $default;
	}
}
