<?php
/**
 * GSC reporting bundle: queries, pages, compare periods, sitemaps (Research → Reporting).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Gsc_Reporting_Bundle {

	/** @param array<string,mixed> $body */
	public static function fetch_reporting_bundle( array $body ): array {
		$site_url = trim( (string) ( $body['siteUrl'] ?? '' ) );
		if ( $site_url === '' ) {
			return self::err( 400, 'Missing required field: siteUrl' );
		}
		if ( empty( $body['startDate'] ) || empty( $body['endDate'] ) ) {
			return self::err( 400, 'Invalid date range' );
		}
		$date_validation = Neo_Pulse_App_Gsc_Service_Account::validate_dates( $body['startDate'], $body['endDate'] );
		if ( empty( $date_validation['valid'] ) ) {
			return self::err( 400, $date_validation['error'] ?? 'Invalid date range' );
		}
		$start_str = $date_validation['startDateStr'];
		$end_str   = $date_validation['endDateStr'];

		$compare_start = null;
		$compare_end   = null;
		$has_compare   = is_string( $body['compareStartDate'] ?? null )
			&& trim( (string) $body['compareStartDate'] ) !== ''
			&& is_string( $body['compareEndDate'] ?? null )
			&& trim( (string) $body['compareEndDate'] ) !== '';
		if ( $has_compare ) {
			$cmp_val = Neo_Pulse_App_Gsc_Service_Account::validate_dates(
				trim( (string) $body['compareStartDate'] ),
				trim( (string) $body['compareEndDate'] )
			);
			if ( empty( $cmp_val['valid'] ) ) {
				return self::err( 400, $cmp_val['error'] ?? 'Invalid comparison date range' );
			}
			$compare_start = $cmp_val['startDateStr'];
			$compare_end   = $cmp_val['endDateStr'];
		}

		$row_limit_parsed = isset( $body['rowLimit'] ) ? (int) $body['rowLimit'] : 10000;
		$row_limit        = min( 10000, max( 1, $row_limit_parsed > 0 ? $row_limit_parsed : 10000 ) );

		Neo_Pulse_App_Gsc_Service_Account::write_report_date_range(
			array(
				'startDate'        => $start_str,
				'endDate'          => $end_str,
				'compareStartDate' => $compare_start,
				'compareEndDate'   => $compare_end,
			)
		);

		$fm            = Neo_Pulse_App_Gsc_Service_Account::find_matching_property( $site_url );
		$exact         = $fm['match'];
		$email         = Neo_Pulse_App_Gsc_Service_Account::service_account_email();
		$candidates    = array();
		if ( $exact ) {
			if ( 0 === strpos( $exact, 'sc-domain:' ) ) {
				$domain       = substr( $exact, strlen( 'sc-domain:' ) );
				$candidates   = array( $exact, 'https://' . $domain . '/', 'https://' . $domain );
			} else {
				$candidates = array( $exact );
			}
		} else {
			return self::err(
				403,
				"This site is not in the list of properties the service account can access.\n\nTo fix this:\n1. Go to Google Search Console → Settings → Users and permissions\n2. Add {$email} as a user\n3. Grant at least \"Full\" permissions\n4. Wait a few minutes for permissions to propagate\n5. Use \"Test connection\" in NEO Pulse to refresh the list",
				array(
					'errorType'                  => 'site_not_in_list',
					'details'                    => 'Site "' . $site_url . '" was not found in the list of GSC properties accessible to the service account.',
					'originalSiteUrl'            => $site_url,
					'serviceAccountEmail'        => $email,
					'requestedDomain'            => $fm['requestedDomain'],
					'accessiblePropertyCount'    => count( $fm['accessibleSiteUrls'] ),
					'accessiblePropertiesPreview' => array_slice( $fm['accessibleSiteUrls'], 0, 40 ),
					'dateRange'                  => array( 'start' => $start_str, 'end' => $end_str ),
				)
			);
		}

		$successful_property = null;
		$last_error          = null;
		$last_status         = 404;
		foreach ( $candidates as $i => $property ) {
			$probe = Neo_Pulse_App_Gsc_Service_Account::search_analytics_query(
				$property,
				array(
					'startDate'  => $start_str,
					'endDate'    => $end_str,
					'dimensions' => array( 'query' ),
					'rowLimit'   => 1,
					'startRow'   => 0,
				)
			);
			if ( ! is_wp_error( $probe ) ) {
				$successful_property = $property;
				break;
			}
			$last_error  = $probe;
			$data        = $probe->get_error_data();
			$last_status = is_array( $data ) && isset( $data['status'] ) ? (int) $data['status'] : 404;
			$is_last     = $i === count( $candidates ) - 1;
			if ( ! in_array( $last_status, array( 403, 404 ), true ) || $is_last ) {
				continue;
			}
		}

		if ( ! $successful_property ) {
			$tried = array();
			foreach ( $candidates as $idx => $fmt ) {
				$tried[] = ( $idx + 1 ) . '. "' . $fmt . '"';
			}
			return self::err(
				$last_status ?: 404,
				( $last_error instanceof WP_Error ? $last_error->get_error_message() : null ) ?: 'Could not access this property in Google Search Console.',
				array(
					'errorType'           => 'property_access_failed',
					'triedFormats'        => $candidates,
					'originalSiteUrl'     => $site_url,
					'serviceAccountEmail' => $email,
					'dateRange'           => array( 'start' => $start_str, 'end' => $end_str ),
					'details'             => implode( "\n   ", $tried ),
				)
			);
		}

		$date_range_label    = $start_str . ' to ' . $end_str;
		$compare_range_label = $has_compare ? $compare_start . ' to ' . $compare_end : '';

		$q_res = Neo_Pulse_App_Gsc_Service_Account::search_analytics_query(
			$successful_property,
			array(
				'startDate'  => $start_str,
				'endDate'    => $end_str,
				'dimensions' => array( 'query' ),
				'rowLimit'   => $row_limit,
				'startRow'   => 0,
			)
		);
		if ( is_wp_error( $q_res ) ) {
			return self::err( 500, $q_res->get_error_message() ?: 'Failed to fetch query performance' );
		}
		$queries = self::map_reporting_rows( $q_res['rows'] ?? array(), 'query', $date_range_label );

		$pages       = array();
		$pages_error = null;
		$p_res       = Neo_Pulse_App_Gsc_Service_Account::search_analytics_query(
			$successful_property,
			array(
				'startDate'  => $start_str,
				'endDate'    => $end_str,
				'dimensions' => array( 'page' ),
				'rowLimit'   => $row_limit,
				'startRow'   => 0,
			)
		);
		if ( is_wp_error( $p_res ) ) {
			$pages_error = $p_res->get_error_message() ?: 'Failed to fetch page performance';
		} else {
			$pages = self::map_reporting_rows( $p_res['rows'] ?? array(), 'page', $date_range_label );
		}

		$compare_queries      = array();
		$compare_pages        = array();
		$compare_pages_error  = null;
		if ( $has_compare && $compare_start && $compare_end ) {
			$cq_res = Neo_Pulse_App_Gsc_Service_Account::search_analytics_query(
				$successful_property,
				array(
					'startDate'  => $compare_start,
					'endDate'    => $compare_end,
					'dimensions' => array( 'query' ),
					'rowLimit'   => $row_limit,
					'startRow'   => 0,
				)
			);
			if ( is_wp_error( $cq_res ) ) {
				return self::err( 500, $cq_res->get_error_message() ?: 'Failed to fetch comparison query performance' );
			}
			$compare_queries = self::map_reporting_rows( $cq_res['rows'] ?? array(), 'query', $compare_range_label );

			$cp_res = Neo_Pulse_App_Gsc_Service_Account::search_analytics_query(
				$successful_property,
				array(
					'startDate'  => $compare_start,
					'endDate'    => $compare_end,
					'dimensions' => array( 'page' ),
					'rowLimit'   => $row_limit,
					'startRow'   => 0,
				)
			);
			if ( is_wp_error( $cp_res ) ) {
				$compare_pages_error = $cp_res->get_error_message() ?: 'Failed to fetch comparison page performance';
			} else {
				$compare_pages = self::map_reporting_rows( $cp_res['rows'] ?? array(), 'page', $compare_range_label );
			}
		}

		$site_totals_previous_month = null;
		$aggregate_primary          = null;
		$aggregate_compare          = null;
		if ( $has_compare && $compare_start && $compare_end ) {
			$aggregate_primary  = self::aggregate_totals( $successful_property, $start_str, $end_str );
			$aggregate_compare  = self::aggregate_totals( $successful_property, $compare_start, $compare_end );
		} else {
			$prev                       = self::previous_calendar_month_range_utc();
			$site_totals_previous_month = self::aggregate_totals( $successful_property, $prev['startDateStr'], $prev['endDateStr'], $prev['label'] );
		}

		$sitemaps       = null;
		$sitemaps_error = null;
		$sm_res         = Neo_Pulse_App_Gsc_Service_Account::list_sitemaps( $successful_property );
		if ( is_wp_error( $sm_res ) ) {
			$sitemaps_error = $sm_res->get_error_message() ?: 'Failed to list sitemaps';
		} else {
			$sitemaps = $sm_res['sitemap'] ?? array();
		}

		$response = array(
			'success'        => true,
			'property'       => $successful_property,
			'propertyFormat' => 0 === strpos( $successful_property, 'sc-domain:' ) ? 'domain' : 'url-prefix',
			'dateRange'      => array(
				'start' => $start_str,
				'end'   => $end_str,
			),
			'queries'        => $queries,
			'pages'          => $pages,
		);
		if ( $has_compare ) {
			$response['compareDateRange'] = array( 'start' => $compare_start, 'end' => $compare_end );
			$response['compareQueries']   = $compare_queries;
			$response['comparePages']     = $compare_pages;
			if ( $compare_pages_error ) {
				$response['comparePagesError'] = $compare_pages_error;
			}
		}
		if ( $pages_error ) {
			$response['pagesError'] = $pages_error;
		}
		if ( $site_totals_previous_month ) {
			$response['siteTotalsPreviousMonth'] = $site_totals_previous_month;
		}
		if ( $aggregate_primary ) {
			$response['aggregatePrimary'] = $aggregate_primary;
		}
		if ( $aggregate_compare ) {
			$response['aggregateCompare'] = $aggregate_compare;
		}
		$response['sitemaps'] = $sitemaps;
		if ( $sitemaps_error ) {
			$response['sitemapsError'] = $sitemaps_error;
		}

		return array( 'statusCode' => 200, 'body' => $response );
	}

	/** @param array<int,array<string,mixed>> $rows @return array<int,array<string,mixed>> */
	private static function map_reporting_rows( array $rows, string $dim_key, string $date_label ): array {
		$out = array();
		foreach ( $rows as $row ) {
			$key = (string) ( $row['keys'][0] ?? '' );
			$out[] = array(
				$dim_key    => $key,
				'clicks'    => (int) ( $row['clicks'] ?? 0 ),
				'impressions' => (int) ( $row['impressions'] ?? 0 ),
				'ctr'       => (float) ( $row['ctr'] ?? 0 ),
				'position'  => (float) ( $row['position'] ?? 0 ),
				'date'      => $date_label,
			);
		}
		return $out;
	}

	/** @return array<string,mixed>|null */
	private static function aggregate_totals( string $property, string $start, string $end, ?string $label_override = null ) {
		$res = Neo_Pulse_App_Gsc_Service_Account::search_analytics_query(
			$property,
			array(
				'startDate' => $start,
				'endDate'   => $end,
				'rowLimit'  => 1,
			)
		);
		if ( is_wp_error( $res ) || empty( $res['rows'][0] ) ) {
			return null;
		}
		$row = $res['rows'][0];
		return array(
			'label'       => $label_override ?? self::month_label_from_range_start_utc( $start ),
			'startDate'   => $start,
			'endDate'     => $end,
			'clicks'      => (int) ( $row['clicks'] ?? 0 ),
			'impressions' => (int) ( $row['impressions'] ?? 0 ),
			'ctr'         => (float) ( $row['ctr'] ?? 0 ),
			'position'    => (float) ( $row['position'] ?? 0 ),
		);
	}

	private static function month_label_from_range_start_utc( string $start_str ): string {
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $start_str ) ) {
			return $start_str;
		}
		$d = DateTimeImmutable::createFromFormat( 'Y-m-d', $start_str, new DateTimeZone( 'UTC' ) );
		return $d ? $d->format( 'F Y' ) : $start_str;
	}

	/** @return array{startDateStr:string,endDateStr:string,label:string} */
	private static function previous_calendar_month_range_utc(): array {
		$now             = new DateTimeImmutable( 'now', new DateTimeZone( 'UTC' ) );
		$first_this      = $now->modify( 'first day of this month' );
		$first_prev      = $first_this->modify( '-1 month' );
		$start           = $first_prev->modify( 'first day of this month' );
		$end             = $first_prev->modify( 'last day of this month' );
		return array(
			'startDateStr' => $start->format( 'Y-m-d' ),
			'endDateStr'   => $end->format( 'Y-m-d' ),
			'label'        => $start->format( 'F Y' ),
		);
	}

	/** @param array<string,mixed> $extra */
	private static function err( int $code, string $message, array $extra = array() ): array {
		return array( 'statusCode' => $code, 'body' => array_merge( array( 'success' => false, 'error' => $message ), $extra ) );
	}
}
