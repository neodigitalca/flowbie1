<?php
/**
 * Semrush Organic Research competitor flow (Analytics API; mirrors Node semrush-organic-competitors.js).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Semrush_Organic_Competitors {

	/**
	 * @param array<string,mixed> $opts
	 * @return array<string,mixed>
	 */
	public static function run( array $opts ): array {
		$site_url = isset( $opts['siteUrl'] ) ? (string) $opts['siteUrl'] : '';
		$database = Neo_Pulse_App_Semrush_Competitor_Shared::resolve_database(
			$opts['database'] ?? null,
			$site_url,
			'us'
		);
		$display_limit = self::int_limit( $opts['displayLimit'] ?? null, Neo_Pulse_App_Semrush_Competitor_Shared::DEFAULT_DISPLAY_LIMIT, 1000 );
		$enrichment_cap  = self::int_limit( $opts['enrichmentCap'] ?? null, Neo_Pulse_App_Semrush_Competitor_Shared::DEFAULT_ENRICHMENT_CAP, 50 );
		$blocked         = Neo_Pulse_App_Semrush_Competitor_Shared::sanitize_portfolio_blocked_hosts( $opts['portfolioBlockedHosts'] ?? null );
		$blocked_list    = is_array( $blocked ) ? $blocked : array();

		$empty = array(
			'seedDomain'              => '',
			'database'                => $database,
			'rows'                    => array(),
			'seedMetrics'             => null,
			'seedTopKeywords'         => array(),
			'seedOverview'            => null,
			'seedDomainOrganicCsv'    => '',
			'domainOrganicCsvByDomain' => array(),
			'enrichmentByDomain'      => array(),
			'errors'                  => array(),
		);

		$domain = Neo_Pulse_App_Semrush_Competitor_Shared::domain_from_site_url( $site_url );
		if ( $domain === '' ) {
			$empty['errors'][] = array( 'step' => 'validate', 'message' => 'Invalid or empty siteUrl' );
			return $empty;
		}

		$errors = array();
		$seed_key = Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $domain );

		$rank_csv = self::request( 'domain_rank', $database, $domain, array(
			'display_limit'  => 1,
			'export_columns' => Neo_Pulse_App_Semrush_Competitor_Shared::EXPORT_SEED_RANK,
		), $errors, 'seed:domain_rank' );

		$seed_kw_csv = self::request( 'domain_organic', $database, $domain, array(
			'display_limit'  => Neo_Pulse_App_Semrush_Competitor_Shared::SEED_DOMAIN_ORGANIC_LIMIT,
			'display_sort'   => 'tr_desc',
			'export_columns' => Neo_Pulse_App_Semrush_Competitor_Shared::EXPORT_DOMAIN_ORGANIC_KW,
		), $errors, 'seed:domain_organic' );

		$comp_csv = self::request( 'domain_organic_organic', $database, $domain, array(
			'display_limit'  => $display_limit,
			'display_sort'   => 'np_desc',
			'export_columns' => Neo_Pulse_App_Semrush_Competitor_Shared::EXPORT_COMPETITORS,
		), $errors, 'execute_report:domain_organic_organic' );

		$rank_row = is_string( $rank_csv ) ? self::pick_seed_rank_row( $rank_csv, $domain ) : null;
		$seed_metrics = $rank_row ? array(
			'organicKeywords' => $rank_row['organicKeywords'],
			'organicTraffic'  => $rank_row['organicTraffic'],
			'trafficCost'     => $rank_row['trafficCost'],
			'adsKeywords'     => $rank_row['adsKeywords'],
		) : null;

		$seed_top_keywords = is_string( $seed_kw_csv )
			? Neo_Pulse_App_Semrush_Competitor_Shared::extract_top_keywords_from_csv(
				$seed_kw_csv,
				Neo_Pulse_App_Semrush_Competitor_Shared::SEED_DOMAIN_ORGANIC_LIMIT
			)
			: array();

		$rows = is_string( $comp_csv ) ? Neo_Pulse_App_Semrush_Competitor_Shared::extract_competitor_rows( $comp_csv ) : array();
		$rows = array_values(
			array_filter(
				$rows,
				static function ( $row ) use ( $seed_key, $blocked_list ) {
					if ( Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $row['domain'] ) === $seed_key ) {
						return false;
					}
					return ! Neo_Pulse_App_Semrush_Competitor_Shared::is_portfolio_blocked_domain( $row['domain'], $blocked_list );
				}
			)
		);
		usort(
			$rows,
			static function ( $a, $b ) {
				return ( $b['commonKeywords'] ?? 0 ) <=> ( $a['commonKeywords'] ?? 0 );
			}
		);

		$enrichment_by_domain = array();
		$domain_organic_csv   = array();
		$to_enrich            = Neo_Pulse_App_Semrush_Competitor_Shared::domains_for_enrichment( $rows, $enrichment_cap );
		$deadline             = time() + Neo_Pulse_App_Semrush_Competitor_Shared::ENRICHMENT_DEADLINE_SEC;

		foreach ( $to_enrich as $d ) {
			if ( time() > $deadline ) {
				$errors[] = array(
					'step'    => 'enrichment',
					'message' => 'Enrichment stopped after overall timeout; some competitors may lack keyword lists.',
				);
				break;
			}
			$kw_csv = self::request( 'domain_organic', $database, $d, array(
				'display_limit'  => Neo_Pulse_App_Semrush_Competitor_Shared::ENRICHMENT_DOMAIN_ORGANIC_LIMIT,
				'display_sort'   => 'tr_desc',
				'export_columns' => Neo_Pulse_App_Semrush_Competitor_Shared::EXPORT_DOMAIN_ORGANIC_KW,
			), $errors, 'enrich:' . $d . ':domain_organic' );

			$top_kw = is_string( $kw_csv )
				? Neo_Pulse_App_Semrush_Competitor_Shared::extract_top_keywords_from_csv( $kw_csv )
				: array();
			$key = Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $d );
			$enrichment_by_domain[ $key ] = array( 'topKeywords' => $top_kw );
			$domain_organic_csv[ $key ]   = Neo_Pulse_App_Semrush_Competitor_Shared::build_domain_organic_csv( $top_kw );
		}

		return array(
			'seedDomain'              => $domain,
			'database'                => $database,
			'rows'                    => $rows,
			'seedMetrics'             => $seed_metrics,
			'seedTopKeywords'         => $seed_top_keywords,
			'seedOverview'            => null,
			'seedDomainOrganicCsv'    => Neo_Pulse_App_Semrush_Competitor_Shared::build_domain_organic_csv( $seed_top_keywords ),
			'domainOrganicCsvByDomain' => $domain_organic_csv,
			'enrichmentByDomain'      => $enrichment_by_domain,
			'errors'                  => $errors,
		);
	}

	/**
	 * @param array<string,mixed> $opts
	 * @return array<string,mixed>
	 */
	public static function run_manual_domain( array $opts ): array {
		$site_url = isset( $opts['siteUrl'] ) ? (string) $opts['siteUrl'] : '';
		$database = Neo_Pulse_App_Semrush_Competitor_Shared::resolve_database(
			$opts['database'] ?? null,
			$site_url,
			'us'
		);
		$raw_domain = isset( $opts['domain'] ) ? trim( (string) $opts['domain'] ) : '';
		$dk         = Neo_Pulse_App_Semrush_Competitor_Shared::hostname_from_domain_field( $raw_domain );
		$errors     = array();

		if ( $dk === '' ) {
			return array(
				'row'              => null,
				'enrichment'       => null,
				'domainOrganicCsv' => '',
				'errors'           => array( array( 'step' => 'validate', 'message' => 'Invalid domain' ) ),
			);
		}

		$rank_csv = self::request( 'domain_rank', $database, $dk, array(
			'display_limit'  => 1,
			'export_columns' => Neo_Pulse_App_Semrush_Competitor_Shared::EXPORT_SEED_RANK,
		), $errors, 'manual:domain_rank:' . $dk );

		$rank_row = is_string( $rank_csv ) ? self::pick_rank_row_strict( $rank_csv, $dk ) : null;
		if ( $rank_row === null ) {
			$errors[] = array(
				'step'    => 'manual:domain_rank',
				'message' => 'No Semrush domain_rank or domain_organic data for this domain.',
			);
			return array(
				'row'              => null,
				'enrichment'       => null,
				'domainOrganicCsv' => '',
				'errors'           => $errors,
			);
		}

		$row = array_merge(
			$rank_row,
			array(
				'domain'           => $dk,
				'commonKeywords'   => null,
				'competitionLevel' => null,
			)
		);

		$kw_csv = self::request( 'domain_organic', $database, $dk, array(
			'display_limit'  => Neo_Pulse_App_Semrush_Competitor_Shared::ENRICHMENT_DOMAIN_ORGANIC_LIMIT,
			'display_sort'   => 'tr_desc',
			'export_columns' => Neo_Pulse_App_Semrush_Competitor_Shared::EXPORT_DOMAIN_ORGANIC_KW,
		), $errors, 'enrich:' . $dk . ':domain_organic' );

		$top_kw = is_string( $kw_csv )
			? Neo_Pulse_App_Semrush_Competitor_Shared::extract_top_keywords_from_csv( $kw_csv )
			: array();

		return array(
			'row'              => $row,
			'enrichment'       => array( 'topKeywords' => $top_kw ),
			'domainOrganicCsv' => Neo_Pulse_App_Semrush_Competitor_Shared::build_domain_organic_csv( $top_kw ),
			'errors'           => $errors,
		);
	}

	/**
	 * @param array<int,array{step:string,message:string}> $errors
	 */
	private static function request( string $type, string $database, string $domain, array $extra, array &$errors, string $step ): ?string {
		$params = array_merge(
			array(
				'type'     => $type,
				'database' => $database,
				'domain'   => $domain,
			),
			$extra
		);
		$result = Neo_Pulse_App_Semrush_Client::request_report( $params );
		if ( is_wp_error( $result ) ) {
			$errors[] = array( 'step' => $step, 'message' => $result->get_error_message() );
			return null;
		}
		return (string) $result;
	}

	/**
	 * @return array{domain:string,competitionLevel:?float,commonKeywords:?float,organicTraffic:?float,trafficCost:?float,organicKeywords:?float,adsKeywords:?float}|null
	 */
	private static function pick_seed_rank_row( string $csv, string $seed_domain ): ?array {
		$rows = Neo_Pulse_App_Semrush_Competitor_Shared::extract_competitor_rows( $csv );
		$sd   = Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $seed_domain );
		foreach ( $rows as $row ) {
			if ( Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $row['domain'] ) === $sd ) {
				return $row;
			}
		}
		return $rows[0] ?? null;
	}

	/**
	 * @return array{domain:string,competitionLevel:?float,commonKeywords:?float,organicTraffic:?float,trafficCost:?float,organicKeywords:?float,adsKeywords:?float}|null
	 */
	private static function pick_rank_row_strict( string $csv, string $seed_domain ): ?array {
		$rows = Neo_Pulse_App_Semrush_Competitor_Shared::extract_competitor_rows( $csv );
		$sd   = Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $seed_domain );
		foreach ( $rows as $row ) {
			if ( Neo_Pulse_App_Semrush_Competitor_Shared::clean_domain_key( $row['domain'] ) === $sd ) {
				return $row;
			}
		}
		return null;
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
