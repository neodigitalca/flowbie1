<?php
/**
 * GSC search queries fetch (POST /fetch-queries).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Gsc_Queries {

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function fetch_queries( array $body ): array {
		$site_url   = isset( $body['siteUrl'] ) ? trim( (string) $body['siteUrl'] ) : '';
		$start_date = $body['startDate'] ?? null;
		$end_date   = $body['endDate'] ?? null;

		if ( $site_url === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'Missing required field: siteUrl' ),
			);
		}

		$date_validation = Neo_Pulse_App_Gsc_Service_Account::validate_dates( $start_date, $end_date );
		if ( empty( $date_validation['valid'] ) ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => $date_validation['error'] ?? 'Invalid date range' ),
			);
		}

		$start_str = $date_validation['startDateStr'];
		$end_str   = $date_validation['endDateStr'];

		$row_limit_parsed = isset( $body['rowLimit'] ) ? (int) $body['rowLimit'] : 10000;
		$row_limit        = min( 10000, max( 1, $row_limit_parsed > 0 ? $row_limit_parsed : 10000 ) );

		Neo_Pulse_App_Gsc_Service_Account::write_report_date_range(
			array(
				'startDate' => $start_str,
				'endDate'   => $end_str,
			)
		);

		$email = Neo_Pulse_App_Gsc_Service_Account::service_account_email();
		$fm    = Neo_Pulse_App_Gsc_Service_Account::find_matching_property( $site_url );
		$exact = $fm['match'];

		if ( ! $exact ) {
			return array(
				'statusCode' => 403,
				'body'       => array(
					'success'                     => false,
					'error'                       => "This site is not in the list of properties the service account can access.\n\nTo fix this:\n1. Go to Google Search Console → Settings → Users and permissions\n2. Add {$email} as a user\n3. Grant at least \"Full\" permissions\n4. Wait a few minutes for permissions to propagate\n5. Use \"Test connection\" in NEO Pulse to refresh the list",
					'errorType'                   => 'site_not_in_list',
					'originalSiteUrl'             => $site_url,
					'serviceAccountEmail'         => $email,
					'requestedDomain'             => $fm['requestedDomain'],
					'accessiblePropertyCount'     => count( $fm['accessibleSiteUrls'] ),
					'accessiblePropertiesPreview' => array_slice( $fm['accessibleSiteUrls'], 0, 40 ),
					'dateRange'                   => array( 'start' => $start_str, 'end' => $end_str ),
				),
			);
		}

		$candidates = array();
		if ( 0 === strpos( $exact, 'sc-domain:' ) ) {
			$domain       = substr( $exact, strlen( 'sc-domain:' ) );
			$candidates[] = $exact;
			$candidates[] = 'https://' . $domain . '/';
			$candidates[] = 'https://' . $domain;
		} else {
			$candidates[] = $exact;
		}

		$successful_property = null;
		$response            = null;
		$last_error          = null;

		foreach ( $candidates as $property ) {
			$result = Neo_Pulse_App_Gsc_Service_Account::search_analytics_query(
				$property,
				array(
					'startDate'  => $start_str,
					'endDate'    => $end_str,
					'dimensions' => array( 'query' ),
					'rowLimit'   => $row_limit,
					'startRow'   => 0,
				)
			);

			if ( is_wp_error( $result ) ) {
				$last_error = $result;
				continue;
			}

			$successful_property = $property;
			$response            = $result;
			break;
		}

		if ( ! $response || ! $successful_property ) {
			$status = is_wp_error( $last_error ) ? (int) ( $last_error->get_error_data()['status'] ?? 404 ) : 404;
			return array(
				'statusCode' => $status > 0 ? $status : 404,
				'body'       => array(
					'success'             => false,
					'error'               => is_wp_error( $last_error ) ? $last_error->get_error_message() : 'All property formats failed',
					'errorType'           => 403 === $status ? 'access_denied' : ( 404 === $status ? 'property_not_found' : 'api_error' ),
					'triedFormats'        => $candidates,
					'originalSiteUrl'     => $site_url,
					'serviceAccountEmail' => $email,
					'dateRange'           => array( 'start' => $start_str, 'end' => $end_str ),
				),
			);
		}

		if ( empty( $response['rows'] ) || ! is_array( $response['rows'] ) ) {
			return array(
				'statusCode' => 200,
				'body'       => array(
					'success'   => true,
					'queries'   => array(),
					'message'   => 'No search queries found for the specified date range',
					'property'  => $successful_property,
					'dateRange' => array( 'start' => $start_str, 'end' => $end_str ),
				),
			);
		}

		$queries = array();
		foreach ( $response['rows'] as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$queries[] = array(
				'query'       => isset( $row['keys'][0] ) ? (string) $row['keys'][0] : '',
				'clicks'      => isset( $row['clicks'] ) ? (int) $row['clicks'] : 0,
				'impressions' => isset( $row['impressions'] ) ? (int) $row['impressions'] : 0,
				'ctr'         => isset( $row['ctr'] ) ? (float) $row['ctr'] : 0.0,
				'position'    => isset( $row['position'] ) ? (float) $row['position'] : 0.0,
				'date'        => $start_str . ' to ' . $end_str,
			);
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'        => true,
				'queries'        => $queries,
				'property'       => $successful_property,
				'propertyFormat' => 0 === strpos( $successful_property, 'sc-domain:' ) ? 'domain' : 'url-prefix',
				'dateRange'      => array( 'start' => $start_str, 'end' => $end_str ),
			),
		);
	}
}
