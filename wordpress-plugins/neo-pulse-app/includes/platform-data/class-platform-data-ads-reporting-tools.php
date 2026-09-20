<?php
/**
 * Ads reporting read-only tools for Pulse Assist platform data.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Platform_Data_Ads_Reporting_Tools {

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>} */
	public static function tool_ads_reporting_status( array $body, array $params, string $message ): array {
		$oauth      = Neo_Pulse_App_Google_Ads_Oauth::connection_status();
		$connected  = ! empty( $oauth['connected'] );
		$mcc        = Neo_Pulse_App_Google_Ads_Credentials::mcc_id();
		$customer   = self::resolve_customer_id( $body, $params, $message );
		$lines      = array(
			'Google Ads OAuth configured: ' . ( Neo_Pulse_App_Google_Ads_Oauth::is_configured() ? 'yes' : 'no' ),
			'Google Ads connected: ' . ( $connected ? 'yes' : 'no' ),
			'MCC present: ' . ( $mcc !== '' ? 'yes' : 'no' ),
		);

		if ( strlen( $customer ) !== 10 ) {
			return array(
				'ok'   => false,
				'note' => 'Set a 10-digit Google Ads customer ID on this property.',
				'lines'=> $lines,
			);
		}

		$lines[] = 'Property Ads customer ID: ' . $customer;
		return array(
			'ok'    => true,
			'lines' => $lines,
		);
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>} */
	public static function tool_ads_reporting_compare_summary( array $body, array $params, string $message ): array {
		$customer = self::resolve_customer_id( $body, $params, $message );
		if ( strlen( $customer ) !== 10 ) {
			return array( 'ok' => false, 'note' => 'Set a 10-digit Google Ads customer ID on this property.' );
		}

		$preset = sanitize_key( (string) ( $params['comparePreset'] ?? 'mom' ) );
		$preset = $preset === 'yoy' ? 'yoy' : 'mom';
		$ranges = $preset === 'yoy' ? self::yoy_ranges() : self::mom_ranges();

		$result = Neo_Pulse_App_Google_Ads_Reporting_Bundle::fetch_reporting_bundle(
			array(
				'customerId'       => $customer,
				'startDate'        => $ranges['primary']['startDate'],
				'endDate'          => $ranges['primary']['endDate'],
				'compareStartDate' => $ranges['compare']['startDate'],
				'compareEndDate'   => $ranges['compare']['endDate'],
			)
		);

		if ( empty( $result['success'] ) ) {
			return array(
				'ok'   => false,
				'note' => (string) ( $result['error'] ?? 'Ads reporting bundle failed.' ),
			);
		}

		$primary   = is_array( $result['account'] ?? null ) ? $result['account'] : array();
		$compare   = is_array( $result['compareAccount'] ?? null ) ? $result['compareAccount'] : array();
		$campaigns = is_array( $result['campaigns'] ?? null ) ? $result['campaigns'] : array();
		$cmp_camps = is_array( $result['compareCampaigns'] ?? null ) ? $result['compareCampaigns'] : array();
		$lines     = array(
			'Compare preset: ' . strtoupper( $preset ),
			'Period A: ' . $ranges['primary']['startDate'] . ' to ' . $ranges['primary']['endDate'],
			'Period B: ' . $ranges['compare']['startDate'] . ' to ' . $ranges['compare']['endDate'],
			'Property Ads customer ID: ' . $customer,
		);

		if ( count( $primary ) > 0 && count( $compare ) > 0 ) {
			$lines[] = self::format_totals_line( 'Period A', $primary, count( $campaigns ) );
			$lines[] = self::format_totals_line( 'Period B', $compare, count( $cmp_camps ) );
			$lines[] = self::format_money_delta( 'Spend', self::spend_dollars( $primary ), self::spend_dollars( $compare ) );
			$lines[] = self::format_count_delta( 'Clicks', (float) ( $primary['clicks'] ?? 0 ), (float) ( $compare['clicks'] ?? 0 ) );
			$lines[] = self::format_count_delta( 'Impressions', (float) ( $primary['impressions'] ?? 0 ), (float) ( $compare['impressions'] ?? 0 ) );
			$lines[] = self::format_count_delta( 'Conversions', (float) ( $primary['conversions'] ?? 0 ), (float) ( $compare['conversions'] ?? 0 ) );
			$lines[] = self::format_rate_delta( 'CTR', (float) ( $primary['ctr'] ?? 0 ), (float) ( $compare['ctr'] ?? 0 ) );
			$lines[] = self::format_money_delta( 'Avg CPC', self::cpc_dollars( $primary ), self::cpc_dollars( $compare ) );
			$lines[] = self::format_count_delta( 'Campaigns', (float) count( $campaigns ), (float) count( $cmp_camps ) );
		} else {
			$lines[] = 'Account totals unavailable for this compare window.';
		}

		return array(
			'ok'    => true,
			'lines' => $lines,
		);
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params */
	private static function resolve_customer_id( array $body, array $params, string $message ): string {
		if ( ! empty( $params['customerId'] ) ) {
			$id = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( (string) $params['customerId'] );
			if ( strlen( $id ) === 10 ) {
				return $id;
			}
		}

		$ctx   = isset( $body['properties_context'] ) && is_array( $body['properties_context'] ) ? $body['properties_context'] : array();
		$props = isset( $ctx['properties'] ) && is_array( $ctx['properties'] ) ? $ctx['properties'] : array();
		$msg   = strtolower( $message );
		$from_prop = '';

		foreach ( $props as $prop ) {
			if ( ! is_array( $prop ) || empty( $prop['name'] ) ) {
				continue;
			}
			$name = strtolower( trim( (string) $prop['name'] ) );
			if ( $name !== '' && $msg !== '' && strpos( $msg, $name ) !== false ) {
				$from_prop = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( (string) ( $prop['googleAdsCustomerId'] ?? '' ) );
				if ( strlen( $from_prop ) === 10 ) {
					return $from_prop;
				}
			}
		}

		$active_id = isset( $ctx['activePropertyId'] ) ? sanitize_text_field( (string) $ctx['activePropertyId'] ) : '';
		foreach ( $props as $prop ) {
			if ( ! is_array( $prop ) ) {
				continue;
			}
			if ( $active_id !== '' && isset( $prop['id'] ) && sanitize_text_field( (string) $prop['id'] ) === $active_id ) {
				$from_prop = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( (string) ( $prop['googleAdsCustomerId'] ?? '' ) );
				if ( strlen( $from_prop ) === 10 ) {
					return $from_prop;
				}
			}
		}

		$site_id = sanitize_text_field( (string) ( $params['wordpressSiteId'] ?? $params['siteId'] ?? '' ) );
		if ( $site_id === '' ) {
			$team = isset( $body['team_context'] ) && is_array( $body['team_context'] ) ? $body['team_context'] : array();
			$site_id = sanitize_text_field( (string) ( $team['activeWordPressSiteId'] ?? $body['siteId'] ?? $active_id ) );
		}
		if ( $site_id !== '' ) {
			$site = Neo_Pulse_App_Task_Execution_Site_Resolver::resolve_by_id( $site_id );
			if ( is_array( $site ) ) {
				$id = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( (string) ( $site['googleAdsCustomerId'] ?? '' ) );
				if ( strlen( $id ) === 10 ) {
					return $id;
				}
			}
		}

		return '';
	}

	/** @return array{primary:array{startDate:string,endDate:string},compare:array{startDate:string,endDate:string}} */
	private static function mom_ranges(): array {
		$now       = new DateTimeImmutable( 'now', new DateTimeZone( 'UTC' ) );
		$cur_start = $now->modify( 'first day of last month' );
		$cur_end   = $now->modify( 'last day of last month' );
		$cmp_start = $cur_start->modify( 'first day of previous month' );
		$cmp_end   = $cur_start->modify( 'last day of previous month' );

		return array(
			'primary' => array(
				'startDate' => $cur_start->format( 'Y-m-d' ),
				'endDate'   => $cur_end->format( 'Y-m-d' ),
			),
			'compare' => array(
				'startDate' => $cmp_start->format( 'Y-m-d' ),
				'endDate'   => $cmp_end->format( 'Y-m-d' ),
			),
		);
	}

	/** @return array{primary:array{startDate:string,endDate:string},compare:array{startDate:string,endDate:string}} */
	private static function yoy_ranges(): array {
		$mom           = self::mom_ranges();
		$primary_start = new DateTimeImmutable( $mom['primary']['startDate'], new DateTimeZone( 'UTC' ) );
		$primary_end   = new DateTimeImmutable( $mom['primary']['endDate'], new DateTimeZone( 'UTC' ) );

		return array(
			'primary' => $mom['primary'],
			'compare' => array(
				'startDate' => $primary_start->modify( '-1 year' )->format( 'Y-m-d' ),
				'endDate'   => $primary_end->modify( '-1 year' )->format( 'Y-m-d' ),
			),
		);
	}

	/** @param array<string,mixed> $totals */
	private static function format_totals_line( string $label, array $totals, int $campaigns ): string {
		return sprintf(
			'%s: $%.2f spend, %d clicks, %d impressions, %.1f conversions, CTR %.2f%%, avg CPC $%.2f, %d campaigns',
			$label,
			self::spend_dollars( $totals ),
			(int) ( $totals['clicks'] ?? 0 ),
			(int) ( $totals['impressions'] ?? 0 ),
			(float) ( $totals['conversions'] ?? 0 ),
			(float) ( $totals['ctr'] ?? 0 ) * 100,
			self::cpc_dollars( $totals ),
			$campaigns
		);
	}

	/** @param array<string,mixed> $totals */
	private static function spend_dollars( array $totals ): float {
		return ( (int) ( $totals['costMicros'] ?? 0 ) ) / 1000000;
	}

	/** @param array<string,mixed> $totals */
	private static function cpc_dollars( array $totals ): float {
		return ( (float) ( $totals['averageCpc'] ?? 0 ) ) / 1000000;
	}

	private static function format_count_delta( string $metric, float $current, float $previous ): string {
		if ( $previous == 0.0 ) {
			return $metric . ' change: n/a (prior period was zero)';
		}
		$delta = $current - $previous;
		$pct   = ( $delta / $previous ) * 100;
		return sprintf( '%s change: %+.1f (%+.1f%% vs prior period)', $metric, $delta, $pct );
	}

	private static function format_rate_delta( string $metric, float $current, float $previous ): string {
		if ( $previous == 0.0 ) {
			return $metric . ' change: n/a (prior period was zero)';
		}
		$delta = $current - $previous;
		$pct   = ( $delta / $previous ) * 100;
		return sprintf( '%s change: %+.2f pts (%+.1f%% vs prior period)', $metric, $delta * 100, $pct );
	}

	private static function format_money_delta( string $metric, float $current, float $previous ): string {
		if ( $previous == 0.0 ) {
			return $metric . ' change: n/a (prior period was zero)';
		}
		$delta = $current - $previous;
		$pct   = ( $delta / $previous ) * 100;
		return sprintf( '%s change: %+.2f (%+.1f%% vs prior period)', $metric, $delta, $pct );
	}
}
