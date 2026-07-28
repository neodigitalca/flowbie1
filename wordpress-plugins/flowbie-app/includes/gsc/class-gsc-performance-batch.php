<?php
/**
 * GSC batch performance: top pages, URL inventory, site/page batches, historical, entity paths.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Gsc_Performance_Batch {

	const EXPORT_PAGE_CONCURRENCY              = 5;
	const SITEMAP_OPTIMIZER_PAGE_CONCURRENCY = 10;

	/** @param array<string,mixed> $body */
	public static function top_pages( array $body ): array {
		$site_url = trim( (string) ( $body['siteUrl'] ?? '' ) );
		if ( $site_url === '' || empty( $body['startDate'] ) || empty( $body['endDate'] ) ) {
			return self::err( 400, 'Missing siteUrl, startDate, endDate' );
		}
		$dv = Flowbie_App_Gsc_Service_Account::validate_dates( $body['startDate'], $body['endDate'] );
		if ( empty( $dv['valid'] ) ) {
			return self::err( 400, $dv['error'] ?? 'Invalid date range' );
		}
		$resolved = Flowbie_App_Gsc_Service_Account::resolve_or_fallback( $site_url, $dv['startDateStr'], $dv['endDateStr'], 'page' );
		if ( ! $resolved['property'] ) {
			$email = Flowbie_App_Gsc_Service_Account::service_account_email();
			return self::err( 403, "Add {$email} in GSC. Use \"Test connection\" in Flowbie.", array( 'errorType' => 'site_not_in_list', 'originalSiteUrl' => $site_url, 'serviceAccountEmail' => $email ) );
		}
		$limit = min( max( (int) ( $body['limit'] ?? 20 ), 1 ), 1000 );
		$res   = Flowbie_App_Gsc_Service_Account::search_analytics_query(
			$resolved['property'],
			array(
				'startDate'  => $dv['startDateStr'],
				'endDate'    => $dv['endDateStr'],
				'dimensions' => array( 'page' ),
				'rowLimit'   => $limit,
			)
		);
		if ( is_wp_error( $res ) ) {
			return self::err( 500, $res->get_error_message() ?: 'Failed to fetch top pages' );
		}
		$pages = array();
		foreach ( ( $res['rows'] ?? array() ) as $row ) {
			$pages[] = array(
				'url'         => (string) ( $row['keys'][0] ?? '' ),
				'impressions' => (int) ( $row['impressions'] ?? 0 ),
				'clicks'      => (int) ( $row['clicks'] ?? 0 ),
				'position'    => (float) ( $row['position'] ?? 0 ),
			);
		}
		return array( 'statusCode' => 200, 'body' => array( 'success' => true, 'pages' => $pages ) );
	}

	/** @param array<string,mixed> $body */
	public static function url_inventory( array $body ): array {
		$site_url = trim( (string) ( $body['siteUrl'] ?? '' ) );
		if ( $site_url === '' || empty( $body['startDate'] ) || empty( $body['endDate'] ) ) {
			return self::err( 400, 'Missing siteUrl, startDate, endDate' );
		}
		$dv = Flowbie_App_Gsc_Service_Account::validate_dates( $body['startDate'], $body['endDate'] );
		if ( empty( $dv['valid'] ) ) {
			return self::err( 400, $dv['error'] ?? 'Invalid date range' );
		}
		$row_limit = min( max( (int) ( $body['limit'] ?? 25000 ), 1 ), 25000 );
		$resolved  = Flowbie_App_Gsc_Service_Account::resolve_or_fallback( $site_url, $dv['startDateStr'], $dv['endDateStr'], 'page' );
		if ( ! $resolved['property'] ) {
			$email = Flowbie_App_Gsc_Service_Account::service_account_email();
			return self::err( 403, "Could not find GSC property. Add {$email} in GSC.", array( 'errorType' => 'site_not_in_list', 'originalSiteUrl' => $site_url, 'serviceAccountEmail' => $email ) );
		}
		$res = Flowbie_App_Gsc_Service_Account::search_analytics_query(
			$resolved['property'],
			array(
				'startDate'  => $dv['startDateStr'],
				'endDate'    => $dv['endDateStr'],
				'dimensions' => array( 'page' ),
				'rowLimit'   => $row_limit,
			)
		);
		if ( is_wp_error( $res ) ) {
			return self::err( 500, $res->get_error_message() ?: 'Failed to fetch URL inventory' );
		}
		$url_set = array();
		foreach ( ( $res['rows'] ?? array() ) as $row ) {
			$u = (string) ( $row['keys'][0] ?? '' );
			if ( $u !== '' ) {
				$url_set[ $u ] = true;
			}
		}
		$urls = array_keys( $url_set );
		sort( $urls, SORT_STRING );
		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'     => true,
				'property'    => $resolved['property'],
				'startDate'   => $dv['startDateStr'],
				'endDate'     => $dv['endDateStr'],
				'totalRows'   => count( $urls ),
				'urls'        => $urls,
				'disclaimer'  => 'Google\'s Search Console API does not export the Indexing → Indexed pages report. This list is every URL that had at least one impression in Google Search in the selected date range (Search Analytics, page dimension). URLs with zero impressions in that period are omitted.',
			),
		);
	}

	/** @param array<string,mixed> $body */
	public static function fetch_site_pages_performance( array $body ): array {
		$site_url = trim( (string) ( $body['siteUrl'] ?? '' ) );
		if ( $site_url === '' ) {
			return self::err( 400, 'Missing siteUrl' );
		}
		if ( empty( $body['startDate'] ) || empty( $body['endDate'] ) ) {
			return self::err( 400, 'Missing startDate or endDate' );
		}
		$dv = Flowbie_App_Gsc_Service_Account::validate_dates( $body['startDate'], $body['endDate'] );
		if ( empty( $dv['valid'] ) ) {
			return self::err( 400, $dv['error'] ?? 'Invalid date range' );
		}
		$resolved = Flowbie_App_Gsc_Service_Account::resolve_or_fallback( $site_url, $dv['startDateStr'], $dv['endDateStr'], 'page' );
		if ( ! $resolved['property'] ) {
			return array( 'statusCode' => 404, 'body' => Flowbie_App_Gsc_Service_Account::property_error_payload( $resolved['matchDetails'] ) );
		}
		$rows  = Flowbie_App_Gsc_Performance::fetch_all_search_analytics_rows(
			$resolved['property'],
			array(
				'startDate'  => $dv['startDateStr'],
				'endDate'    => $dv['endDateStr'],
				'dimensions' => array( 'page' ),
			)
		);
		$pages = array();
		foreach ( $rows as $row ) {
			$page_url = trim( (string) ( $row['keys'][0] ?? '' ) );
			if ( $page_url === '' ) {
				continue;
			}
			$clicks      = (int) ( $row['clicks'] ?? 0 );
			$impressions = (int) ( $row['impressions'] ?? 0 );
			$pages[]     = array(
				'pageUrl'     => $page_url,
				'clicks'      => $clicks,
				'impressions' => $impressions,
				'ctr'         => isset( $row['ctr'] ) ? (float) $row['ctr'] : ( $impressions > 0 ? $clicks / $impressions : 0 ),
				'position'    => (float) ( $row['position'] ?? 0 ),
			);
		}
		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'    => true,
				'siteUrl'    => $site_url,
				'dateRange'  => array( 'startDate' => $dv['startDateStr'], 'endDate' => $dv['endDateStr'] ),
				'property'   => $resolved['property'],
				'totalPages' => count( $pages ),
				'pages'      => $pages,
			),
		);
	}

	/** @param array<string,mixed> $body */
	public static function fetch_pages_performance( array $body ): array {
		$site_url = trim( (string) ( $body['siteUrl'] ?? '' ) );
		if ( $site_url === '' ) {
			return self::err( 400, 'Missing siteUrl' );
		}
		$urls_in = isset( $body['pageUrls'] ) && is_array( $body['pageUrls'] ) ? $body['pageUrls'] : array();
		$unique  = array_values( array_unique( array_filter( array_map( 'trim', array_map( 'strval', $urls_in ) ) ) ) );
		if ( empty( $unique ) ) {
			return self::err( 400, 'Missing or empty pageUrls array' );
		}
		$range = Flowbie_App_Gsc_Performance::page_perf_range_from_body( $body );
		$dv    = Flowbie_App_Gsc_Service_Account::validate_dates( $range['start'], $range['end'] );
		if ( empty( $dv['valid'] ) ) {
			return self::err( 400, $dv['error'] ?? 'Invalid date range' );
		}
		$resolved = Flowbie_App_Gsc_Service_Account::resolve_or_fallback( $site_url, $dv['startDateStr'], $dv['endDateStr'], 'page' );
		if ( ! $resolved['property'] ) {
			return array( 'statusCode' => 404, 'body' => Flowbie_App_Gsc_Service_Account::property_error_payload( $resolved['matchDetails'] ) );
		}
		$strict      = ! empty( $body['strictPageMatch'] );
		$concurrency = $strict ? self::SITEMAP_OPTIMIZER_PAGE_CONCURRENCY : self::EXPORT_PAGE_CONCURRENCY;
		$prop        = $resolved['property'];
		$pages       = array();
		for ( $i = 0; $i < count( $unique ); $i += $concurrency ) {
			$chunk = array_slice( $unique, $i, $concurrency );
			foreach ( $chunk as $page_url ) {
				try {
					$payload = Flowbie_App_Gsc_Performance::page_perf_payload( $page_url, $prop, $dv['startDateStr'], $dv['endDateStr'], $strict );
					$pages[] = array_merge( array( 'success' => true ), $payload );
				} catch ( Exception $e ) {
					$pages[] = array(
						'success'      => false,
						'pageUrl'      => $page_url,
						'matchedUrl'   => trim( $page_url ),
						'pageExists'   => false,
						'pageStats'    => array( 'clicks' => 0, 'impressions' => 0, 'ctr' => 0, 'position' => 0 ),
						'dateRange'    => array( 'startDate' => $dv['startDateStr'], 'endDate' => $dv['endDateStr'] ),
						'queries'      => array(),
						'topKeyword'   => null,
						'totalQueries' => 0,
						'property'     => $prop,
						'error'        => $e->getMessage() ?: 'Failed to fetch page performance',
					);
				}
			}
		}
		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'   => true,
				'siteUrl'   => $site_url,
				'dateRange' => array( 'startDate' => $dv['startDateStr'], 'endDate' => $dv['endDateStr'] ),
				'property'  => $prop,
				'pages'     => $pages,
			),
		);
	}

	/** @param array<string,mixed> $body */
	public static function fetch_historical_stats( array $body ): array {
		$site_url = trim( (string) ( $body['siteUrl'] ?? '' ) );
		if ( $site_url === '' ) {
			return self::err( 400, 'Missing siteUrl' );
		}
		$end   = new DateTimeImmutable( '-3 days', new DateTimeZone( 'UTC' ) );
		$start = $end->modify( '-16 months' );
		$start_str = $start->format( 'Y-m-d' );
		$end_str   = $end->format( 'Y-m-d' );
		$resolved  = Flowbie_App_Gsc_Service_Account::resolve_or_fallback( $site_url, $start_str, $end_str, 'date' );
		if ( ! $resolved['property'] ) {
			return array( 'statusCode' => 404, 'body' => Flowbie_App_Gsc_Service_Account::property_error_payload( $resolved['matchDetails'] ) );
		}
		$res = Flowbie_App_Gsc_Service_Account::search_analytics_query(
			$resolved['property'],
			array(
				'startDate'  => $start_str,
				'endDate'    => $end_str,
				'dimensions' => array( 'date' ),
				'rowLimit'   => 25000,
			)
		);
		if ( is_wp_error( $res ) ) {
			return self::err( 500, $res->get_error_message() ?: 'Failed to fetch historical stats' );
		}
		$monthly_data = array();
		$total_imp    = 0;
		$earliest     = null;
		$latest       = null;
		foreach ( ( $res['rows'] ?? array() ) as $row ) {
			$d  = (string) ( $row['keys'][0] ?? '' );
			$mk = substr( $d, 0, 7 );
			if ( ! isset( $monthly_data[ $mk ] ) ) {
				$monthly_data[ $mk ] = array( 'impressions' => 0, 'pos' => 0.0, 'posCount' => 0 );
			}
			$im = (int) ( $row['impressions'] ?? 0 );
			$monthly_data[ $mk ]['impressions'] += $im;
			$monthly_data[ $mk ]['pos']         += (float) ( $row['position'] ?? 0 ) * max( 1, $im );
			$monthly_data[ $mk ]['posCount']    += max( 1, $im );
			$total_imp                          += $im;
			if ( null === $earliest || $d < $earliest ) {
				$earliest = $d;
			}
			if ( null === $latest || $d > $latest ) {
				$latest = $d;
			}
		}
		$monthly_stats = array();
		foreach ( $monthly_data as $m => $d ) {
			$monthly_stats[] = array(
				'month'       => $m,
				'impressions' => $d['impressions'],
				'avgPosition' => $d['posCount'] > 0 ? round( $d['pos'] / $d['posCount'], 1 ) : 0,
			);
		}
		usort(
			$monthly_stats,
			static function ( $a, $b ) {
				return strcmp( $a['month'], $b['month'] );
			}
		);
		$fm = $monthly_stats[0] ?? null;
		$lm = $monthly_stats[ count( $monthly_stats ) - 1 ] ?? null;
		$growth = ( $fm && $lm && $fm['impressions'] > 0 )
			? (int) round( ( ( $lm['impressions'] - $fm['impressions'] ) / $fm['impressions'] ) * 100 )
			: 0;
		return array(
			'statusCode' => 200,
			'body'       => array(
				'success' => true, 'siteUrl' => $site_url,
				'dateRange' => array( 'earliest' => $earliest, 'latest' => $latest, 'monthsOfData' => count( $monthly_stats ) ),
				'totals' => array(
					'allTimeImpressions' => $total_imp, 'currentMonthImpressions' => $lm['impressions'] ?? 0,
					'firstMonthImpressions' => $fm['impressions'] ?? 0, 'growthPercent' => $growth,
				),
				'monthlyStats' => $monthly_stats, 'property' => $resolved['property'],
			),
		);
	}

	/** @param array<string,mixed> $extra */
	private static function err( int $code, string $message, array $extra = array() ): array {
		return array( 'statusCode' => $code, 'body' => array_merge( array( 'success' => false, 'error' => $message ), $extra ) );
	}
}
