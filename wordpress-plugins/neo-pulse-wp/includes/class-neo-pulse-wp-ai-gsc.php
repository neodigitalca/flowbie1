<?php
/**
 * GSC query suggestions for focus keyword (direct GSC or Flow API fallback).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Ai_Gsc {

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	public static function get_suggestions( int $post_id, string $current_keyword = '' ) {
		if ( $post_id > 0 ) {
			$urls = Neo_Pulse_Wp_Ai_Backend::resolve_urls( $post_id );
			if ( $urls['pageUrl'] !== '' && Neo_Pulse_Wp_Gsc::is_available() ) {
				$direct = self::get_suggestions_from_direct( $post_id, $urls, $current_keyword );
				if ( ! is_wp_error( $direct ) ) {
					return $direct;
				}
			}
		}

		if ( ! Neo_Pulse_Wp_Ai_Backend::is_available() ) {
			return new WP_Error(
				'neo-pulse_gsc_unavailable',
				__( 'GSC suggestions require Search Console credentials or the NEO Pulse API URL.', 'neo-pulse-wp' )
			);
		}

		$urls = Neo_Pulse_Wp_Ai_Backend::resolve_urls( $post_id );
		if ( $urls['pageUrl'] === '' ) {
			return array(
				'ok'          => true,
				'pageUrl'     => '',
				'pageExists'  => false,
				'dateRange'   => null,
				'suggestions' => array(),
				'queries'     => array(),
				'topKeyword'  => null,
				'message'     => __( 'No page URL available for GSC lookup.', 'neo-pulse-wp' ),
			);
		}

		$cache_key = 'neo_pulse_wp_gsc_kw_' . md5( $post_id . '|' . $urls['pageUrl'] );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) ) {
			$cached['suggestions'] = self::filter_suggestions(
				isset( $cached['_rawQueries'] ) && is_array( $cached['_rawQueries'] ) ? $cached['_rawQueries'] : array(),
				$urls['companyName'],
				$current_keyword
			);
			if ( empty( $cached['queries'] ) && ! empty( $cached['_rawQueries'] ) ) {
				$cached['queries'] = $cached['_rawQueries'];
			}
			unset( $cached['_rawQueries'] );
			return $cached;
		}

		$data = Neo_Pulse_Wp_Ai_Backend::post_json(
			'/api/gsc/fetch-page-performance',
			array(
				'siteUrl'  => $urls['siteUrl'],
				'pageUrl'  => $urls['pageUrl'],
			),
			90
		);

		if ( is_wp_error( $data ) ) {
			return $data;
		}

		if ( empty( $data['success'] ) ) {
			return array(
				'ok'          => true,
				'pageUrl'     => $urls['pageUrl'],
				'pageExists'  => false,
				'dateRange'   => isset( $data['dateRange'] ) && is_array( $data['dateRange'] ) ? $data['dateRange'] : null,
				'suggestions' => array(),
				'queries'     => array(),
				'topKeyword'  => null,
				'message'     => isset( $data['error'] ) ? (string) $data['error'] : __( 'GSC data unavailable.', 'neo-pulse-wp' ),
			);
		}

		$queries = array();
		if ( ! empty( $data['queries'] ) && is_array( $data['queries'] ) ) {
			foreach ( $data['queries'] as $row ) {
				if ( ! is_array( $row ) || empty( $row['query'] ) ) {
					continue;
				}
				$queries[] = array(
					'query'       => trim( (string) $row['query'] ),
					'clicks'      => isset( $row['clicks'] ) ? (int) $row['clicks'] : 0,
					'impressions' => isset( $row['impressions'] ) ? (int) $row['impressions'] : 0,
					'position'    => isset( $row['position'] ) ? (float) $row['position'] : 0,
				);
			}
		}

		$payload = array(
			'ok'          => true,
			'pageUrl'     => $urls['pageUrl'],
			'pageExists'  => ! empty( $data['pageExists'] ),
			'dateRange'   => isset( $data['dateRange'] ) && is_array( $data['dateRange'] ) ? $data['dateRange'] : null,
			'topKeyword'  => isset( $data['topKeyword']['query'] ) ? (string) $data['topKeyword']['query'] : null,
			'_rawQueries' => $queries,
		);

		set_transient( $cache_key, $payload, 15 * MINUTE_IN_SECONDS );

		$payload['queries']     = $queries;
		$payload['suggestions'] = self::filter_suggestions( $queries, $urls['companyName'], $current_keyword );
		unset( $payload['_rawQueries'] );

		if ( empty( $payload['suggestions'] ) && ! empty( $queries ) ) {
			$payload['message'] = __( 'No suitable GSC queries after filtering.', 'neo-pulse-wp' );
		} elseif ( empty( $payload['suggestions'] ) ) {
			$payload['message'] = __( 'No GSC data for this URL yet.', 'neo-pulse-wp' );
		}

		return $payload;
	}

	/**
	 * @param array{siteUrl:string,pageUrl:string,companyName:string} $urls
	 * @return array<string,mixed>|WP_Error
	 */
	private static function get_suggestions_from_direct( int $post_id, array $urls, string $current_keyword ) {
		$cache_key = 'neo_pulse_wp_gsc_kw_direct_' . md5( $post_id . '|' . $urls['pageUrl'] );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) ) {
			$cached['suggestions'] = self::filter_suggestions(
				isset( $cached['queries'] ) && is_array( $cached['queries'] ) ? $cached['queries'] : array(),
				$urls['companyName'],
				$current_keyword
			);
			return $cached;
		}

		$page_data = Neo_Pulse_Wp_Gsc::fetch_page_queries( $urls['pageUrl'] );
		if ( is_wp_error( $page_data ) ) {
			return $page_data;
		}

		$queries = isset( $page_data['queries'] ) && is_array( $page_data['queries'] ) ? $page_data['queries'] : array();
		$payload = array(
			'ok'         => true,
			'pageUrl'    => $urls['pageUrl'],
			'pageExists' => ! empty( $queries ),
			'dateRange'  => isset( $page_data['dateRange'] ) ? $page_data['dateRange'] : null,
			'queries'    => $queries,
			'topKeyword' => ! empty( $queries[0]['query'] ) ? (string) $queries[0]['query'] : null,
			'source'     => 'direct',
		);

		set_transient( $cache_key, $payload, 15 * MINUTE_IN_SECONDS );

		$payload['suggestions'] = self::filter_suggestions( $queries, $urls['companyName'], $current_keyword );
		if ( empty( $payload['suggestions'] ) && ! empty( $queries ) ) {
			$payload['message'] = __( 'No suitable GSC queries after filtering.', 'neo-pulse-wp' );
		} elseif ( empty( $payload['suggestions'] ) ) {
			$payload['message'] = __( 'No GSC data for this URL yet.', 'neo-pulse-wp' );
		}

		return $payload;
	}

	/**
	 * @param array<int,array<string,mixed>> $queries
	 * @return array<int,array<string,mixed>>
	 */
	public static function filter_suggestions( array $queries, string $company_name, string $current_keyword ): array {
		$current = self::normalize_phrase( $current_keyword );
		$company = self::normalize_phrase( $company_name );
		$out     = array();

		foreach ( $queries as $row ) {
			$q = isset( $row['query'] ) ? trim( (string) $row['query'] ) : '';
			if ( $q === '' ) {
				continue;
			}
			if ( self::is_search_operator( $q ) ) {
				continue;
			}
			$norm = self::normalize_phrase( $q );
			if ( $current !== '' && $norm === $current ) {
				continue;
			}
			if ( $company !== '' && ( $norm === $company || strpos( $norm, $company ) !== false || strpos( $company, $norm ) !== false ) ) {
				continue;
			}
			$words = preg_split( '/\s+/', $norm );
			$word_count = is_array( $words ) ? count( array_filter( $words ) ) : 0;
			if ( $word_count > 8 ) {
				continue;
			}
			$out[] = array(
				'query'       => $q,
				'clicks'      => isset( $row['clicks'] ) ? (int) $row['clicks'] : 0,
				'impressions' => isset( $row['impressions'] ) ? (int) $row['impressions'] : 0,
				'position'    => isset( $row['position'] ) ? (float) $row['position'] : 0,
			);
			if ( count( $out ) >= 5 ) {
				break;
			}
		}

		return $out;
	}

	private static function normalize_phrase( string $text ): string {
		$text = strtolower( trim( $text ) );
		$text = preg_replace( '/[^\p{L}\p{N}\s]/u', '', $text );
		$text = preg_replace( '/\s+/', ' ', $text );
		return is_string( $text ) ? trim( $text ) : '';
	}

	private static function is_search_operator( string $text ): bool {
		if ( preg_match( '/-site:\s*\S+/i', $text ) ) {
			return true;
		}
		if ( preg_match( '/^-\s*\w+:/i', $text ) ) {
			return true;
		}
		return false;
	}
}
