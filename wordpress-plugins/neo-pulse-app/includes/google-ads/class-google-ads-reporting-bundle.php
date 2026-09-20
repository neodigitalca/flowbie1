<?php
/**
 * Google Ads reporting bundle for two date ranges.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Ads_Reporting_Bundle {

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function fetch_reporting_bundle( array $body ): array {
		$customer_id = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( (string) ( $body['customerId'] ?? '' ) );
		if ( $customer_id === '' ) {
			return self::err( 400, 'Missing required field: customerId' );
		}
		$start = Neo_Pulse_App_Google_Ads_Credentials::validate_ymd( (string) ( $body['startDate'] ?? '' ) );
		$end   = Neo_Pulse_App_Google_Ads_Credentials::validate_ymd( (string) ( $body['endDate'] ?? '' ) );
		if ( $start === '' || $end === '' ) {
			return self::err( 400, 'Invalid date range' );
		}
		$compare_start = Neo_Pulse_App_Google_Ads_Credentials::validate_ymd( (string) ( $body['compareStartDate'] ?? '' ) );
		$compare_end   = Neo_Pulse_App_Google_Ads_Credentials::validate_ymd( (string) ( $body['compareEndDate'] ?? '' ) );
		if ( $compare_start === '' || $compare_end === '' ) {
			return self::err( 400, 'Invalid comparison date range' );
		}

		$primary = self::fetch_period( $customer_id, $start, $end );
		if ( empty( $primary['ok'] ) ) {
			return self::err( (int) ( $primary['statusCode'] ?? 502 ), (string) ( $primary['error'] ?? 'Ads fetch failed' ) );
		}
		$compare = self::fetch_period( $customer_id, $compare_start, $compare_end );
		if ( empty( $compare['ok'] ) ) {
			return self::err( (int) ( $compare['statusCode'] ?? 502 ), (string) ( $compare['error'] ?? 'Ads compare fetch failed' ) );
		}

		return array(
			'success'            => true,
			'customerId'         => $customer_id,
			'startDate'          => $start,
			'endDate'            => $end,
			'compareStartDate'   => $compare_start,
			'compareEndDate'     => $compare_end,
			'account'            => $primary['account'],
			'compareAccount'     => $compare['account'],
			'campaigns'          => $primary['campaigns'],
			'compareCampaigns'   => $compare['campaigns'],
			'keywords'           => $primary['keywords'],
			'compareKeywords'    => $compare['keywords'],
			'searchTerms'        => $primary['searchTerms'],
			'compareSearchTerms' => $compare['searchTerms'],
		);
	}

	/**
	 * @return array{ok:bool,statusCode?:int,error?:string,account?:array<string,mixed>,campaigns?:array<int,array<string,mixed>>,keywords?:array<int,array<string,mixed>>,searchTerms?:array<int,array<string,mixed>>}
	 */
	private static function fetch_period( string $customer_id, string $start, string $end ): array {
		$date_where = "segments.date BETWEEN '" . $start . "' AND '" . $end . "'";

		$account_q = 'SELECT customer.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr, metrics.average_cpc, metrics.conversions, metrics.conversions_value FROM customer WHERE ' . $date_where;
		$account   = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $account_q );
		if ( empty( $account['ok'] ) ) {
			return $account;
		}

		$campaign_q = 'SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr, metrics.average_cpc, metrics.conversions, metrics.conversions_value FROM campaign WHERE ' . $date_where . " AND campaign.status != 'REMOVED'";
		$campaigns  = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $campaign_q );
		if ( empty( $campaigns['ok'] ) ) {
			return $campaigns;
		}

		$keyword_q = 'SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, campaign.name, ad_group.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.average_cpc, metrics.conversions, metrics.conversions_value FROM keyword_view WHERE ' . $date_where . " AND campaign.status != 'REMOVED'";
		$keywords  = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $keyword_q );
		if ( empty( $keywords['ok'] ) ) {
			return $keywords;
		}

		$term_q = 'SELECT search_term_view.search_term, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM search_term_view WHERE ' . $date_where;
		$terms  = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $term_q );
		if ( empty( $terms['ok'] ) ) {
			return $terms;
		}

		return array(
			'ok'          => true,
			'account'     => self::sum_metrics( isset( $account['results'] ) ? $account['results'] : array() ),
			'campaigns'   => self::map_campaigns( isset( $campaigns['results'] ) ? $campaigns['results'] : array() ),
			'keywords'    => self::map_keywords( isset( $keywords['results'] ) ? $keywords['results'] : array() ),
			'searchTerms' => self::map_search_terms( isset( $terms['results'] ) ? $terms['results'] : array() ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<string,float|int>
	 */
	public static function sum_metrics( array $results ): array {
		$out = array(
			'impressions'       => 0,
			'clicks'            => 0,
			'costMicros'        => 0,
			'conversions'       => 0.0,
			'conversionsValue'  => 0.0,
		);
		foreach ( $results as $row ) {
			$m = self::metrics_of( $row );
			$out['impressions']      += (int) $m['impressions'];
			$out['clicks']           += (int) $m['clicks'];
			$out['costMicros']       += (int) $m['costMicros'];
			$out['conversions']      += (float) $m['conversions'];
			$out['conversionsValue'] += (float) $m['conversionsValue'];
		}
		$out['ctr']        = $out['impressions'] > 0 ? $out['clicks'] / $out['impressions'] : 0;
		$out['averageCpc'] = $out['clicks'] > 0 ? $out['costMicros'] / $out['clicks'] : 0;
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<int,array<string,mixed>>
	 */
	public static function map_campaigns( array $results ): array {
		$out = array();
		foreach ( $results as $row ) {
			$campaign = isset( $row['campaign'] ) && is_array( $row['campaign'] ) ? $row['campaign'] : array();
			$out[]    = array_merge(
				self::metrics_of( $row ),
				array(
					'id'     => (string) ( $campaign['id'] ?? '' ),
					'name'   => (string) ( $campaign['name'] ?? '' ),
					'status' => (string) ( $campaign['status'] ?? '' ),
				)
			);
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<int,array<string,mixed>>
	 */
	public static function map_keywords( array $results ): array {
		$out = array();
		foreach ( $results as $row ) {
			$criterion = isset( $row['adGroupCriterion'] ) && is_array( $row['adGroupCriterion'] ) ? $row['adGroupCriterion'] : array();
			$keyword   = isset( $criterion['keyword'] ) && is_array( $criterion['keyword'] ) ? $criterion['keyword'] : array();
			$campaign  = isset( $row['campaign'] ) && is_array( $row['campaign'] ) ? $row['campaign'] : array();
			$ad_group  = isset( $row['adGroup'] ) && is_array( $row['adGroup'] ) ? $row['adGroup'] : array();
			$out[]     = array_merge(
				self::metrics_of( $row ),
				array(
					'text'         => (string) ( $keyword['text'] ?? '' ),
					'matchType'    => (string) ( $keyword['matchType'] ?? '' ),
					'campaignName' => (string) ( $campaign['name'] ?? '' ),
					'adGroupName'  => (string) ( $ad_group['name'] ?? '' ),
				)
			);
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<int,array<string,mixed>>
	 */
	public static function map_search_terms( array $results ): array {
		$out = array();
		foreach ( $results as $row ) {
			$view     = isset( $row['searchTermView'] ) && is_array( $row['searchTermView'] ) ? $row['searchTermView'] : array();
			$campaign = isset( $row['campaign'] ) && is_array( $row['campaign'] ) ? $row['campaign'] : array();
			$out[]    = array_merge(
				self::metrics_of( $row ),
				array(
					'searchTerm'   => (string) ( $view['searchTerm'] ?? '' ),
					'campaignName' => (string) ( $campaign['name'] ?? '' ),
				)
			);
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,float|int>
	 */
	public static function metrics_of( array $row ): array {
		$m = isset( $row['metrics'] ) && is_array( $row['metrics'] ) ? $row['metrics'] : array();
		return array(
			'impressions'      => (int) ( $m['impressions'] ?? 0 ),
			'clicks'           => (int) ( $m['clicks'] ?? 0 ),
			'costMicros'       => (int) ( $m['costMicros'] ?? 0 ),
			'ctr'              => (float) ( $m['ctr'] ?? 0 ),
			'averageCpc'       => (float) ( $m['averageCpc'] ?? 0 ),
			'conversions'      => (float) ( $m['conversions'] ?? 0 ),
			'conversionsValue' => (float) ( $m['conversionsValue'] ?? 0 ),
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function err( int $status, string $message ): array {
		return array(
			'success'    => false,
			'statusCode' => $status,
			'error'      => $message,
		);
	}
}
