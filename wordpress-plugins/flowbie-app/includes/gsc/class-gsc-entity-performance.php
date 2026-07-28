<?php
/**
 * GSC entity path pattern page performance (service area / entity sections).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Gsc_Entity_Performance {

	/** @param array<string,mixed> $body */
	public static function fetch_entity_pages_performance( array $body ): array {
		$site_url = trim( (string) ( $body['siteUrl'] ?? '' ) );
		$pattern  = trim( (string) ( $body['entityPathPattern'] ?? '' ) );
		if ( $site_url === '' || $pattern === '' || empty( $body['startDate'] ) || empty( $body['endDate'] ) ) {
			return self::err( 400, 'Missing siteUrl, entityPathPattern, or dates' );
		}
		$cv = Flowbie_App_Gsc_Service_Account::validate_dates( $body['startDate'], $body['endDate'] );
		if ( empty( $cv['valid'] ) ) {
			return self::err( 400, $cv['error'] ?? 'Invalid date range' );
		}
		$cc_start = null;
		$cc_end   = null;
		if ( ! empty( $body['compareStartDate'] ) && ! empty( $body['compareEndDate'] ) ) {
			$ccv = Flowbie_App_Gsc_Service_Account::validate_dates( $body['compareStartDate'], $body['compareEndDate'] );
			if ( ! empty( $ccv['valid'] ) ) {
				$cc_start = $ccv['startDateStr'];
				$cc_end   = $ccv['endDateStr'];
			}
		}
		$resolved = Flowbie_App_Gsc_Service_Account::resolve_or_fallback( $site_url, $cv['startDateStr'], $cv['endDateStr'], 'page' );
		if ( ! $resolved['property'] ) {
			return array( 'statusCode' => 404, 'body' => Flowbie_App_Gsc_Service_Account::property_error_payload( $resolved['matchDetails'] ) );
		}
		$prop        = $resolved['property'];
		$filter_body = array(
			'dimensionFilterGroups' => array(
				array(
					'filters' => array(
						array(
							'dimension'  => 'page',
							'operator'   => 'contains',
							'expression' => $pattern,
						),
					),
				),
			),
		);
		$page_base = array( 'dimensions' => array( 'page' ), 'rowLimit' => 25000 );
		$cur_res   = Flowbie_App_Gsc_Service_Account::search_analytics_query(
			$prop,
			array_merge( array( 'startDate' => $cv['startDateStr'], 'endDate' => $cv['endDateStr'] ), $page_base, $filter_body )
		);
		if ( is_wp_error( $cur_res ) ) {
			return self::err( 500, $cur_res->get_error_message() ?: 'Failed to fetch entity pages' );
		}
		$cur_pages = self::map_page_rows( $cur_res['rows'] ?? array() );
		$cmp_pages = array();
		if ( $cc_start && $cc_end ) {
			$cmp_res = Flowbie_App_Gsc_Service_Account::search_analytics_query(
				$prop,
				array_merge( array( 'startDate' => $cc_start, 'endDate' => $cc_end ), $page_base, $filter_body )
			);
			if ( ! is_wp_error( $cmp_res ) ) {
				$cmp_pages = self::map_page_rows( $cmp_res['rows'] ?? array() );
			}
		}
		$page_queries = self::page_queries_map(
			$prop,
			$cv['startDateStr'],
			$cv['endDateStr'],
			array_merge( array( 'dimensions' => array( 'page', 'query' ), 'rowLimit' => 25000 ), $filter_body )
		);
		$cmp_map = array();
		foreach ( $cmp_pages as $p ) {
			$cmp_map[ strtolower( (string) $p['url'] ) ] = $p;
		}
		$t_cur = $t_cur_c = $t_prev = $t_prev_c = 0;
		$new_p = array();
		$pages = array();
		foreach ( $cur_pages as $p ) {
			$prev = $cmp_map[ strtolower( (string) $p['url'] ) ] ?? null;
			if ( $prev ) {
				$t_prev += (int) $prev['impressions'];
				$t_prev_c += (int) $prev['clicks'];
			} else {
				$new_p[] = $p['url'];
			}
			$t_cur += (int) $p['impressions'];
			$t_cur_c += (int) $p['clicks'];
			$pages[] = array(
				'url'                 => $p['url'],
				'pagePath'            => preg_replace( '#^https?://[^/]+#', '', (string) $p['url'] ) ?: $p['url'],
				'clicks'              => $p['clicks'],
				'impressions'         => $p['impressions'],
				'position'            => round( (float) $p['position'], 1 ),
				'previousImpressions' => $prev ? (int) $prev['impressions'] : 0,
				'previousClicks'      => $prev ? (int) $prev['clicks'] : 0,
				'previousPosition'    => $prev ? round( (float) $prev['position'], 1 ) : 0,
				'impressionsChange'   => $prev ? (int) $p['impressions'] - (int) $prev['impressions'] : (int) $p['impressions'],
				'clicksChange'        => $prev ? (int) $p['clicks'] - (int) $prev['clicks'] : (int) $p['clicks'],
				'isNew'               => ! $prev,
				'queries'             => $page_queries[ strtolower( (string) $p['url'] ) ] ?? array(),
			);
		}
		usort( $pages, static function ( $a, $b ) { return ( $b['impressions'] ?? 0 ) <=> ( $a['impressions'] ?? 0 ); } );
		$body_out = array(
			'success' => true, 'entityPathPattern' => $pattern,
			'currentPeriod' => array(
				'startDate' => $cv['startDateStr'], 'endDate' => $cv['endDateStr'],
				'totalPages' => count( $cur_pages ), 'totalImpressions' => $t_cur, 'totalClicks' => $t_cur_c,
			),
			'pages' => $pages, 'newPages' => $new_p, 'property' => $prop,
		);
		if ( $cc_start && $cc_end ) {
			$body_out['comparisonPeriod'] = array(
				'startDate' => $cc_start, 'endDate' => $cc_end,
				'totalPages' => count( $cmp_pages ), 'totalImpressions' => $t_prev, 'totalClicks' => $t_prev_c,
			);
			$body_out['comparison'] = array(
				'newPagesCount' => count( $new_p ), 'impressionsChange' => $t_cur - $t_prev,
				'clicksChange' => $t_cur_c - $t_prev_c, 'pagesChange' => count( $cur_pages ) - count( $cmp_pages ),
			);
		} else {
			$body_out['comparisonPeriod'] = null;
			$body_out['comparison']       = null;
		}
		return array( 'statusCode' => 200, 'body' => $body_out );
	}

	/** @param array<string,mixed> $query_body @return array<string,array<int,array<string,mixed>>> */
	private static function page_queries_map( string $prop, string $start, string $end, array $query_body ): array {
		$res = Flowbie_App_Gsc_Service_Account::search_analytics_query(
			$prop,
			array_merge( array( 'startDate' => $start, 'endDate' => $end ), $query_body )
		);
		$page_queries = array();
		if ( is_wp_error( $res ) ) {
			return $page_queries;
		}
		foreach ( ( $res['rows'] ?? array() ) as $row ) {
			$page_url = trim( (string) ( $row['keys'][0] ?? '' ) );
			$query    = trim( (string) ( $row['keys'][1] ?? '' ) );
			if ( $page_url === '' || $query === '' ) {
				continue;
			}
			$key = strtolower( $page_url );
			if ( ! isset( $page_queries[ $key ] ) ) {
				$page_queries[ $key ] = array();
			}
			$page_queries[ $key ][] = array(
				'query' => $query, 'clicks' => (int) ( $row['clicks'] ?? 0 ),
				'impressions' => (int) ( $row['impressions'] ?? 0 ), 'ctr' => (float) ( $row['ctr'] ?? 0 ),
				'position' => (float) ( $row['position'] ?? 0 ),
			);
		}
		foreach ( $page_queries as $key => $list ) {
			usort( $list, static function ( $a, $b ) { return ( $b['impressions'] ?? 0 ) <=> ( $a['impressions'] ?? 0 ); } );
			$page_queries[ $key ] = $list;
		}
		return $page_queries;
	}

	/** @param array<int,array<string,mixed>> $rows @return array<int,array<string,mixed>> */
	private static function map_page_rows( array $rows ): array {
		$out = array();
		foreach ( $rows as $r ) {
			$out[] = array(
				'url' => (string) ( $r['keys'][0] ?? '' ), 'clicks' => (int) ( $r['clicks'] ?? 0 ),
				'impressions' => (int) ( $r['impressions'] ?? 0 ), 'ctr' => (float) ( $r['ctr'] ?? 0 ),
				'position' => (float) ( $r['position'] ?? 0 ),
			);
		}
		return $out;
	}

	/** @param array<string,mixed> $extra */
	private static function err( int $code, string $message, array $extra = array() ): array {
		return array( 'statusCode' => $code, 'body' => array_merge( array( 'success' => false, 'error' => $message ), $extra ) );
	}
}
