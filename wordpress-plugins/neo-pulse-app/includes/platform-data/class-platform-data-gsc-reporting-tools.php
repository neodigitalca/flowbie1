<?php
/**
 * GSC reporting read-only tools for Pulse Assist platform data.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Platform_Data_Gsc_Reporting_Tools {

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>} */
	public static function tool_gsc_reporting_status( array $body, array $params, string $message ): array {
		return Neo_Pulse_App_Platform_Data_Gsc_Tools::tool_gsc_status( $body, $params, $message );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>} */
	public static function tool_gsc_reporting_compare_summary( array $body, array $params, string $message ): array {
		$site_url = self::resolve_site_url( $body, $params, $message );
		if ( $site_url === '' ) {
			return array( 'ok' => false, 'note' => 'No siteUrl for GSC reporting compare summary.' );
		}

		$preset = sanitize_key( (string) ( $params['comparePreset'] ?? 'mom' ) );
		$preset = $preset === 'yoy' ? 'yoy' : 'mom';
		$ranges = $preset === 'yoy' ? self::yoy_ranges() : self::mom_ranges();

		$result = Neo_Pulse_App_Gsc_Reporting_Bundle::fetch_reporting_bundle(
			array(
				'siteUrl'          => $site_url,
				'startDate'        => $ranges['primary']['startDate'],
				'endDate'          => $ranges['primary']['endDate'],
				'compareStartDate' => $ranges['compare']['startDate'],
				'compareEndDate'   => $ranges['compare']['endDate'],
			)
		);

		$status = (int) ( $result['statusCode'] ?? 500 );
		$payload = is_array( $result['body'] ?? null ) ? $result['body'] : array();
		if ( $status >= 400 || empty( $payload['success'] ) ) {
			return array(
				'ok'   => false,
				'note' => (string) ( $payload['error'] ?? 'GSC reporting bundle failed.' ),
			);
		}

		$primary  = is_array( $payload['aggregatePrimary'] ?? null ) ? $payload['aggregatePrimary'] : array();
		$compare  = is_array( $payload['aggregateCompare'] ?? null ) ? $payload['aggregateCompare'] : array();
		$queries  = is_array( $payload['queries'] ?? null ) ? $payload['queries'] : array();
		$cmp_q    = is_array( $payload['compareQueries'] ?? null ) ? $payload['compareQueries'] : array();
		$lines    = array(
			'Compare preset: ' . strtoupper( $preset ),
			'Period A: ' . $ranges['primary']['startDate'] . ' to ' . $ranges['primary']['endDate'],
			'Period B: ' . $ranges['compare']['startDate'] . ' to ' . $ranges['compare']['endDate'],
		);

		if ( count( $primary ) > 0 && count( $compare ) > 0 ) {
			$lines[] = self::format_totals_line( 'Period A', $primary );
			$lines[] = self::format_totals_line( 'Period B', $compare );
			$lines[] = self::format_delta_line( 'Clicks', (int) ( $primary['clicks'] ?? 0 ), (int) ( $compare['clicks'] ?? 0 ) );
			$lines[] = self::format_delta_line( 'Impressions', (int) ( $primary['impressions'] ?? 0 ), (int) ( $compare['impressions'] ?? 0 ) );
			$lines[] = self::format_delta_line( 'Search queries', (float) count( $queries ), (float) count( $cmp_q ) );
			$lines[] = self::format_delta_line( 'CTR', (float) ( $primary['ctr'] ?? 0 ), (float) ( $compare['ctr'] ?? 0 ), true );
			$lines[] = self::format_delta_line( 'Avg position', (float) ( $primary['position'] ?? 0 ), (float) ( $compare['position'] ?? 0 ), false, true );

			$pattern = self::classify_compare_pattern(
				(int) ( $primary['clicks'] ?? 0 ),
				(int) ( $compare['clicks'] ?? 0 ),
				(int) ( $primary['impressions'] ?? 0 ),
				(int) ( $compare['impressions'] ?? 0 ),
				count( $queries ),
				count( $cmp_q ),
				(float) ( $primary['ctr'] ?? 0 ),
				(float) ( $compare['ctr'] ?? 0 ),
				(float) ( $primary['position'] ?? 0 ),
				(float) ( $compare['position'] ?? 0 )
			);
			$lines[] = 'Interpretation: ' . $pattern['interpretation'];
			if ( $pattern['forbidden'] !== '' ) {
				$lines[] = 'Do not: ' . $pattern['forbidden'];
			}
		} else {
			$lines[] = 'Site totals unavailable for this compare window.';
		}

		return array(
			'ok'    => true,
			'lines' => $lines,
		);
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
		$mom = self::mom_ranges();
		$primary_start = new DateTimeImmutable( $mom['primary']['startDate'], new DateTimeZone( 'UTC' ) );
		$primary_end   = new DateTimeImmutable( $mom['primary']['endDate'], new DateTimeZone( 'UTC' ) );
		$cmp_start     = $primary_start->modify( '-1 year' );
		$cmp_end       = $primary_end->modify( '-1 year' );

		return array(
			'primary' => $mom['primary'],
			'compare' => array(
				'startDate' => $cmp_start->format( 'Y-m-d' ),
				'endDate'   => $cmp_end->format( 'Y-m-d' ),
			),
		);
	}

	/** @param array<string,mixed> $totals */
	private static function format_totals_line( string $label, array $totals ): string {
		return sprintf(
			'%s: %d clicks, %d impressions, CTR %.2f%%, avg position %.1f',
			$label,
			(int) ( $totals['clicks'] ?? 0 ),
			(int) ( $totals['impressions'] ?? 0 ),
			(float) ( $totals['ctr'] ?? 0 ) * 100,
			(float) ( $totals['position'] ?? 0 )
		);
	}

	private static function format_delta_line(
		string $metric,
		float $current,
		float $previous,
		bool $is_rate = false,
		bool $position = false
	): string {
		if ( $previous == 0.0 ) {
			return $metric . ' change: n/a (prior period was zero)';
		}
		$delta = $current - $previous;
		$pct   = ( $delta / $previous ) * 100;
		if ( $is_rate ) {
			return sprintf( '%s change: %+.2f pts (%+.1f%% vs prior period)', $metric, $delta * 100, $pct );
		}
		if ( $position ) {
			return sprintf( '%s change: %+.1f (%+.1f%% vs prior period; lower is better)', $metric, $delta, $pct );
		}
		return sprintf( '%s change: %+.0f (%+.1f%% vs prior period)', $metric, $delta, $pct );
	}

	/**
	 * Mirror TS compare-signal classification for Pulse Assist summaries.
	 *
	 * @return array{pattern:string,interpretation:string,forbidden:string}
	 */
	private static function classify_compare_pattern(
		int $cur_clicks,
		int $pri_clicks,
		int $cur_imp,
		int $pri_imp,
		int $cur_queries,
		int $pri_queries,
		float $cur_ctr,
		float $pri_ctr,
		float $cur_pos,
		float $pri_pos
	): array {
		$queries_up = $pri_queries > 0 && $cur_queries > $pri_queries;
		$imp_up     = $pri_imp > 0 && $cur_imp > $pri_imp;
		$imp_down   = $pri_imp > 0 && $cur_imp < $pri_imp;
		$pos_worse  = $cur_pos > $pri_pos;
		$clk_down   = $pri_clicks > 0 && $cur_clicks < $pri_clicks;
		$ctr_down   = $pri_ctr > 0 && $cur_ctr < $pri_ctr;

		if ( $queries_up && $imp_up && $pos_worse ) {
			return array(
				'pattern'        => 'query_footprint_expansion',
				'interpretation' => 'Query footprint expanded; site-wide average position diluted by new or long-tail terms.',
				'forbidden'      => 'Do not describe this as overall search visibility decline.',
			);
		}
		if ( $imp_down && $pos_worse ) {
			return array(
				'pattern'        => 'visibility_contraction',
				'interpretation' => 'Search visibility contracted; fewer impressions with worsening average position.',
				'forbidden'      => '',
			);
		}
		if ( $imp_up && $clk_down && $ctr_down ) {
			return array(
				'pattern'        => 'ctr_dilution',
				'interpretation' => 'Impressions rose but clicks and CTR softened; visibility expanded without click efficiency.',
				'forbidden'      => '',
			);
		}
		return array(
			'pattern'        => 'mixed_or_flat',
			'interpretation' => 'Mixed period signals; qualify claims and avoid a single visibility headline from position alone.',
			'forbidden'      => '',
		);
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params */
	private static function resolve_site_url( array $body, array $params, string $message ): string {
		if ( ! empty( $params['siteUrl'] ) ) {
			return esc_url_raw( trim( (string) $params['siteUrl'] ) );
		}

		$ctx   = isset( $body['properties_context'] ) && is_array( $body['properties_context'] ) ? $body['properties_context'] : array();
		$props = isset( $ctx['properties'] ) && is_array( $ctx['properties'] ) ? $ctx['properties'] : array();
		$msg   = strtolower( $message );

		foreach ( $props as $prop ) {
			if ( ! is_array( $prop ) || empty( $prop['name'] ) || empty( $prop['siteUrl'] ) ) {
				continue;
			}
			$name = strtolower( trim( (string) $prop['name'] ) );
			if ( $name !== '' && $msg !== '' && strpos( $msg, $name ) !== false ) {
				return esc_url_raw( trim( (string) $prop['siteUrl'] ) );
			}
		}

		$active_id = isset( $ctx['activePropertyId'] ) ? sanitize_text_field( (string) $ctx['activePropertyId'] ) : '';
		foreach ( $props as $prop ) {
			if ( ! is_array( $prop ) || empty( $prop['siteUrl'] ) ) {
				continue;
			}
			if ( $active_id !== '' && isset( $prop['id'] ) && sanitize_text_field( (string) $prop['id'] ) === $active_id ) {
				return esc_url_raw( trim( (string) $prop['siteUrl'] ) );
			}
		}

		if ( ! empty( $body['siteUrl'] ) ) {
			return esc_url_raw( trim( (string) $body['siteUrl'] ) );
		}

		return '';
	}
}
