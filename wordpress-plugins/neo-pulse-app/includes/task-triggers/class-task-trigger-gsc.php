<?php
/**
 * GSC signal evaluation for task triggers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Trigger_Gsc {

	const GSC_LAG_DAYS = 3;

	/**
	 * @param array<string,mixed> $config
	 * @return array{current:array<string,string>,prior:array<string,string>,error?:string}
	 */
	public static function date_ranges( array $config ): array {
		$lookback = max( 1, (int) ( $config['lookbackDays'] ?? 28 ) );
		$compare  = max( 1, (int) ( $config['compareDays'] ?? 28 ) );
		$end      = new DateTimeImmutable( '-' . self::GSC_LAG_DAYS . ' days', new DateTimeZone( 'UTC' ) );
		$cur_end  = $end->format( 'Y-m-d' );
		$cur_start = $end->modify( '-' . ( $lookback - 1 ) . ' days' )->format( 'Y-m-d' );
		$prior_end = $end->modify( '-' . $lookback . ' days' )->format( 'Y-m-d' );
		$prior_start = $end->modify( '-' . ( $lookback + $compare - 1 ) . ' days' )->format( 'Y-m-d' );
		return array(
			'current' => array(
				'start' => $cur_start,
				'end'   => $cur_end,
			),
			'prior'   => array(
				'start' => $prior_start,
				'end'   => $prior_end,
			),
		);
	}

	/**
	 * @param array<string,mixed> $config
	 * @return array{pages:array<string,array<string,mixed>>,priorPages:array<string,array<string,mixed>>,error?:string}
	 */
	public static function fetch_page_compare_maps( string $site_url, array $config ): array {
		$ranges = self::date_ranges( $config );
		$result = Neo_Pulse_App_Gsc_Reporting_Bundle::fetch_reporting_bundle(
			array(
				'siteUrl'          => $site_url,
				'startDate'        => $ranges['current']['start'],
				'endDate'          => $ranges['current']['end'],
				'compareStartDate' => $ranges['prior']['start'],
				'compareEndDate'   => $ranges['prior']['end'],
				'rowLimit'         => 10000,
			)
		);
		if ( (int) ( $result['statusCode'] ?? 500 ) !== 200 ) {
			$body = is_array( $result['body'] ?? null ) ? $result['body'] : array();
			return array(
				'pages'      => array(),
				'priorPages' => array(),
				'error'      => (string) ( $body['error'] ?? 'GSC reporting bundle failed.' ),
			);
		}
		$body = is_array( $result['body'] ?? null ) ? $result['body'] : array();
		return array(
			'pages'      => self::page_rows_to_map( is_array( $body['pages'] ?? null ) ? $body['pages'] : array() ),
			'priorPages' => self::page_rows_to_map( is_array( $body['comparePages'] ?? null ) ? $body['comparePages'] : array() ),
			'ranges'     => $ranges,
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $rows
	 * @return array<string,array<string,mixed>>
	 */
	private static function page_rows_to_map( array $rows ): array {
		$map = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$url = trim( (string) ( $row['page'] ?? '' ) );
			if ( $url === '' ) {
				continue;
			}
			$key = self::normalize_url_key( $url );
			$map[ $key ] = array(
				'url'         => $url,
				'clicks'      => (int) ( $row['clicks'] ?? 0 ),
				'impressions' => (int) ( $row['impressions'] ?? 0 ),
				'ctr'         => (float) ( $row['ctr'] ?? 0 ),
				'position'    => (float) ( $row['position'] ?? 0 ),
			);
		}
		return $map;
	}

	public static function normalize_url_key( string $url ): string {
		$url = trim( $url );
		if ( $url === '' ) {
			return '';
		}
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return strtolower( untrailingslashit( $url ) );
		}
		$host = strtolower( (string) ( $parts['host'] ?? '' ) );
		$path = untrailingslashit( (string) ( $parts['path'] ?? '' ) );
		if ( $path === '' ) {
			$path = '/';
		}
		$query = isset( $parts['query'] ) ? '?' . (string) $parts['query'] : '';
		return $host . $path . $query;
	}

	/**
	 * @param array<string,mixed>      $current
	 * @param array<string,mixed>|null $prior
	 * @param array<string,mixed>      $condition
	 */
	public static function condition_matches( array $current, ?array $prior, array $condition ): bool {
		$min_impressions = max( 0, (int) ( $condition['minImpressions'] ?? 100 ) );
		if ( (int) ( $current['impressions'] ?? 0 ) < $min_impressions ) {
			return false;
		}
		if ( ! is_array( $prior ) ) {
			return false;
		}
		$signal = sanitize_key( (string) ( $condition['signal'] ?? '' ) );
		$value  = (float) ( $condition['value'] ?? 0 );
		$cur_pos = (float) ( $current['position'] ?? 0 );
		$pri_pos = (float) ( $prior['position'] ?? 0 );
		$cur_ctr = self::ctr_ratio( $current );
		$pri_ctr = self::ctr_ratio( $prior );
		$cur_clk = (int) ( $current['clicks'] ?? 0 );
		$pri_clk = (int) ( $prior['clicks'] ?? 0 );
		$cur_imp = (int) ( $current['impressions'] ?? 0 );
		$pri_imp = (int) ( $prior['impressions'] ?? 0 );

		switch ( $signal ) {
			case 'position_drop':
				return ( $cur_pos - $pri_pos ) >= $value;
			case 'ctr_drop':
				if ( $pri_ctr <= 0 ) {
					return false;
				}
				$drop_pct = ( ( $pri_ctr - $cur_ctr ) / $pri_ctr ) * 100;
				return $drop_pct >= $value;
			case 'clicks_drop':
				if ( $pri_clk <= 0 ) {
					return false;
				}
				$drop_pct = ( ( $pri_clk - $cur_clk ) / $pri_clk ) * 100;
				return $drop_pct >= $value;
			case 'impressions_up_ctr_down':
				return $cur_imp > $pri_imp && $cur_ctr < $pri_ctr;
			case 'quick_win_slipped':
				return $pri_pos >= 11 && $pri_pos <= 20 && $cur_pos > 20;
			default:
				return false;
		}
	}

	/**
	 * @param array<string,mixed> $row
	 */
	private static function ctr_ratio( array $row ): float {
		if ( isset( $row['ctr'] ) ) {
			$ctr = (float) $row['ctr'];
			return $ctr > 1 ? $ctr / 100 : $ctr;
		}
		$imp = (int) ( $row['impressions'] ?? 0 );
		$clk = (int) ( $row['clicks'] ?? 0 );
		return $imp > 0 ? $clk / $imp : 0.0;
	}

	/**
	 * @param array<string,mixed> $metrics
	 * @return array<string,mixed>
	 */
	public static function metrics_for_response( array $metrics ): array {
		return array(
			'impressions' => (int) ( $metrics['impressions'] ?? 0 ),
			'ctr'         => round( self::ctr_ratio( $metrics ) * 100, 2 ),
			'position'    => round( (float) ( $metrics['position'] ?? 0 ), 2 ),
			'clicks'      => (int) ( $metrics['clicks'] ?? 0 ),
		);
	}
}
